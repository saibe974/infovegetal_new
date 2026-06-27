import type { BillingDefaults, SalesConditionProfile, SalesConditions } from '@/types';

const normalizeConditions = (value: SalesConditions | undefined): SalesConditions => {
    if (!value) {
        return {};
    }

    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
};

const toProfileId = (seed: string, index: number): string => {
    const base = seed
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (base.length > 0) {
        return base;
    }

    return `profile-${index + 1}`;
};

export const normalizeBillingDefaultsToProfiles = (value: BillingDefaults | SalesConditions | undefined): BillingDefaults => {
    if (!value || typeof value !== 'object') {
        return {
            profiles: [
                {
                    id: 'standard',
                    name: 'Standard',
                    conditions: {},
                },
            ],
            default_profile_id: 'standard',
        };
    }

    const maybeProfiles = (value as BillingDefaults).profiles;
    if (Array.isArray(maybeProfiles)) {
        const profiles: SalesConditionProfile[] = maybeProfiles
            .filter((profile) => typeof profile === 'object' && profile !== null)
            .map((profile, index) => {
                const name = String(profile.name ?? `Profile ${index + 1}`);
                return {
                    id: String(profile.id ?? toProfileId(name, index)),
                    name,
                    conditions: normalizeConditions(profile.conditions ?? {}),
                };
            });

        if (profiles.length === 0) {
            profiles.push({ id: 'standard', name: 'Standard', conditions: {} });
        }

        const requestedDefault = (value as BillingDefaults).default_profile_id;
        const default_profile_id = profiles.some((profile) => profile.id === requestedDefault)
            ? requestedDefault ?? profiles[0].id
            : profiles[0].id;

        return { profiles, default_profile_id };
    }

    return {
        profiles: [
            {
                id: 'standard',
                name: 'Standard',
                conditions: normalizeConditions(value as SalesConditions),
            },
        ],
        default_profile_id: 'standard',
    };
};

export const profilesToBillingDefaults = (value: BillingDefaults): BillingDefaults => {
    const normalized = normalizeBillingDefaultsToProfiles(value);

    return {
        profiles: normalized.profiles.map((profile, index) => ({
            id: String(profile.id || toProfileId(profile.name, index)),
            name: String(profile.name || `Profile ${index + 1}`),
            conditions: normalizeConditions(profile.conditions ?? {}),
        })),
        default_profile_id: normalized.default_profile_id ?? null,
    };
};
