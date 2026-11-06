import { replaceRenderedDeliveryInPrice } from '@/components/cart/cart-pricing';
import {
    getCatalogTransportPricing,
    type CartTransportOption,
} from '@/components/cart/cart-shipping';
import { resolveProductPrices } from '@/lib/resolve-product-prices';
import type { Product } from '@/types';

export function resolveCatalogPrices(
    product: Product,
    transport?: CartTransportOption | null,
) {
    const prices = resolveProductPrices(product);
    const attrs = product.db_user_attributes;
    const rendered = [
        '1',
        'price_render',
        'price_rendu',
        'render',
        'rendered',
        'rendu',
    ].includes(String(attrs?.p ?? '').toLowerCase());
    const rollSize =
        Number(product.cond) * Number(product.floor) * Number(product.roll);
    if (!rendered || !transport || !(rollSize > 0))
        return { prices, nextTier: null };
    const pricing = getCatalogTransportPricing(transport);
    const adjust = (value: number) =>
        value > 0
            ? replaceRenderedDeliveryInPrice(
                  product,
                  value,
                  pricing.pricePerRoll,
              )
            : 0;
    return {
        prices: {
            price: adjust(prices.price),
            price_floor: adjust(prices.price_floor),
            price_roll: adjust(prices.price_roll),
            price_promo: adjust(prices.price_promo),
        },
        nextTier: pricing.nextTier,
    };
}
