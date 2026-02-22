import type { Product } from '@/types';

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined) return 0;
    const normalized = String(value).replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
};

export type ResolvedPrices = {
    price: number;
    price_floor: number;
    price_roll: number;
    price_promo: number;
};

export const resolveProductPrices = (product: Product): ResolvedPrices => {
    // console.log('Resolving prices for product:', product);
    const price = toNumber(product.price);
    const priceFloor = toNumber(product.price_floor);
    const priceRoll = toNumber(product.price_roll);
    const pricePromo = toNumber(product.price_promo);

    const base = [price, priceFloor, priceRoll].find((v) => v > 0) ?? 0;
    const fallback = base > 0 ? base : 0.01;

    // console.log('Resolved prices:', { price, priceFloor, priceRoll, pricePromo, fallback });
    return {
        price: price > 0 ? price : fallback,
        price_floor: priceFloor > 0 ? priceFloor : fallback,
        price_roll: priceRoll > 0 ? priceRoll : fallback,
        price_promo: pricePromo > 0 ? pricePromo : 0,
    };
};
