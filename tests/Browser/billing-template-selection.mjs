import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const template = { name: 'Library TSV', filename: 'export', delimiter: '|', blocks: [{ id: 'items', name: 'Products', type: 'items', enabled: true, show_headers: true, columns: [{ id: 'sku', name: 'SKU' }, { id: 'empty', name: 'Empty' }], rows: [{ id: 'row', cells: { sku: '%product.sku%' } }] }] };
const bundle = await build({
    stdin: { contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import BillingFileEditor from '@/components/sales/BillingFileEditor';
        import { normalizeBillingDefaultsToProfiles, profilesToBillingDefaults } from '@/lib/billing-defaults';
        const initial = {...${JSON.stringify(template)}, name: 'Renamed export', id: 'custom', extension: 'tsv', event: 'order', events: ['order'], enabled: true, shared: false};
        function App() {
            const [file, setFile] = useState(initial);
            const [version, setVersion] = useState(0);
            window.file = file;
            window.restore = () => {
                const payload = profilesToBillingDefaults({profiles: [{id: 'standard', name: 'Standard', conditions: {}}], files: [file]});
                const restored = normalizeBillingDefaultsToProfiles(JSON.parse(JSON.stringify(payload))).files[0];
                setFile(restored);
                setVersion(v => v + 1);
            };
            return <BillingFileEditor key={version} file={file} canManage expanded={false} onExpandedChange={() => {}} onChange={setFile} />;
        }
        createRoot(document.getElementById('root')).render(<App />);
    `, loader: 'tsx', resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    alias: { '@': path.resolve('resources/js') },
    plugins: [{ name: 'session', setup(builder) {
        builder.onResolve({filter: /^@inertiajs\/react$/}, () => ({path: 'session', namespace: 'fixture'}));
        builder.onLoad({filter: /.*/, namespace: 'fixture'}, () => ({contents: `export const usePage = () => ({props: {auth: {user: {id: 7}}, csrf_token: 'test', locale: 'fr'}});`}));
    } }],
});
const server = createServer((request, response) => {
    if (request.url === '/bundle.js') {
        response.setHeader('Content-Type', 'text/javascript');
        response.end(bundle.outputFiles[0].text);
    } else if (request.url === '/file-export-templates') {
        response.setHeader('Content-Type', 'application/json');
        response.end(JSON.stringify([{id: 'saved-tsv', format: 'tsv', template}]));
    } else {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end('<div id="root"></div><script src="/bundle.js"></script>');
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        pipe: true,
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const selector = 'select[aria-label="Configuration enregistrée"]';
    const selected = value => page.waitForFunction((selector, value) => {
        const select = document.querySelector(selector);
        return select && !select.disabled && select.value === value;
    }, {}, selector, value);
    await selected('saved-tsv');
    assert.equal(await page.evaluate(() => window.file.name), 'Renamed export');
    await page.evaluate(() => window.restore());
    await selected('saved-tsv');
    await page.select(selector, '');
    await selected('');
    assert.equal(await page.evaluate(() => window.file.template_id), null);
    await page.select(selector, 'saved-tsv');
    await selected('saved-tsv');
    assert.equal(await page.evaluate(() => window.file.template_id), 'saved-tsv');
    await page.evaluate(() => window.restore());
    await selected('saved-tsv');
    assert.equal(await page.evaluate(() => window.file.template_id), 'saved-tsv');
    assert.deepEqual(errors, []);
    console.log('PASS: renamed legacy export, normalized round trip, automatic load, saved ID, remount and explicit reset.');
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
