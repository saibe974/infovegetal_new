import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer';
const options = {
    '1:10': {
        carrier_id: 1,
        carrier_name: 'Carrier A',
        zone_id: 10,
        zone_name: 'North',
        taxgo: 0,
        tariffs: { mini: 250, '1-4': 125, 5: 100 },
    },
    '2:20': {
        carrier_id: 2,
        carrier_name: 'Carrier B',
        zone_id: 20,
        zone_name: 'North',
        taxgo: 0,
        tariffs: { mini: 0, '1-4': 50, 5: 40 },
    },
};
const attrs = {
    p: 'price_render',
    l: 100,
    t: JSON.stringify([
        { carrier_id: 1, zone_id: 10 },
        { carrier_id: 2, zone_id: 20 },
    ]),
};
const product = {
    id: 1,
    db_products_id: 1,
    cond: 1,
    floor: 10,
    roll: 5,
    price: 12,
    price_floor: 11,
    price_roll: 10,
    price_promo: 9,
    db_user_attributes: attrs,
    db_user_transport: options['1:10'],
};
const props = {
    auth: { user: { id: 7 } },
    cart: { id: 11 },
    cart_transport_attributes: { 1: attrs, 2: attrs },
    cart_transport_options: options,
    cart_transport_db_names: { 1: 'Supplier' },
};
const bundle = await build({
    stdin: {
        contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {CatalogTransportProvider} from '@/components/cart/catalog-transport-context';import {CatalogCarrierSelector} from '@/components/cart/catalog-carrier-selector';import {ProductOrderButtons} from '@/components/products/product-order-buttons';createRoot(document.getElementById('root')).render(<CatalogTransportProvider items={[]}><CatalogCarrierSelector dbId={1} compact/><ProductOrderButtons product={${JSON.stringify(product)}} className="grid grid-cols-3" /></CatalogTransportProvider>);`,
        loader: 'tsx',
        resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    alias: { '@': path.resolve('resources/js') },
    plugins: [
        {
            name: 'fixture',
            setup(b) {
                b.onResolve(
                    {
                        filter: /^(@inertiajs\/react|@\/components\/cart\/cart.context|@\/components\/cart\/use-cart-auto-open|@\/lib\/i18n)$/,
                    },
                    (args) => ({ path: args.path, namespace: 'fixture' }),
                );
                b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
                    loader: 'jsx',
                    resolveDir: process.cwd(),
                    contents:
                        args.path === '@inertiajs/react'
                            ? `export const usePage=()=>({props:${JSON.stringify(props)}});`
                            : args.path === '@/lib/i18n'
                              ? `export const useI18n=()=>({t:text=>text});`
                              : args.path ===
                                  '@/components/cart/use-cart-auto-open'
                                ? `export const useCartAutoOpen=()=>()=>{};`
                                : `import {createContext} from 'react';export const CartContext=createContext({addToCart:(product,quantity)=>window.added={product,quantity}});`,
                }));
            },
        },
    ],
});
const server = createServer((req, res) => {
    res.setHeader(
        'Content-Type',
        req.url === '/bundle.js'
            ? 'text/javascript'
            : 'text/html; charset=utf-8',
    );
    res.end(
        req.url === '/bundle.js'
            ? bundle.outputFiles[0].text
            : '<div id="root"></div><script src="/bundle.js"></script>',
    );
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        pipe: true,
    });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForSelector('.product-order-button');
    assert.equal(await page.$$eval('select', elements => elements.length), 1, 'A supplier block must only show its own carrier selector');
    const prices = () =>
        page.$$eval('.product-order-button__details', (els) =>
            els.map((el) => el.textContent.replace(/\s/g, '')),
        );
    assert.deepEqual(await prices(), [
        '12,50€X1',
        '11,50€X10',
        '10,50€9,50€X50',
    ]);
    assert.match(await page.$eval('#root', (el) => el.textContent), /5 rolls/);
    await page.select('select', '2:20');
    await page.waitForFunction(() =>
        document
            .querySelector('.product-order-button__details')
            .textContent.includes('11,00'),
    );
    assert.deepEqual(await prices(), [
        '11,00€X1',
        '10,00€X10',
        '9,00€8,00€X50',
    ]);
    assert.match(await page.$eval('#root', (el) => el.textContent), /5 rolls/);
    assert.equal(
        await page.evaluate(
            () =>
                JSON.parse(
                    localStorage.getItem('cart:carrier-overrides:7:11'),
                )[1].carrierId,
        ),
        2,
    );
    await page.click('.product-order-button');
    assert.equal(
        await page.evaluate(() => window.added.product.price),
        12,
        'Display pricing must not overwrite server prices stored in cart',
    );
    await page.reload();
    await page.waitForSelector('.product-order-button');
    assert.equal(await page.$eval('select', (el) => el.value), '2:20');
    assert.deepEqual(await prices(), [
        '11,00€X1',
        '10,00€X10',
        '9,00€8,00€X50',
    ]);
    assert.deepEqual(errors, []);
    console.log(
        'PASS: three rendered prices, promo, carrier selection without cart items, next discount tier, storage and reload.',
    );
} finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
}
