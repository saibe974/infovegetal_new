import { type Product } from '@/types';

export const toPositiveInt = (value: unknown, fallback = 1): number => {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        return fallback;
    }

    const int = Math.floor(n);
    return int > 0 ? int : fallback;
};

export const isMultipleMode = (raw: unknown): boolean => {
    if (typeof raw === 'boolean') {
        return raw;
    }

    if (typeof raw === 'number') {
        return raw === 1;
    }

    if (typeof raw === 'string') {
        const value = raw.trim().toLowerCase();
        return value === '1' || value === 'true' || value === 'yes' || value === 'on';
    }

    return false;
};

export const isProductMultiple = (product: Product): boolean => {
    const raw = (product as Product & { multiple?: unknown }).multiple;
    return isMultipleMode(raw);
};

export const getUniteQuantity = (product: Product): number => toPositiveInt(product.unite, 1);
export const getCondQuantity = (product: Product): number => toPositiveInt(product.cond, 1);

export const getQuantityStep = (product: Product, currentQuantity: number): number => {
    const unite = getUniteQuantity(product);

    if (isProductMultiple(product)) {
        return unite;
    }

    return currentQuantity > unite ? getCondQuantity(product) : unite;
};

export const getAddQuantity = (product: Product, requested: number): number => {
    if (isProductMultiple(product)) {
        return getUniteQuantity(product);
    }

    return toPositiveInt(requested, 1);
};

export const normalizeQuantity = (product: Product, requested: number): number | null => {
    const unite = getUniteQuantity(product);
    let nextQuantity = Number.isFinite(requested) ? Math.floor(requested) : unite;

    if (nextQuantity < unite) {
        return null;
    }

    if (isProductMultiple(product)) {
        nextQuantity = Math.floor(nextQuantity / unite) * unite;
        if (nextQuantity < unite) {
            return null;
        }
    }

    return nextQuantity;
};
