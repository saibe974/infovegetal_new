import EditableProfileTitle from '@/components/sales/EditableProfileTitle';
import SellerProfilesPanel from '@/components/sales/SellerProfilesPanel';
import {
    DEFAULT_SELLING_PRICE_RULE,
    SellingPriceRuleForm,
    type SellingPriceRule,
} from '@/components/users/selling-price-rule-form';
import { useI18n } from '@/lib/i18n';
import { useEffect, useMemo, useState } from 'react';

export type SellingPriceProfile = {
    id: string;
    name: string;
    conditions: SellingPriceRule;
};

export type SellingPriceSettings = {
    profiles: SellingPriceProfile[];
    default_profile_id: string | null;
};

const EMPTY: SellingPriceSettings = { profiles: [], default_profile_id: null };

/** Décode la valeur brute du users_meta `selling_price`. */
export function parseSellingPrice(
    raw: string | null | undefined,
): SellingPriceSettings {
    if (!raw) return EMPTY;

    try {
        const decoded = JSON.parse(raw);
        if (!decoded || !Array.isArray(decoded.profiles)) return EMPTY;

        const profiles: SellingPriceProfile[] = decoded.profiles.map(
            (profile: Partial<SellingPriceProfile>, index: number) => ({
                id: String(profile.id ?? `profile-${index + 1}`),
                name: String(profile.name ?? `Profil ${index + 1}`),
                conditions: {
                    ...DEFAULT_SELLING_PRICE_RULE,
                    ...(profile.conditions ?? {}),
                },
            }),
        );

        return {
            profiles,
            default_profile_id:
                decoded.default_profile_id ?? profiles[0]?.id ?? null,
        };
    } catch {
        return EMPTY;
    }
}

type Props = {
    userId: number;
    value: SellingPriceSettings;
    onChange: (value: SellingPriceSettings) => void;
    canManage?: boolean;
    className?: string;
};

/**
 * Profils de prix de vente d'un client (revente des produits achetés sur la
 * plateforme). Liste des profils commune aux profils commerciaux, règle de
 * calcul simplifiée (voir _docs/selling-price.md).
 */
export function UserSellingPriceCard({
    userId,
    value,
    onChange,
    canManage = true,
    className,
}: Props) {
    const { t } = useI18n();
    const [activeProfileId, setActiveProfileId] = useState<string | null>(
        value.profiles[0]?.id ?? null,
    );

    const currentProfile = useMemo(
        () =>
            value.profiles.find((profile) => profile.id === activeProfileId) ??
            null,
        [value.profiles, activeProfileId],
    );

    useEffect(() => {
        if (
            activeProfileId &&
            !value.profiles.some((profile) => profile.id === activeProfileId)
        ) {
            setActiveProfileId(value.profiles[0]?.id ?? null);
        }
    }, [value.profiles, activeProfileId]);

    const addProfile = () => {
        const id = `selling-profile-${Date.now()}`;
        onChange({
            profiles: [
                ...value.profiles,
                {
                    id,
                    name: t('New profile'),
                    conditions: { ...DEFAULT_SELLING_PRICE_RULE },
                },
            ],
            default_profile_id: value.default_profile_id ?? id,
        });
        setActiveProfileId(id);
    };

    const deleteProfile = (profileId: string) => {
        const profiles = value.profiles.filter(
            (profile) => profile.id !== profileId,
        );
        onChange({
            profiles,
            default_profile_id:
                value.default_profile_id === profileId
                    ? (profiles[0]?.id ?? null)
                    : value.default_profile_id,
        });
    };

    const updateCurrent = (patch: Partial<SellingPriceProfile>) => {
        if (!currentProfile) return;
        onChange({
            ...value,
            profiles: value.profiles.map((profile) =>
                profile.id === currentProfile.id
                    ? { ...profile, ...patch }
                    : profile,
            ),
        });
    };

    return (
        <SellerProfilesPanel
            className={className}
            title={t('Prix de vente')}
            emptyLabel={t('Aucun profil de prix de vente défini.')}
            currentSeller={{ seller_user_id: userId }}
            currentSellerDefaults={value}
            currentSellerProfile={null}
            activeSellerProfileId={activeProfileId}
            setActiveSellerProfileId={setActiveProfileId}
            canManageSellerProfiles={canManage}
            onAddSellerProfile={addProfile}
            onDeleteSellerProfile={deleteProfile}
        >
            {currentProfile ? (
                <div className="space-y-4 border-t pt-4">
                    <EditableProfileTitle
                        name={currentProfile.name}
                        canEdit={canManage}
                        onRename={(name) => updateCurrent({ name })}
                    />
                    <SellingPriceRuleForm
                        value={currentProfile.conditions}
                        onChange={(conditions) => updateCurrent({ conditions })}
                        disabled={!canManage}
                    />
                </div>
            ) : null}
        </SellerProfilesPanel>
    );
}
