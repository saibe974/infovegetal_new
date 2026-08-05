import type { Product } from '@/types';
import { resolveProductPrices } from '@/lib/resolve-product-prices';

type PricingTier = 'roll' | 'floor' | 'tray' | 'unit';

type CartPricing = {
    unitPrice: number;
    lineTotal: number;
    tier: PricingTier;
};

type CartPricingOptions = {
    renderedDeliveryPerRoll?: number | null;
};

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined) return 0;
    const normalized = String(value).replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

const isRenderedPriceMode = (value: unknown): boolean => {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === '1'
        || normalized === 'price_render'
        || normalized === 'price_rendu'
        || normalized === 'render'
        || normalized === 'rendered'
        || normalized === 'rendu';
};

export const getCartPricing = (
    product: Product,
    quantity: number,
    options: CartPricingOptions = {},
): CartPricing => {
    const qty = Math.max(0, Math.floor(quantity));
    const cond = Math.max(0, Math.floor(toNumber(product.cond)));
    const floor = Math.max(0, Math.floor(toNumber(product.floor)));
    const roll = Math.max(0, Math.floor(toNumber(product.roll)));

    const traySize = cond > 0 ? cond : 0;
    const floorSize = cond > 0 && floor > 0 ? cond * floor : 0;
    const rollSize = cond > 0 && floor > 0 && roll > 0 ? cond * floor * roll : 0;

    const resolved = resolveProductPrices(product);
    const price = resolved.price;
    const priceFloor = resolved.price_floor;
    const priceRoll = resolved.price_roll;
    const pricePromo = resolved.price_promo;
    const rollPrice = pricePromo > 0 ? pricePromo : priceRoll;

    let tier: PricingTier = 'unit';
    let unitPrice = price > 0 ? price : 0;

    if (rollSize > 0 && rollPrice > 0 && qty >= rollSize) {
        tier = 'roll';
        unitPrice = rollPrice;
    } else if (floorSize > 0 && priceFloor > 0 && qty >= floorSize) {
        tier = 'floor';
        unitPrice = priceFloor;
    } else if (traySize > 0 && price > 0 && qty >= traySize) {
        tier = 'tray';
        unitPrice = price;
    }

    const attributes = product.db_user_attributes;
    if (
        options.renderedDeliveryPerRoll !== undefined
        && options.renderedDeliveryPerRoll !== null
        && attributes
        && typeof attributes === 'object'
        && !Array.isArray(attributes)
        && isRenderedPriceMode((attributes as Record<string, unknown>).p)
        && rollSize > 0
    ) {
        const oldDeliveryPerRoll = Math.max(0, toNumber((attributes as Record<string, unknown>).l));
        const newDeliveryPerRoll = Math.max(0, options.renderedDeliveryPerRoll);
        const weighting = toNumber((attributes as Record<string, unknown>).pd);
        const weightingFactor = 1 - weighting / 100;
        const deliveryDeltaPerUnit = (newDeliveryPerRoll - oldDeliveryPerRoll) / rollSize;

        // PriceCalculatorService applies delivery before weighting, so the replacement
        // must follow the same order to stay aligned with server-side product pricing.
        unitPrice = Math.max(
            0,
            unitPrice + (weightingFactor > 0 ? deliveryDeltaPerUnit / weightingFactor : deliveryDeltaPerUnit),
        );
        unitPrice = Math.round(unitPrice * 100) / 100;
    }

    const lineTotal = unitPrice * qty;

    return {
        unitPrice,
        lineTotal,
        tier,
    };
};
