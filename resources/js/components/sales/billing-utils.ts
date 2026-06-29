import {
    type BillingUserRule,
    type SalesConditions,
    type SellerDefaults,
    type SellerUserRule,
} from '@/types';
import { normalizeBillingDefaultsToProfiles, profilesToBillingDefaults } from '@/lib/billing-defaults';
import { type BillingDraft } from '@/components/sales/types';

export const normalizeConditions = (value: SalesConditions | undefined): SalesConditions => {
    if (!value) {
        return {};
    }

    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
};

export const normalizeBillingUsers = (rules: BillingDraft[]): BillingDraft[] => {
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
            },
            sellers: (rule.sellers ?? []).map((seller) => ({
                seller_user_id: Number(seller.seller_user_id),
                conditions: normalizeConditions(seller.conditions),
                use_billing_profile: Boolean(seller.use_billing_profile ?? true),
                billing_profile_id: seller.billing_profile_id ?? null,
                ...(seller.has_seller_defaults && seller.seller_defaults ? { seller_defaults: profilesToBillingDefaults(seller.seller_defaults) } : {}),
                can_manage: Boolean(seller.can_manage ?? false),
            })),
        };
    });
};

export const normalizeRowToDraft = (row: BillingUserRule): BillingDraft => {
    const defaults = normalizeBillingDefaultsToProfiles(row.defaults);

    return {
        billing_user_id: Number(row.id),
        defaults,
        sellers: (row.sellers ?? []).map((seller: SellerUserRule) => ({
            seller_user_id: Number(seller.id),
            conditions: normalizeConditions(seller.conditions ?? {}),
            use_billing_profile: Boolean(seller.use_billing_profile ?? true),
            billing_profile_id: seller.billing_profile_id ?? null,
            seller_defaults: seller.seller_defaults && typeof seller.seller_defaults === 'object' && Array.isArray((seller.seller_defaults as SellerDefaults).profiles)
                ? normalizeBillingDefaultsToProfiles(seller.seller_defaults)
                : undefined,
            has_seller_defaults: Boolean(
                seller.seller_defaults
                && typeof seller.seller_defaults === 'object'
                && Array.isArray((seller.seller_defaults as SellerDefaults).profiles),
            ),
            can_manage: Boolean(seller.can_manage ?? false),
        })),
    };
};
