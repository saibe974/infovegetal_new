import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
const bundle = await build({
    stdin: {
        contents: `export {resolveCatalogPrices} from '@/lib/catalog-product-pricing';export {getCartPricing} from '@/components/cart/cart-pricing';export {calculateCartShipping, getCatalogTransportPricing} from '@/components/cart/cart-shipping';`,
        resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
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
const {
    resolveCatalogPrices,
    getCartPricing,
    calculateCartShipping,
    getCatalogTransportPricing,
} = output.exports;
for (const minimum of [0, 250, 500])
    for (const supplement of [0, 25])
        for (const taxgo of [0, 10])
            for (const weighting of [0, 10]) {
                const transport = {
                    carrier_id: 1,
                    zone_id: 10,
                    zone_name: 'Zone',
                    taxgo,
                    tariffs: { mini: minimum, '1-2': 125, '3-4': 125, 5: 100 },
                    supplements_by_db: { 1: supplement },
                };
                const product = {
                    id: 1,
                    db_products_id: 1,
                    dbProduct: { id: 1, mod_liv: 'roll' },
                    cond: 1,
                    floor: 10,
                    roll: 5,
                    price: 12,
                    price_floor: 11,
                    price_roll: 10,
                    price_promo: 9,
                    db_user_attributes: {
                        p: 'price_render',
                        pd: weighting,
                        l: 100,
                        t: 1,
                        z: 10,
                    },
                    db_user_transport: transport,
                };
                const catalog = resolveCatalogPrices(product, transport);
                for (const [quantity, key, promo] of [
                    [1, 'price', false],
                    [10, 'price_floor', false],
                    [50, 'price_roll', false],
                    [50, 'price_promo', true],
                ]) {
                    const selected = {
                        ...product,
                        price_promo: promo ? product.price_promo : 0,
                    };
                    const shipping = calculateCartShipping([
                        { product: selected, quantity, comment: '' },
                    ]);
                    const cart = getCartPricing(selected, quantity, {
                        renderedDeliveryPerRoll: shipping.renderedPerRoll[1],
                    });
                    assert.equal(
                        catalog.prices[key],
                        cart.unitPrice,
                        JSON.stringify({
                            minimum,
                            supplement,
                            taxgo,
                            weighting,
                            quantity,
                            key,
                        }),
                    );
                }
                assert.equal(
                    catalog.nextTier.rollCount,
                    5,
                    'An unchanged tariff or minimum must not announce a discount on unit prices',
                );
            }
assert.equal(
    getCatalogTransportPricing({
        carrier_id: 1,
        zone_id: 10,
        tariffs: { mini: 500, 1: 125 },
        taxgo: 0,
    }).nextTier,
    null,
);
console.log(
    'PASS: 96 direct catalogue/cart price comparisons, minimums, supplements, surcharge, weighting, promo and real discount tiers.',
);
