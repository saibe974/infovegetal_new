import SalesConditionsForm from '@/components/sales/sales-conditions-form';
import {
    type ActivePanelItem,
    type BillingDraft,
    type SellerDraft,
} from '@/components/sales/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';
import {
    type BillingDefaults,
    type SalesConditionProfile,
    type SalesConditions,
} from '@/types';
import { TrashIcon, UserIcon } from 'lucide-react';
import { useEffect } from 'react';
import { ButtonsActions } from '../buttons-actions';

type Option = { value: string; label: string };

type BillingConditionsEditorProps = {
    className?: string;
    activeBillingRule: BillingDraft | null;
    activeBillingLabel: string;
    activePanelItem: ActivePanelItem;
    currentProfile: SalesConditionProfile | null;
    currentSeller: SellerDraft | null;
    currentSellerDefaults: BillingDefaults | null;
    currentSellerProfile: SalesConditionProfile | null;
    currentSellerInheritedProfile: SalesConditionProfile | null;
    canManageProfiles: boolean;
    canManageSellerProfiles: boolean;
    canDelegateManage: boolean;
    carriers: Array<{
        id: number;
        name: string;
        country?: string | null;
        zones?: Array<{ id: number; carrier_id: number; name: string }>;
    }>;
    userOptionById: Map<number, Option>;
    setActiveSellerProfileId: (value: string | null) => void;
    onRenameBillingProfile: (value: string) => void;
    onChangeBillingProfileConditions: (value: SalesConditions) => void;
    onToggleSellerCanManage: (checked: boolean) => void;
    onChangeSellerUseBillingProfile: (useBillingProfile: boolean) => void;
    onChangeSellerBillingProfile: (billingProfileId: string | null) => void;
    onChangeSellerCustomConditions: (value: SalesConditions) => void;
    onAddSellerProfile: () => void;
    onDeleteSellerProfile: (profileId: string) => void;
    onRenameSellerProfile: (value: string) => void;
    onChangeSellerProfileConditions: (value: SalesConditions) => void;
};

export default function BillingConditionsEditor({
    className,
    activeBillingRule,
    activeBillingLabel,
    activePanelItem,
    currentProfile,
    currentSeller,
    currentSellerDefaults,
    currentSellerProfile,
    currentSellerInheritedProfile,
    canManageProfiles,
    canManageSellerProfiles,
    canDelegateManage,
    carriers,
    userOptionById,
    setActiveSellerProfileId,
    onRenameBillingProfile,
    onChangeBillingProfileConditions,
    onToggleSellerCanManage,
    onChangeSellerUseBillingProfile,
    onChangeSellerBillingProfile,
    onChangeSellerCustomConditions,
    onAddSellerProfile,
    onDeleteSellerProfile,
    onRenameSellerProfile,
    onChangeSellerProfileConditions,
}: BillingConditionsEditorProps) {
    const { t } = useI18n();

    const profiles = activeBillingRule?.defaults.profiles ?? [];

    useEffect(() => {
        if (!currentSeller || profiles.length === 0) {
            return;
        }

        if (
            currentSeller.use_billing_profile &&
            !currentSeller.billing_profile_id &&
            !currentSellerInheritedProfile?.id
        ) {
            onChangeSellerBillingProfile(profiles[0].id);
        }
    }, [
        currentSeller,
        profiles,
        currentSellerInheritedProfile?.id,
        onChangeSellerBillingProfile,
    ]);

    return (
        <Card
            className={`space-y-4 p-6 ${activePanelItem?.type === 'seller' ? 'border-blue-200/80 bg-blue-50/60 dark:border-blue-400/25 dark:bg-blue-500/10' : ''} ${className ?? ''}`}
        >
            {!activeBillingRule ? (
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Select a billing user to edit profiles and seller conditions.',
                    )}
                </p>
            ) : activePanelItem?.type === 'profile' && currentProfile ? (
                <>
                    <CardContent className="space-y-4 px-0">
                        <input
                            className="w-full rounded-md border px-3 py-2"
                            value={currentProfile.name}
                            disabled={!canManageProfiles}
                            onChange={(e) => {
                                if (!canManageProfiles) {
                                    return;
                                }

                                onRenameBillingProfile(e.target.value);
                            }}
                        />

                        <SalesConditionsForm
                            value={currentProfile.conditions ?? {}}
                            onChange={(next) => {
                                if (!canManageProfiles) {
                                    return;
                                }

                                onChangeBillingProfileConditions(next);
                            }}
                            carriers={carriers ?? []}
                            mode="defaults"
                        />
                    </CardContent>
                </>
            ) : activePanelItem?.type === 'seller' && currentSeller ? (
                <>
                    <CardHeader className="flex flex-row items-start justify-between gap-3 rounded-md border border-blue-200/80 bg-blue-100/70 px-4 py-3 dark:border-blue-400/30 dark:bg-blue-500/15">
                        <CardTitle className="flex items-center gap-2">
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                            <span>
                                {userOptionById.get(
                                    Number(currentSeller.seller_user_id),
                                )?.label ?? `#${currentSeller.seller_user_id}`}
                            </span>
                        </CardTitle>
                        {canDelegateManage ? (
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm">
                                    <Input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={Boolean(
                                            currentSeller.can_manage,
                                        )}
                                        onChange={(e) =>
                                            onToggleSellerCanManage(
                                                e.target.checked,
                                            )
                                        }
                                    />
                                    <span>{t('Peut gerer cette DB')}</span>
                                </label>
                            </div>
                        ) : null}
                    </CardHeader>

                    <CardContent className="space-y-6 px-0">
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold">
                                {activeBillingLabel} {t('vend à')} {userOptionById.get(
                                    Number(currentSeller.seller_user_id),
                                )?.label ?? `#${currentSeller.seller_user_id}`} {t('sous le profil')}
                            </h3>

                            <Select
                                value={
                                    !currentSeller.use_billing_profile
                                        ? '__custom__'
                                        : (currentSeller.billing_profile_id ??
                                            currentSellerInheritedProfile?.id ??
                                            profiles[0]?.id ??
                                            '__custom__')
                                }
                                onValueChange={(v) => {
                                    if (v === '__custom__') {
                                        onChangeSellerUseBillingProfile(false);
                                    } else {
                                        onChangeSellerUseBillingProfile(true);
                                        onChangeSellerBillingProfile(v);
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__custom__">
                                        {t('Paramétrage custom')}
                                    </SelectItem>
                                    {profiles.map((profile) => (
                                        <SelectItem
                                            key={profile.id}
                                            value={profile.id}
                                        >
                                            {profile.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {!currentSeller.use_billing_profile ? (
                                <SalesConditionsForm
                                    value={currentSeller.conditions ?? {}}
                                    onChange={(next) =>
                                        onChangeSellerCustomConditions(next)
                                    }
                                    carriers={carriers ?? []}
                                    mode="override"
                                />
                            ) : null}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">
                                    {t('Profils de ')} {userOptionById.get(
                                        Number(currentSeller.seller_user_id),
                                    )?.label ?? `#${currentSeller.seller_user_id}`}
                                </h3>
                                {canManageSellerProfiles ? (
                                    <ButtonsActions add={onAddSellerProfile} />
                                ) : null}
                            </div>

                            <div className="max-h-[220px] space-y-2 overflow-y-auto">
                                {(currentSellerDefaults?.profiles ?? []).map(
                                    (profile) => (
                                        <div
                                            key={profile.id}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <button
                                                type="button"
                                                className={`w-full rounded-md border px-3 py-2 text-left ${currentSellerProfile?.id === profile.id ? 'border-primary bg-muted' : 'border-border'}`}
                                                onClick={() =>
                                                    setActiveSellerProfileId(
                                                        profile.id,
                                                    )
                                                }
                                            >
                                                <span className="font-medium">
                                                    {profile.name}
                                                </span>
                                            </button>
                                            {canManageSellerProfiles ? (
                                                <Button
                                                    type="button"
                                                    variant="destructive-outline"
                                                    size="icon"
                                                    onClick={() =>
                                                        onDeleteSellerProfile(
                                                            profile.id,
                                                        )
                                                    }
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </Button>
                                            ) : null}
                                        </div>
                                    ),
                                )}
                            </div>

                            {currentSellerProfile ? (
                                <div className="space-y-3 rounded-md border p-3">
                                    <input
                                        className="w-full rounded-md border px-3 py-2"
                                        value={currentSellerProfile.name}
                                        disabled={!canManageSellerProfiles}
                                        onChange={(e) => {
                                            if (!canManageSellerProfiles) {
                                                return;
                                            }

                                            onRenameSellerProfile(
                                                e.target.value,
                                            );
                                        }}
                                    />

                                    <SalesConditionsForm
                                        value={
                                            currentSellerProfile.conditions ??
                                            {}
                                        }
                                        onChange={(next) => {
                                            if (!canManageSellerProfiles) {
                                                return;
                                            }

                                            onChangeSellerProfileConditions(
                                                next,
                                            );
                                        }}
                                        carriers={carriers ?? []}
                                        mode="defaults"
                                    />
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {t('Aucun profil commercial défini.')}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {t('Select a profile or seller to edit conditions.')}
                </p>
            )}
        </Card>
    );
}
