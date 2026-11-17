import { resolveProductPrices } from '@/lib/resolve-product-prices';
import type { Product } from '@/types';

type PricingTier = 'roll' | 'floor' | 'tray' | 'unit';

export type CartPricing = {
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
    const normalized = String(value ?? '')
        .trim()
        .toLowerCase();
    return (
        normalized === '1' ||
        normalized === 'price_render' ||
        normalized === 'price_rendu' ||
        normalized === 'render' ||
        normalized === 'rendered' ||
        normalized === 'rendu'
    );
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
    const rollSize =
        cond > 0 && floor > 0 && roll > 0 ? cond * floor * roll : 0;

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

    unitPrice = replaceRenderedDeliveryInPrice(
        product,
        unitPrice,
        options.renderedDeliveryPerRoll,
    );

    const lineTotal = unitPrice * qty;

    return {
        unitPrice,
        lineTotal,
        tier,
    };
};

export const replaceRenderedDeliveryInPrice = (
    product: Product,
    unitPrice: number,
    deliveryPerRoll?: number | null,
): number => {
    const rollSize = Math.max(
        0,
        toNumber(product.cond) *
            toNumber(product.floor) *
            toNumber(product.roll),
    );
    const attributes = product.db_user_attributes;
    if (
        deliveryPerRoll !== undefined &&
        deliveryPerRoll !== null &&
        attributes &&
        typeof attributes === 'object' &&
        !Array.isArray(attributes) &&
        isRenderedPriceMode((attributes as Record<string, unknown>).p) &&
        rollSize > 0
    ) {
        const oldDeliveryPerRoll = Math.max(
            0,
            toNumber((attributes as Record<string, unknown>).l),
        );
        const newDeliveryPerRoll = Math.max(0, deliveryPerRoll);
        const weighting = toNumber((attributes as Record<string, unknown>).pd);
        const weightingFactor = 1 - weighting / 100;
        const deliveryDeltaPerUnit =
            (newDeliveryPerRoll - oldDeliveryPerRoll) / rollSize;

        // PriceCalculatorService applies delivery before weighting, so the replacement
        // must follow the same order to stay aligned with server-side product pricing.
        unitPrice = Math.max(
            0,
            unitPrice +
                (weightingFactor > 0
                    ? deliveryDeltaPerUnit / weightingFactor
                    : deliveryDeltaPerUnit),
        );
        unitPrice = Math.round(unitPrice * 100) / 100;
    }

    return unitPrice;
};

export type PurchaseBasesPerUnit = {
    /** Prix d'achat unitaire sans aucune part de transport. */
    excludingTransport: number;
    /** Prix d'achat unitaire avec sa part du transport du fournisseur. */
    includingTransport: number;
    /**
     * Achat au prix rendu : prix unitaire payé (transport inclus dans le prix),
     * c.-à-d. le prix transport inclus si le transport facturé en plus était nul.
     * `null` pour un achat au prix départ.
     */
    renderedPrice: number | null;
};

/**
 * Prix d'achat unitaires hors transport / transport inclus d'un groupe
 * fournisseur, quel que soit le mode d'achat (départ ou rendu).
 *
 * Transport inclus = prix unitaire payé (qui contient déjà le transport en
 * mode rendu) + part du transport facturé du groupe. Le transport facturé est
 * réparti au prorata de la place occupée sur les rolls
 * (quantité / taille d'un roll), ou de la valeur hors transport si une taille
 * de roll manque.
 */
export const getPurchaseBasesPerUnit = (
    items: Array<{ product: Product; quantity: number; pricing: CartPricing }>,
    deliveryTotal: number,
): Record<number, PurchaseBasesPerUnit> => {
    const rows = items
        .filter((item) => item.quantity > 0)
        .map((item) => {
            const excluding = getCartPricing(item.product, item.quantity, {
                renderedDeliveryPerRoll: 0,
            }).unitPrice;
            const rollSize =
                toNumber(item.product.cond) *
                toNumber(item.product.floor) *
                toNumber(item.product.roll);

            return {
                id: item.product.id,
                quantity: item.quantity,
                excluding,
                paid: item.pricing.lineTotal,
                rollShare: rollSize > 0 ? item.quantity / rollSize : 0,
            };
        });

    const transportTotal = Math.max(0, deliveryTotal);
    const useRollShare = rows.every((row) => row.rollShare > 0);
    const weightOf = (row: (typeof rows)[number]) =>
        useRollShare ? row.rollShare : row.excluding * row.quantity;
    const weightTotal = rows.reduce((sum, row) => sum + weightOf(row), 0);

    return Object.fromEntries(
        rows.map((row) => {
            const share =
                weightTotal > 0
                    ? (transportTotal * weightOf(row)) / weightTotal
                    : 0;

            return [
                row.id,
                {
                    excludingTransport: row.excluding,
                    includingTransport: (row.paid + share) / row.quantity,
                    renderedPrice:
                        row.paid / row.quantity > row.excluding + 0.0001
                            ? row.paid / row.quantity
                            : null,
                },
            ];
        }),
    );
};
