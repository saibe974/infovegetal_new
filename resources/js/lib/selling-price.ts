/**
 * Prix de vente client (users_meta `selling_price`) : types, normalisation et
 * calcul. Voir _docs/selling-price.md.
 */

export type SellingPriceRule = {
    /**
     * Prix d'achat de base, quel que soit le mode d'achat (départ ou rendu) :
     * hors transport, ou transport inclus (transport du fournisseur réparti).
     */
    base: 'excluding_transport' | 'including_transport';
    operator: 'add' | 'multiply';
    value: number;
    unit: 'amount' | 'percent';
    rounding: 'unit' | 'tenth' | 'hundredth';
    direction: 'up' | 'down';
};

export type SellingPriceProfile = {
    id: string;
    name: string;
    conditions: SellingPriceRule;
};

export type SellingPriceSettings = {
    profiles: SellingPriceProfile[];
    default_profile_id: string | null;
};

export const DEFAULT_SELLING_PRICE_RULE: SellingPriceRule = {
    base: 'excluding_transport',
    operator: 'multiply',
    value: 1,
    unit: 'amount',
    rounding: 'hundredth',
    direction: 'up',
};

const EMPTY: SellingPriceSettings = { profiles: [], default_profile_id: null };

const ROUNDING_FACTOR: Record<SellingPriceRule['rounding'], number> = {
    unit: 1,
    tenth: 10,
    hundredth: 100,
};

/**
 * + : base + valeur (ou base × valeur %)
 * × : base × valeur (ou base × valeur / 100)
 * puis arrondi à l'unité / dixième / centième, supérieur ou inférieur.
 */
export function computeSellingPrice(
    basePrice: number,
    rule: SellingPriceRule,
): number {
    const amount =
        rule.unit === 'percent' ? (basePrice * rule.value) / 100 : rule.value;
    const raw =
        rule.operator === 'add'
            ? basePrice + amount
            : rule.unit === 'percent'
              ? amount
              : basePrice * amount;
    const factor = ROUNDING_FACTOR[rule.rounding];
    // Correction des erreurs de flottant avant ceil/floor (ex. 1.1 * 100)
    const scaled = Math.round(raw * factor * 1e6) / 1e6;

    return (
        (rule.direction === 'up' ? Math.ceil(scaled) : Math.floor(scaled)) /
        factor
    );
}

/** Anciennes valeurs de `base` (premier format enregistré). */
const LEGACY_BASES: Record<string, SellingPriceRule['base']> = {
    departure: 'excluding_transport',
    selling: 'including_transport',
};

function normalizeRule(raw: unknown): SellingPriceRule {
    const rule = {
        ...DEFAULT_SELLING_PRICE_RULE,
        ...((raw as Partial<SellingPriceRule> | null) ?? {}),
    };
    const value = Number(String(rule.value).replace(',', '.'));

    return {
        ...rule,
        base: LEGACY_BASES[rule.base] ?? rule.base,
        value: Number.isFinite(value) ? value : 0,
    };
}

/** Normalise une valeur déjà décodée (prop serveur ou JSON parsé). */
export function normalizeSellingPrice(decoded: unknown): SellingPriceSettings {
    const value = decoded as Partial<SellingPriceSettings> | null;
    if (!value || !Array.isArray(value.profiles)) return EMPTY;

    const profiles = value.profiles.map(
        (profile: Partial<SellingPriceProfile>, index: number) => ({
            id: String(profile.id ?? `profile-${index + 1}`),
            name: String(profile.name ?? `Profil ${index + 1}`),
            conditions: normalizeRule(profile.conditions),
        }),
    );

    return {
        profiles,
        default_profile_id: value.default_profile_id ?? profiles[0]?.id ?? null,
    };
}

/** Décode la valeur brute du users_meta `selling_price`. */
export function parseSellingPrice(
    raw: string | null | undefined,
): SellingPriceSettings {
    if (!raw) return EMPTY;

    try {
        return normalizeSellingPrice(JSON.parse(raw));
    } catch {
        return EMPTY;
    }
}
