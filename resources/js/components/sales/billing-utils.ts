import { type BillingDraft } from '@/components/sales/types';
import {
    ensureOrderCsvTemplate,
    normalizeBillingDefaultsToProfiles,
    profilesToBillingDefaults,
} from '@/lib/billing-defaults';
import {
    type BillingUserRule,
    type SalesConditions,
    type SellerDefaults,
    type SellerUserRule,
} from '@/types';

export const normalizeConditions = (
    value: SalesConditions | undefined,
): SalesConditions => {
    if (!value) {
        return {};
    }

    const entries = Object.entries(value).sort(([a], [b]) =>
        a.localeCompare(b),
    );
    return Object.fromEntries(entries);
};

const formatConditionNumber = (value: number): string =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);

export const formatSalesConditionsSummary = (
    conditions: SalesConditions | undefined,
    emptyLabel = 'Vente directe',
): string => {
    const value = conditions ?? {};

    if (value.retro_com === true || Number(value.retro_com ?? 0) === 1) {
        const billingMargin = Number(value.billing_margin ?? 0);
        return Number.isFinite(billingMargin)
            ? `Rétro com · marge facturant ${formatConditionNumber(billingMargin)} %`
            : 'Rétro com';
    }

    const parts: string[] = [];

    if (Number(value.tvap ?? 0) === 1) {
        parts.push('✓ TVA');
    }

    const numericConditions: Array<[keyof SalesConditions, string, string]> = [
        ['m', 'marge', ' %'],
        ['mc', 'MC', ' %'],
        ['me', 'ME', ' %'],
        ['mr', 'MR', ' %'],
        ['mm', 'MMR', ' €'],
        ['pd', 'pond.', ' %'],
    ];

    numericConditions.forEach(([key, label, suffix]) => {
        const numericValue = Number(value[key] ?? 0);
        if (Number.isFinite(numericValue) && numericValue !== 0) {
            parts.push(
                `${label} ${formatConditionNumber(numericValue)}${suffix}`,
            );
        }
    });

    return parts.length > 0 ? parts.join(' · ') : emptyLabel;
};

export const normalizeBillingUsers = (
    rules: BillingDraft[],
): BillingDraft[] => {
    return rules.map((rule) => {
        const defaults = profilesToBillingDefaults(rule.defaults);

        return {
            billing_user_id: Number(rule.billing_user_id),
            defaults: {
                profiles: defaults.profiles.map((profile) => ({
                    id: String(profile.id),
                    name: String(profile.name),
                    conditions: normalizeConditions(profile.conditions),
                })),
                default_profile_id: defaults.default_profile_id ?? null,
                files: defaults.files ?? [],
            },
            sellers: (rule.sellers ?? []).map((seller) => ({
                seller_user_id: Number(seller.seller_user_id),
                conditions: normalizeConditions(seller.conditions),
                use_billing_profile: Boolean(
                    seller.use_billing_profile ?? true,
                ),
                billing_profile_id: seller.billing_profile_id ?? null,
                ...(seller.has_seller_defaults && seller.seller_defaults
                    ? {
                          seller_defaults: profilesToBillingDefaults(
                              seller.seller_defaults,
                          ),
                      }
                    : {}),
                can_manage: Boolean(seller.can_manage ?? false),
            })),
        };
    });
};

export const normalizeRowToDraft = (row: BillingUserRule): BillingDraft => {
    const defaults = ensureOrderCsvTemplate(
        normalizeBillingDefaultsToProfiles(row.defaults),
    );

    return {
        billing_user_id: Number(row.id),
        defaults,
        sellers: (row.sellers ?? []).map((seller: SellerUserRule) => ({
            seller_user_id: Number(seller.id),
            conditions: normalizeConditions(seller.conditions ?? {}),
            use_billing_profile: Boolean(seller.use_billing_profile ?? true),
            billing_profile_id: seller.billing_profile_id ?? null,
            seller_defaults:
                seller.seller_defaults &&
                typeof seller.seller_defaults === 'object' &&
                Array.isArray(
                    (seller.seller_defaults as SellerDefaults).profiles,
                )
                    ? normalizeBillingDefaultsToProfiles(seller.seller_defaults)
                    : undefined,
            has_seller_defaults: Boolean(
                seller.seller_defaults &&
                    typeof seller.seller_defaults === 'object' &&
                    Array.isArray(
                        (seller.seller_defaults as SellerDefaults).profiles,
                    ),
            ),
            can_manage: Boolean(seller.can_manage ?? false),
        })),
    };
};
