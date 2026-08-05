import type { CartTransportOption } from './cart-shipping';

export type CarrierOverride = {
    carrierId: number;
    zoneId: number;
    transport?: CartTransportOption;
};

export type CarrierOverrides = Record<number, CarrierOverride>;

const CHANGE_EVENT = 'cart-carrier-overrides-changed';

export const getCarrierOverridesStorageKey = (
    userId: number | string | null | undefined,
    cartId: number | string | null | undefined,
): string => `cart:carrier-overrides:${userId ?? 'guest'}:${cartId ?? 'draft'}`;

export const parseCarrierOverrides = (raw: string | null): CarrierOverrides | null => {
    if (!raw) return null;

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

        const overrides: CarrierOverrides = {};
        Object.entries(parsed).forEach(([supplierId, value]) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return;

            const entry = value as Record<string, unknown>;
            const normalizedSupplierId = Number(supplierId);
            const carrierId = Number(entry.carrierId);
            const zoneId = Number(entry.zoneId);
            if (normalizedSupplierId <= 0 || carrierId <= 0 || zoneId <= 0) return;

            const transport = entry.transport && typeof entry.transport === 'object' && !Array.isArray(entry.transport)
                ? entry.transport as CartTransportOption
                : undefined;
            overrides[normalizedSupplierId] = { carrierId, zoneId, ...(transport ? { transport } : {}) };
        });

        return overrides;
    } catch {
        return null;
    }
};

export const readCarrierOverrides = (key: string): CarrierOverrides | null => {
    if (typeof window === 'undefined') return null;
    return parseCarrierOverrides(localStorage.getItem(key));
};

export const writeCarrierOverrides = (key: string, overrides: CarrierOverrides): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(overrides));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
};

export const subscribeToCarrierOverrides = (key: string, callback: (overrides: CarrierOverrides) => void): (() => void) => {
    if (typeof window === 'undefined') return () => undefined;

    const refresh = () => callback(readCarrierOverrides(key) ?? {});
    const handleStorage = (event: StorageEvent) => {
        if (event.key === key) refresh();
    };
    const handleCustom = (event: Event) => {
        if ((event as CustomEvent<{ key?: string }>).detail?.key === key) refresh();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(CHANGE_EVENT, handleCustom);
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(CHANGE_EVENT, handleCustom);
    };
};
