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

const pickZoneTariff = (rollCount: number, tariffs: Record<string, number | string | null>): number => {
    if (rollCount <= 0) {
        return 0;
    }

    const entries = Object.entries(tariffs)
        .map(([key, value]) => ({ key: key.replace(/^roll:/, ''), value: toNumber(value) }))
        .filter((entry) => entry.key !== 'mini')
        .map((entry) => ({ threshold: Number(entry.key), value: entry.value }))
        .filter((entry) => Number.isFinite(entry.threshold) && entry.threshold > 0)
        .sort((a, b) => a.threshold - b.threshold);

    let base = 0;

    if (entries.length > 0) {
        const lowerOrEqual = entries.filter((entry) => entry.threshold <= rollCount);
        if (lowerOrEqual.length > 0) {
            base = lowerOrEqual[lowerOrEqual.length - 1].value;
        }
    }

    const mini = toNumber(tariffs.mini);
    if (mini > 0 && base < mini) {
        base = mini;
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
        const baseTariff = pickZoneTariff(rollCount, supplierTransport.tariffs ?? {});
        let adjustedTariff = baseTariff;

        if (priceMode === 1 && rollCount > 0) {
            const perRollTariff = baseTariff / rollCount;
            adjustedTariff = supplier.rolls.reduce((sum, roll) => {
                const coef = Math.max(0, Math.min(100, toNumber(roll.coef)));
                const ratioToPay = 1 - coef / 100;
                return sum + perRollTariff * ratioToPay;
            }, 0);
        }

        const taxgoRate = Math.max(0, toNumber(supplierTransport.taxgo));
        const totalWithTaxgo = adjustedTariff * (1 + taxgoRate / 100);
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
