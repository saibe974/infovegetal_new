import { build } from 'esbuild';
import assert from 'node:assert/strict';
import path from 'node:path';

const bundle = await build({
    entryPoints: ['resources/js/lib/billing-defaults.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    alias: { '@': path.resolve('resources/js') },
});
const { normalizeBillingDefaultsToProfiles, profilesToBillingDefaults } =
    await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

for (const name of ['', null]) {
    const columns = [{ id: 'sku', name }];
    const original = {
        profiles: [{ id: 'standard', name: 'Standard', conditions: {} }],
        files: [{
            id: 'export', name: 'Export', event: 'order', extension: 'tsv',
            delimiter: '\t', columns,
            blocks: [{
                id: 'items', name: 'Products', type: 'items',
                columns, rows: [{ id: 'row', cells: { sku: '%product.sku%' } }],
            }],
        }],
    };
    for (const legacy of [false, true]) {
        const input = structuredClone(original);
        if (legacy) {
            input.files[0].rows = input.files[0].blocks[0].rows;
            delete input.files[0].blocks;
        }
        const saved = profilesToBillingDefaults(input);
        const restored = normalizeBillingDefaultsToProfiles(JSON.parse(JSON.stringify(saved)));
        assert.equal(restored.files[0].blocks[0].columns[0].name, '');
        assert.equal(restored.files[0].blocks[0].rows[0].cells.sku, '%product.sku%');
    }
}
console.log('PASS: empty billing headers survive normalization and saving.');
