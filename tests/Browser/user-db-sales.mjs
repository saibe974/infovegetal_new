import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer';

const props = {
    user: { id: 7 },
    auth: { user: { id: 1 } },
    carriers: [],
    selectedDbId: [1],
    salesConditions: [
        {
            db_product_id: 1,
            billing_user_id: 20,
            seller_user_id: null,
            conditions_override: { m: 25 },
        },
    ],
    dbProducts: [
        {
            id: 1,
            name: 'Supplier',
            billing_users: [
                {
                    id: 20,
                    name: 'Billing user',
                    defaults: {
                        default_profile_id: 'base',
                        profiles: [
                            {
                                id: 'base',
                                name: 'Base margin',
                                conditions: { m: 10 },
                            },
                            {
                                id: 'premium',
                                name: 'Premium margin',
                                conditions: { m: 25 },
                            },
                        ],
                    },
                    sellers: [
                        {
                            id: 30,
                            name: 'Seller',
                            use_billing_profile: true,
                            seller_defaults: {
                                profiles: [
                                    {
                                        id: 'standard',
                                        name: 'Seller margin',
                                        conditions: { m: 5 },
                                    },
                                ],
                            },
                        },
                    ],
                },
            ],
        },
    ],
};
props.dbProducts.push({
    id: 2,
    name: 'Second supplier',
    billing_users: [
        {
            id: 20,
            name: 'Billing user',
            defaults: {
                default_profile_id: 'base',
                profiles: [
                    {
                        id: 'base',
                        name: 'Second supplier base',
                        conditions: { m: 10 },
                    },
                    {
                        id: 'premium',
                        name: 'Second supplier margin',
                        conditions: { m: 40 },
                    },
                ],
            },
            sellers: [],
        },
    ],
});
props.salesConditions.push({
    db_product_id: 2,
    billing_user_id: 20,
    seller_user_id: null,
    conditions_override: { m: 40 },
});
const bundle = await build({
    stdin: {
        contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import Page from '@/pages/users/db'; createRoot(document.getElementById('root')).render(<Page />);`,
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
            setup(builder) {
                builder.onResolve(
                    {
                        filter: /^(react-sticky-el|@inertiajs\/react|@\/layouts\/|@\/lib\/i18n|@\/components\/sales\/sales-conditions-form)/,
                    },
                    (args) => ({ path: args.path, namespace: 'fixture' }),
                );
                builder.onLoad(
                    { filter: /.*/, namespace: 'fixture' },
                    (args) => ({
                        loader: 'jsx',
                        contents:
                            args.path === '@inertiajs/react'
                                ? `export const usePage = () => ({props: ${JSON.stringify(props)}}); export const Head = () => null; export const router = {post: (url, data) => window.saved = data}; export const Link = ({children}) => children;`
                                : args.path === '@/lib/i18n'
                                  ? `export const useI18n = () => ({t: (text) => text});`
                                  : `export default function Stub({children}) { return children ?? null; }`,
                    }),
                );
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
    console.log('Launching browser');
    browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        pipe: true,
    });
    console.log('Browser ready');
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    console.log('Loaded page', errors);
    await page.waitForSelector('button');
    const clickText = async (selector, text) => {
        const el = await page.waitForFunction(
            (selector, text) =>
                Array.from(document.querySelectorAll(selector)).find(
                    (el) => el.textContent.trim() === text,
                ),
            {},
            selector,
            text,
        );
        await el.click();
    };
    const save = async () => {
        await clickText('button', 'Save');
        return page.evaluate(() => window.saved.sales_conditions[0]);
    };
    assert.equal(
        (await save()).conditions_override.m,
        25,
        'Saving unchanged must retain the billing margin',
    );
    assert.equal(
        await page.evaluate(() => {
            const fields = [
                ...document.querySelectorAll('button[role="combobox"]'),
            ];
            return fields[0].textContent.includes('Premium margin');
        }),
        true,
        'Billing profile appears first under billing user',
    );
    await clickText('button[role="combobox"]', 'No sales rep');
    await clickText('[role="option"]', 'Seller');
    assert.equal((await save()).seller_user_id, 30);
    assert.deepEqual(
        (await save()).conditions_override,
        {},
        'Previous billing margin must not become a seller override',
    );
    await clickText('button[role="combobox"]', 'Seller');
    await clickText('[role="option"]', 'No sales rep');
    const profileTrigger = await page.waitForFunction(() =>
        [...document.querySelectorAll('button[role="combobox"]')].find((el) =>
            el.textContent.includes('Select a billing profile'),
        ),
    );
    await profileTrigger.click();
    const premium = await page.waitForFunction(() =>
        [...document.querySelectorAll('[role="option"]')].find((el) =>
            el.textContent.includes('Premium margin'),
        ),
    );
    await premium.click();
    await clickText('button', 'Second supplier');
    assert.equal(
        await page.evaluate(() =>
            document
                .querySelector('button[role="combobox"]')
                .textContent.includes('Second supplier margin'),
        ),
        true,
        'Switching DB must refresh the profile label even when profile and billing IDs match',
    );
    await clickText('button', 'Supplier');
    assert.equal(
        await page.evaluate(() =>
            document
                .querySelector('button[role="combobox"]')
                .textContent.includes('Premium margin'),
        ),
        true,
        'Returning to the first DB must restore its profile label',
    );
    const saved = await save();
    assert.equal(saved.seller_user_id, null);
    assert.equal(saved.conditions_override.m, 25);
    assert.deepEqual(errors, []);
    console.log(
        'PASS: unchanged margins, seller selection/removal, billing profile placement and saved margin.',
    );
} finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
}
