export type CartDiscountType = 'fixed' | 'percent';

export type CartDiscountDraft = {
    type: CartDiscountType;
    value: string;
};

export type CartDiscounts = Record<number, CartDiscountDraft>;

export const getCartDiscountsStorageKey = (
    userId: number | string | null | undefined,
    cartId: number | string | null | undefined,
): string => `cart:discounts:${userId ?? 'guest'}:${cartId ?? 'draft'}`;

export const parseCartDiscounts = (raw: string | null): CartDiscounts | null => {
    if (!raw) return null;

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        const discounts: CartDiscounts = {};
        Object.entries(parsed).forEach(([dbId, value]) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return;

            const normalizedDbId = Number(dbId);
            const entry = value as Record<string, unknown>;
            if (normalizedDbId <= 0) return;

            discounts[normalizedDbId] = {
                type: entry.type === 'percent' ? 'percent' : 'fixed',
                value: typeof entry.value === 'string' || typeof entry.value === 'number'
                    ? String(entry.value)
                    : '',
            };
        });

        return discounts;
    } catch {
        return null;
    }
};

export const readCartDiscounts = (key: string): CartDiscounts | null => {
    if (typeof window === 'undefined') return null;
    return parseCartDiscounts(localStorage.getItem(key));
};

export const writeCartDiscounts = (key: string, discounts: CartDiscounts): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(discounts));
};
