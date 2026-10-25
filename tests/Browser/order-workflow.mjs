import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import puppeteer from 'puppeteer';

// Real workflow screen and real submission provider; replace only the app shell and HTTP session.
const bundle = await build({
    stdin: { contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import Show from '@/pages/orders/show';
        import { CartOrderProvider, useCartOrder } from '@/components/cart/cart-order.context';
        import { CartContext } from '@/components/cart/cart.context';
        const root = createRoot(document.getElementById('root'));
        window.requests = [];
        window.session = {auth: {user: {id: 2}}, cart: {id: 42}, locale: 'fr'};
        const line = {product_id: 7, name: 'Rose', ref: 'ROSE', quantity: 10, ordered_quantity: 10, accepted_quantity: 10, unit_price: 5, can_edit: true, billing_user_id: 2};
        window.renderOrder = (status = 'processing', client = false) => {
            window.session.auth.user.id = client ? 1 : 2;
            root.render(<Show order={{id: 42, number: '00042', status, status_label: status, revision: 3, client: {id: 1, name: 'Client test', ref: 'CLI042'}, lines: [{...line, can_edit: !client, ...(status !== 'processing' ? {shipped_quantity: 10} : {})}], comments: [], issues: [], documents: []}} can_manage={!client} can_invoice={!client} can_report numbering={{pattern: '%annee%-%compteur%', preview: '2026-000001'}} />);
        };
        function SubmitButtons() {
            const order = useCartOrder();
            return <><button id="save" onClick={() => order.handleSaveCart()}>Save</button><button id="submit" onClick={() => order.handleGenerateTcpdf()}>Submit</button><output id="message">{order.saveMessage}</output><output id="result">{order.pdfResult?.origin}</output></>;
        }
        function Submission() {
            const [items, setItems] = React.useState([{product: {id: 7, name: 'Rose', price: 5, cond: 1, floor: 1, roll: 1}, quantity: 10, comment: 'Client'}]);
            return <CartContext.Provider value={{items, orderComment: 'Initial', clearCart: () => {window.cleared++; setItems([]);}}}><CartOrderProvider><SubmitButtons /></CartOrderProvider></CartContext.Provider>;
        }
        window.renderSubmission = () => { window.cleared = 0; window.session.auth.user.id = 1; root.render(<Submission />); };
        window.renderOrder();
    `, loader: 'tsx', resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    alias: { '@': path.resolve('resources/js') },
    plugins: [{ name: 'session', setup(builder) {
        builder.onResolve({ filter: /^@inertiajs\/react$/ }, () => ({ path: 'session', namespace: 'fixture' }));
        builder.onResolve({ filter: /^@\/layouts\/app-layout$/ }, () => ({ path: 'layout', namespace: 'fixture' }));
        builder.onResolve({ filter: /^\.\/cart.context$/ }, () => ({ path: 'cart', namespace: 'fixture' }));
        builder.onResolve({ filter: /^@\/components\/cart\/cart.context$/ }, () => ({ path: 'cart', namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ contents: name === 'session' ? `
            export const usePage = () => ({props: window.session});
            export const Head = () => null;
            export const Link = ({children, href}) => <a href={href}>{children}</a>;
            const request = (url, data, options) => { window.requests.push({url, data}); options?.onStart?.(); options?.onSuccess?.(); options?.onFinish?.(); };
            export const router = {post: request, put: request, reload: () => {}, visit: () => {}};
        ` : name === 'cart' ? `import {createContext} from 'react'; export const CartContext = createContext({});`
            : `export default function Layout({children}) {return <main>{children}</main>}`,
            loader: 'jsx', resolveDir: process.cwd(),
        }));
    } }],
});
const submitted = [];
const manifestPath = 'public/build/manifest.json';
const cssPath = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8'))['resources/js/app.tsx']?.css?.[0] : null;
let failSubmission = false;
const server = createServer(async (request, response) => {
    if (request.url === '/bundle.js') {
        response.setHeader('Content-Type', 'text/javascript'); response.end(bundle.outputFiles[0].text);
    } else if (request.url === '/app.css') {
        response.setHeader('Content-Type', 'text/css'); response.end(cssPath ? readFileSync(`public/build/${cssPath}`) : '');
    } else if (request.method === 'POST') {
        let body = ''; for await (const chunk of request) body += chunk;
        submitted.push({ url: request.url, data: JSON.parse(body) });
        if (request.url === '/cart/save') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ order_id: 42, order_number: '00042', pdf_download_url: '/pdf', pdf_filename: 'draft.pdf' }));
        } else if (failSubmission) {
            response.writeHead(500, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ message: 'Rendering failed' }));
        } else {
            response.writeHead(200, { 'Content-Type': 'application/pdf', 'X-Order-Id': '42', 'X-Order-Number': '00042' }); response.end('%PDF-test');
        }
    } else if (request.url?.startsWith('/orders/42/products')) {
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify([{ id: 8, name: 'Tulipe', ref: 'TUL' }]));
    } else {
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end('<meta name="csrf-token" content="test"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/bundle.js"></script>');
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    console.log('Launching workflow browser checks…');
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, pipe: true });
    console.log('Browser ready.');
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForSelector('input[aria-label="Quantité préparée : Rose"]');
    if (process.env.WORKFLOW_QA_DIR) {
        mkdirSync(process.env.WORKFLOW_QA_DIR, { recursive: true });
        await page.setViewport({ width: 1280, height: 1000 });
        await page.screenshot({ path: path.join(process.env.WORKFLOW_QA_DIR, 'processing.png'), fullPage: true });
    }
    await page.$eval('input[aria-label="Quantité préparée : Rose"]', input => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(input, '8'); input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Enregistrer les modifications') && !b.disabled));
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Enregistrer les modifications')).click());
    assert.equal(await page.evaluate(() => window.requests.at(-1).data.lines[0].quantity), 8);
    await page.evaluate(() => window.renderOrder('delivered', true));
    await page.waitForSelector('button[aria-label="Produit concerné"]');
    if (process.env.WORKFLOW_QA_DIR) {
        await page.setViewport({ width: 390, height: 844 });
        await page.screenshot({ path: path.join(process.env.WORKFLOW_QA_DIR, 'delivered-mobile.png'), fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Mobile page must not overflow horizontally');
        await page.setViewport({ width: 1280, height: 1000 });
    }
    assert.equal(await page.$$eval('button', buttons => buttons.some(b => b.textContent.includes('Émettre la facture'))), false);
    await page.click('button[aria-label="Produit concerné"]');
    await page.waitForSelector('[role="option"]');
    await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].find(option => option.textContent.includes('Rose')).click());
    await page.type('textarea[aria-label="Description du problème"]', 'Une rose manque');
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Signaler le problème')).click());
    await page.waitForFunction(() => window.requests.at(-1)?.url.endsWith('/issues'));
    assert.equal(await page.evaluate(() => window.requests.at(-1).data.product_id), 7);
    await page.evaluate(() => window.renderSubmission());
    await page.waitForSelector('#save');
    await page.click('#save');
    await page.waitForFunction(() => document.querySelector('#result').textContent === 'save');
    assert.equal(await page.evaluate(() => window.cleared), 0);
    failSubmission = true;
    await page.click('#submit');
    await page.waitForFunction(() => document.querySelector('#message').textContent === 'Rendering failed');
    assert.equal(await page.evaluate(() => window.cleared), 0);
    failSubmission = false;
    await page.click('#submit');
    await page.waitForFunction(() => document.querySelector('#result').textContent === 'order');
    assert.equal(await page.evaluate(() => window.cleared), 1);
    assert.match(await page.$eval('#message', node => node.textContent), /panier a été vidé/);
    const attempts = submitted.filter(r => r.url === '/cart/generate-pdf-tcpdf');
    assert.equal(attempts[0].data.cart_id, 42);
    assert.equal(attempts[0].data.submission_key, attempts[1].data.submission_key);
    assert.deepEqual(errors, []);
    console.log('PASS: professional quantity editing, client reporting, draft preservation, failed-send preservation and automatic clearing only after success.');
} finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
}
