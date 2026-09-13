// Component integration regression: real React controls, mocked API and session.
// Run with: node tests/Browser/file-export.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import { build } from 'esbuild';
import puppeteer from 'puppeteer';

const template = {
    name: 'Common model', filename: 'catalog', delimiter: ';',
    blocks: [{ id: 'products', name: 'Products', type: 'items', enabled: true, show_headers: true,
        columns: [{ id: 'sku', name: 'SKU' }, { id: 'name', name: 'Name' }],
        rows: [{ id: 'row', cells: { sku: '%product.sku%', name: '%product.name%' } }] }],
};
const entry = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ProductsExportPanel } from '@/components/products/products-template-export-panel';
import BillingFileEditor from '@/components/sales/BillingFileEditor';
import { templateCompatibility } from '@/components/app/file-template/template-library';
const template = ${JSON.stringify(template)};
const options = { columns: [{key:'sku',label:'SKU',type:'text'},{key:'name',label:'Name',type:'text'}], defaults:['sku','name'], template,
    limits:{csv:1000,xlsx:1000,xlsx_cells:10000,xlsx_images:100} };
function App() {
    const [screen, setScreen] = useState('products');
    const [file, setFile] = useState({...template,id:'billing-custom',event:'invoice',events:['invoice','delivery'],enabled:true,shared:true,extension:'csv'});
    window.billingFile = file;
    window.compatibility = templateCompatibility;
    return <><button onClick={() => setScreen(screen === 'products' ? 'billing' : 'products')}>Switch screen</button>
      {screen === 'products' ? <ProductsExportPanel total={2} options={options} catalogUrl='/products?q=plant' exportUrl='/export' onBack={() => {}} /> : <BillingFileEditor file={file} canManage expanded={false} onExpandedChange={() => {}} onChange={setFile} />}</>;
}
createRoot(document.getElementById('root')).render(<App/>);`;
const bundle = await build({
    stdin: { contents: entry, loader: 'tsx', resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', jsx: 'automatic',
    alias: { '@': path.resolve('resources/js') },
    plugins: [{ name: 'session-fixture', setup(builder) {
        builder.onResolve({ filter: /^@inertiajs\/react$/ }, () => ({ path: 'session', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `export const usePage = () => ({props:{auth:{user:{id:7}},csrf_token:'test',locale:'fr'}});` }));
    } }],
});
const models = [];
const calls = [];
const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/bundle.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(bundle.outputFiles[0].text); return; }
    if (url.pathname === '/') { response.setHeader('Content-Type', 'text/html; charset=utf-8'); response.end('<div id="root"></div><script src="/bundle.js"></script>'); return; }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString();
    const body = raw && request.headers['content-type']?.includes('application/json') ? JSON.parse(raw) : null;
    calls.push({ path: url.pathname, method: request.method, body });
    response.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/file-export-templates') {
        if (request.method === 'POST') {
            const index = models.findIndex((model) => model.id === body.id);
            if (index < 0) models.push(body); else models[index] = body;
            response.end(JSON.stringify(body));
        } else response.end(JSON.stringify(models));
    } else if (url.pathname.startsWith('/file-export-templates/')) {
        const index = models.findIndex((model) => model.id === url.pathname.split('/').at(-1));
        if (index >= 0) models.splice(index, 1);
        response.statusCode = 204; response.end();
    } else if (body?.preview) response.end(JSON.stringify({
        filename: `${body.template.filename}.${body.format}`, total: 2, sample_count: 2, line_count: 2, image_count: 0, limit: 1000, too_large: false,
        values: {'product.sku':'0001','product.name':'Plant'}, rows: [{ heading: false, cells: [{ value: '0001', image: null }] }],
    }));
    else if (body?.check) response.end(JSON.stringify({ filename: `${body.template.filename}.${body.format}` }));
    else { response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); response.end('fixture'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.evaluateOnNewDocument((legacy) => {
        localStorage.setItem('product-export-templates:v1:7', JSON.stringify([{id:'legacy-one',format:'csv',template:legacy}]));
    }, template);
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const click = async (label) => {
        await page.waitForFunction((text) => [...document.querySelectorAll('button')].some((button) => button.textContent.trim().startsWith(text) && !button.disabled), {}, label);
        await page.evaluate((text) => [...document.querySelectorAll('button')].find((button) => button.textContent.trim().startsWith(text) && !button.disabled).click(), label);
    };
    const settle = () => new Promise((resolve) => setTimeout(resolve, 550));
    await page.waitForFunction(() => !document.querySelector('select[aria-label="Configuration enregistrée"]')?.disabled);
    assert.equal(models.length, 1, 'legacy model imported');
    assert.equal(calls.filter((call) => call.body?.preview).length, 0, 'no automatic initial preview');
    await click('Actualiser l’aperçu');
    await page.waitForSelector('section[aria-label="Aperçu du fichier"] table');
    await click('Tout désélectionner');
    await settle();
    assert.equal(calls.filter((call) => call.body?.preview).length, 1, 'editing does not refresh');
    assert.ok(await page.$('section[aria-label="Aperçu du fichier"] table'), 'old preview remains');
    assert.ok(await page.evaluate(() => document.body.textContent.includes('aperçu à actualiser')));
    await click('Tout sélectionner');
    await click('Enregistrer');
    await page.waitForFunction(() => document.body.textContent.includes('Configuration enregistrée dans'));
    const originalId = models.at(-1).id;
    await click('Dupliquer'); await settle();
    assert.equal(models.length, 3);
    assert.notEqual(models.at(-1).id, originalId);
    await click('Paramètres du fichier');
    await page.evaluate(() => [...document.querySelectorAll('label')].find((label) => label.textContent.trim() === 'Excel (.xlsx)').click());
    await click('Exporter'); await settle();
    assert.equal(calls.filter((call) => call.body?.preview).length, 1, 'export never refreshes preview');
    assert.equal(calls.findLast((call) => call.body?.check).body.format, 'xlsx', 'export validates current format');
    await click('Switch screen');
    await page.waitForFunction(() => !document.querySelector('select[aria-label="Configuration enregistrée"]')?.disabled);
    await page.select('select[aria-label="Configuration enregistrée"]', originalId);
    await click('Charger');
    const billing = await page.evaluate(() => window.billingFile);
    assert.deepEqual(billing.events, ['invoice', 'delivery']);
    assert.equal(billing.shared, true); assert.equal(billing.enabled, true); assert.equal(billing.id, 'billing-custom');
    assert.deepEqual(billing.blocks, models.find((model) => model.id === originalId).template.blocks);
    assert.equal(await page.$('section[aria-label="Aperçu du fichier"] table'), null);
    await click('Actualiser l’aperçu');
    await page.waitForSelector('section[aria-label="Aperçu du fichier"] table');
    await click('Paramètres du fichier');
    await page.evaluate(() => [...document.querySelectorAll('label')].find((label) => label.textContent.trim() === 'TSV').click());
    await settle();
    assert.ok(await page.evaluate(() => document.body.textContent.includes('aperçu à actualiser')));
    assert.equal(await page.evaluate(() => window.billingFile.delimiter), '\t');
    const unknown = await page.evaluate((definition) => {
        definition.blocks[0].rows[0].cells.sku = '%calc:quantity*unit_price|decimal:2%';
        return window.compatibility(definition, () => ['%product.name%']);
    }, template);
    assert.deepEqual(unknown, ['%quantity%', '%unit_price%']);
    assert.deepEqual(errors, []);
    console.log('PASS: migration, shared library, duplication, manual previews, current export, billing settings, compatibility.');
} finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
}
