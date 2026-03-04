import type { CartItem } from './cart.context';
import { buildRollDistribution, type SupplierDistribution } from '@/components/products/product-roll';

type DbUserAttributes = Record<string, unknown>;
type DbUserTransport = {
    carrier_id: number;
    zone_id: number;
    zone_name: string;
    taxgo: number;
    tariffs: Record<string, number | string | null>;
};

export type CartShippingSummary = {
    bySupplier: Record<number, number>;
    total: number;
};

export type CartTransportContext = {
    attrsBySupplier: Record<number, DbUserAttributes>;
    transportBySupplier: Record<number, DbUserTransport>;
};

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const normalized = value.replace(',', '.').trim();
        const parsed = Number.parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

const toFillRatio = (coef: number): number => {
    const normalized = coef > 1 ? coef / 100 : coef;
    return Math.max(0, Math.min(1, normalized));
};

const extractSupplierAttributes = (items: CartItem[]): Record<number, DbUserAttributes> => {
    const result: Record<number, DbUserAttributes> = {};

    items.forEach(({ product }) => {
        const supplierId = Number(product.db_products_id ?? product.dbProduct?.id ?? 0);
        if (!supplierId || result[supplierId]) {
            return;
        }

        const attrs = product.db_user_attributes;
        if (attrs && typeof attrs === 'object' && !Array.isArray(attrs)) {
            result[supplierId] = attrs as DbUserAttributes;
        }
    });

    return result;
};

const extractSupplierTransport = (items: CartItem[]): Record<number, DbUserTransport> => {
    const result: Record<number, DbUserTransport> = {};

    items.forEach(({ product }) => {
        const supplierId = Number(product.db_products_id ?? product.dbProduct?.id ?? 0);
        if (!supplierId || result[supplierId]) {
            return;
        }

        const transport = product.db_user_transport;
        if (!transport || typeof transport !== 'object' || Array.isArray(transport)) {
            return;
        }

        const tariffs = (transport as DbUserTransport).tariffs;
        result[supplierId] = {
            carrier_id: Number((transport as DbUserTransport).carrier_id ?? 0),
            zone_id: Number((transport as DbUserTransport).zone_id ?? 0),
            zone_name: String((transport as DbUserTransport).zone_name ?? ''),
            taxgo: Number((transport as DbUserTransport).taxgo ?? 0),
            tariffs: tariffs && typeof tariffs === 'object' && !Array.isArray(tariffs) ? tariffs : {},
        };
    });

    return result;
};

const parseTariffKey = (rawKey: string): { min: number; max: number | null } | null => {
    const normalized = rawKey.replace(/^roll:/, '').trim();
    if (!normalized) {
        return null;
    }

    const matches = normalized.match(/\d+(?:[.,]\d+)?/g) ?? [];
    if (matches.length === 0) {
        return null;
    }

    const toValue = (value: string) => Number(value.replace(',', '.'));
    const first = matches[0];
    if (!first) {
        return null;
    }
    const min = toValue(first);
    if (!Number.isFinite(min)) {
        return null;
    }

    if (matches.length >= 2) {
        const second = matches[1];
        const max = second ? toValue(second) : NaN;
        return {
            min,
            max: Number.isFinite(max) ? max : null,
        };
    }

    return { min, max: null };
};

const pickZoneTariff = (rollCount: number, tariffs: Record<string, number | string | null>): number => {
    if (rollCount <= 0) {
        return 0;
    }

    const entries = Object.entries(tariffs)
        .filter(([key]) => key !== 'mini')
        .map(([key, value]) => ({ range: parseTariffKey(key), value: toNumber(value) }))
        .filter((entry) => entry.range && Number.isFinite(entry.value) && entry.value > 0)
        .map((entry) => ({
            min: entry.range!.min,
            max: entry.range!.max,
            value: entry.value,
        }))
        .filter((entry) => entry.min > 0)
        .sort((a, b) => (a.min === b.min ? (a.max ?? Infinity) - (b.max ?? Infinity) : a.min - b.min));

    let base = 0;

    if (entries.length > 0) {
        const eligible = entries.filter((entry) => rollCount >= entry.min && (entry.max === null || rollCount <= entry.max));
        if (eligible.length > 0) {
            base = eligible.reduce((best, entry) => (entry.min >= best.min ? entry : best)).value;
        } else {
            const lowerOrEqual = entries.filter((entry) => rollCount >= entry.min);
            if (lowerOrEqual.length > 0) {
                base = lowerOrEqual[lowerOrEqual.length - 1].value;
            }
        }
    }

    return base;
};

export const getSupplierTransportCost = (
    supplier: SupplierDistribution,
    supplierAttributes: DbUserAttributes | null | undefined,
    supplierTransport: DbUserTransport | null | undefined,
): number => {
    if (supplier.mod_liv !== 'roll' || supplier.rolls.length === 0 || !supplierAttributes) {
        return 0;
    }

    const carrierId = toNumber(supplierAttributes.t);
    const zoneId = toNumber(supplierAttributes.z);

    const priceMode = toNumber(supplierAttributes.p);

    if (carrierId > 0 && zoneId > 0 && supplierTransport) {
        const rollCount = supplier.rolls.length;
        const baseTariffPerRoll = pickZoneTariff(rollCount, supplierTransport.tariffs ?? {});
        const baseTotal = baseTariffPerRoll * rollCount;
        let adjustedTotal = 0;

        if (priceMode === 1 && rollCount > 0) {
            adjustedTotal = supplier.rolls.reduce((sum, roll) => {
                const ratioToPay = 1 - toFillRatio(toNumber(roll.coef));
                return sum + baseTariffPerRoll * ratioToPay;
            }, 0);
        } else {
            adjustedTotal = baseTariffPerRoll * rollCount;
        }

        const mini = toNumber(supplierTransport.tariffs?.mini);
        if (mini > 0 && baseTotal < mini) {
            adjustedTotal = Math.max(adjustedTotal, mini);
        }

        const taxgoRate = Math.max(0, toNumber(supplierTransport.taxgo));
        const totalWithTaxgo = adjustedTotal * (1 + taxgoRate / 100);
        return roundCurrency(totalWithTaxgo);
    }

    const rollPrice = toNumber(supplierAttributes.l);

    if (rollPrice <= 0) {
        return 0;
    }

    if (priceMode === 0) {
        return roundCurrency(supplier.rolls.length * rollPrice);
    }

    if (priceMode === 1) {
        const total = supplier.rolls.reduce((sum, roll) => {
            const coef = Math.max(0, Math.min(100, toNumber(roll.coef)));
            const ratioToPay = 1 - coef / 100;
            return sum + rollPrice * ratioToPay;
        }, 0);

        return roundCurrency(total);
    }

    return 0;
};

export const calculateCartShipping = (items: CartItem[]): CartShippingSummary => {
    const distribution = buildRollDistribution(items);
    const attrsBySupplier = extractSupplierAttributes(items);
    const transportBySupplier = extractSupplierTransport(items);
    const bySupplier: Record<number, number> = {};

    Object.values(distribution.suppliers).forEach((supplier) => {
        const supplierCost = getSupplierTransportCost(
            supplier,
            attrsBySupplier[supplier.supplierId],
            transportBySupplier[supplier.supplierId],
        );
        bySupplier[supplier.supplierId] = supplierCost;
    });

    const total = roundCurrency(Object.values(bySupplier).reduce((sum, cost) => sum + cost, 0));

    return { bySupplier, total };
};

export const buildCartTransportContext = (items: CartItem[]): CartTransportContext => ({
    attrsBySupplier: extractSupplierAttributes(items),
    transportBySupplier: extractSupplierTransport(items),
});

export const getSupplierRollPrices = (
    supplier: SupplierDistribution,
    supplierAttributes: DbUserAttributes | null | undefined,
    supplierTransport: DbUserTransport | null | undefined,
): number[] | null => {
    if (supplier.mod_liv !== 'roll' || supplier.rolls.length === 0 || !supplierAttributes) {
        return null;
    }

    const priceMode = toNumber(supplierAttributes.p);
    const rollCount = supplier.rolls.length;
    const carrierId = toNumber(supplierAttributes.t);
    const zoneId = toNumber(supplierAttributes.z);

    if (carrierId > 0 && zoneId > 0 && supplierTransport) {
        const baseTariffPerRoll = pickZoneTariff(rollCount, supplierTransport.tariffs ?? {});
        const taxgoRate = Math.max(0, toNumber(supplierTransport.taxgo));
        const baseTotal = baseTariffPerRoll * rollCount;

        const rawRollPrices = supplier.rolls.map((roll) => {
            if (priceMode === 1) {
                const ratioToPay = 1 - toFillRatio(toNumber(roll.coef));
                return baseTariffPerRoll * ratioToPay;
            }

            return baseTariffPerRoll;
        });

        const mini = toNumber(supplierTransport.tariffs?.mini);
        const rawTotal = rawRollPrices.reduce((sum, price) => sum + price, 0);
        let scale = 1;
        if (mini > 0 && baseTotal < mini && rawTotal > 0) {
            scale = mini / rawTotal;
        }

        return rawRollPrices.map((price) => roundCurrency(price * scale * (1 + taxgoRate / 100)));
    }

    const rollPrice = toNumber(supplierAttributes.l);
    if (rollPrice <= 0) {
        return null;
    }

    if (priceMode === 0) {
        return supplier.rolls.map(() => roundCurrency(rollPrice));
    }

    if (priceMode === 1) {
        return supplier.rolls.map((roll) => {
            const ratioToPay = 1 - toFillRatio(toNumber(roll.coef));
            return roundCurrency(rollPrice * ratioToPay);
        });
    }

    return null;
};
