import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
const bundle = await build({
    entryPoints: ['resources/js/components/cart/cart-shipping.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    alias: { '@': path.resolve('resources/js') },
});
const output = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, {
    module: output,
    exports: output.exports,
    require: createRequire(import.meta.url),
    console,
    process,
    setTimeout,
    clearTimeout,
    URL,
});
const { calculateCartShipping, refreshCartTransport } = output.exports;
const options = {
    '1:10': {
        carrier_id: 1,
        zone_id: 10,
        taxgo: 10,
        tariffs: { mini: 250, 2: 100 },
        supplements_by_db: { 1: 5 },
    },
    '2:20': {
        carrier_id: 2,
        zone_id: 20,
        taxgo: 0,
        tariffs: { mini: 150, 2: 80 },
    },
};
const item = (id, db) => ({
    product: {
        id,
        db_products_id: db,
        dbProduct: { id: db, name: 'Supplier', mod_liv: 'roll' },
        cond: 1,
        floor: 10,
        roll: 5,
        db_user_attributes: { fact: 20 },
        db_user_transport: null,
    },
    quantity: 50,
    comment: '',
});
const items = [item(1, 1), item(2, 2)];
const attrs = {
    1: {
        p: 'price_depart',
        t: JSON.stringify([
            { carrier_id: 1, zone_id: 10 },
            { carrier_id: 2, zone_id: 20 },
        ]),
    },
    2: {
        p: 'price_depart',
        t: JSON.stringify([{ carrier_id: 1, zone_id: 10 }]),
    },
};
assert.equal(
    calculateCartShipping(items).total,
    0,
    'Fixture reproduces missing transport in cached catalogue products',
);
const refreshed = refreshCartTransport(items, attrs, options);
const shared = calculateCartShipping(refreshed, {}, options);
assert.equal(
    shared.total,
    280.5,
    'One common minimum plus supplement and carrier surcharge',
);
assert.equal(shared.groups.length, 1);
const different = calculateCartShipping(
    refreshed,
    { 1: { carrierId: 2, zoneId: 20 } },
    options,
);
assert.equal(
    different.total,
    425,
    'Each carrier applies its own tariff and minimum',
);
assert.equal(different.groups.length, 2);
assert.equal(
    calculateCartShipping(
        refreshCartTransport(
            items,
            { ...attrs, 1: { ...attrs[1], p: 'price_render' } },
            options,
        ),
        {},
        options,
    ).total,
    170.5,
    'Rendered prices deduct transport already included in a full roll',
);
assert.equal(
    items[0].product.db_user_transport,
    null,
    'Refreshing must not mutate stored products',
);
console.log(
    'PASS: stale cart, current carrier options, shared minimum, multiple carriers, supplements, surcharge and rendered prices.',
);
