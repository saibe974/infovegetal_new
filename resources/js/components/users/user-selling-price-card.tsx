import EditableProfileTitle from '@/components/sales/EditableProfileTitle';
import SellerProfilesPanel from '@/components/sales/SellerProfilesPanel';
import { SellingPriceRuleForm } from '@/components/users/selling-price-rule-form';
import { useI18n } from '@/lib/i18n';
import {
    DEFAULT_SELLING_PRICE_RULE,
    type SellingPriceProfile,
    type SellingPriceSettings,
} from '@/lib/selling-price';
import { useEffect, useMemo, useState } from 'react';

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
