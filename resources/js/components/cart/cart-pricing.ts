import type { Product } from '@/types';

type PricingTier = 'roll' | 'floor' | 'tray' | 'unit';

type CartPricing = {
    unitPrice: number;
    lineTotal: number;
    tier: PricingTier;
};

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined) return 0;
    const normalized = String(value).replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const getCartPricing = (product: Product, quantity: number): CartPricing => {
    const qty = Math.max(0, Math.floor(quantity));
    const cond = Math.max(0, Math.floor(toNumber(product.cond)));
    const floor = Math.max(0, Math.floor(toNumber(product.floor)));
    const roll = Math.max(0, Math.floor(toNumber(product.roll)));

    const traySize = cond > 0 ? cond : 0;
    const floorSize = cond > 0 && floor > 0 ? cond * floor : 0;
    const rollSize = cond > 0 && floor > 0 && roll > 0 ? cond * floor * roll : 0;

    const price = toNumber(product.price);
    const priceFloor = toNumber(product.price_floor);
    const priceRoll = toNumber(product.price_roll);
    const pricePromo = toNumber(product.price_promo);
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

    const lineTotal = unitPrice * qty;

    return {
        unitPrice,
        lineTotal,
        tier,
    };
};
