import type { CartItem } from './cart.context';
import { buildRollDistribution, type SupplierDistribution } from '@/components/products/product-roll';

type DbUserAttributes = Record<string, unknown>;

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

export const getSupplierTransportCost = (
    supplier: SupplierDistribution,
    supplierAttributes: DbUserAttributes | null | undefined,
): number => {
    if (supplier.mod_liv !== 'roll' || supplier.rolls.length === 0 || !supplierAttributes) {
        return 0;
    }

    const priceMode = toNumber(supplierAttributes.p);
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
    const bySupplier: Record<number, number> = {};

    Object.values(distribution.suppliers).forEach((supplier) => {
        const supplierCost = getSupplierTransportCost(supplier, attrsBySupplier[supplier.supplierId]);
        bySupplier[supplier.supplierId] = supplierCost;
    });

    const total = roundCurrency(Object.values(bySupplier).reduce((sum, cost) => sum + cost, 0));

    return { bySupplier, total };
};
