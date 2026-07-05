import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { ButtonsActions } from '../buttons-actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SalesConditionsForm from '@/components/sales/sales-conditions-form';
import { type ActivePanelItem, type BillingDraft, type SellerDraft } from '@/components/sales/types';
import { type BillingDefaults, type SalesConditionProfile, type SalesConditions } from '@/types';
import { TrashIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useEffect } from 'react';

type Option = { value: string; label: string };

type BillingConditionsEditorProps = {
    className?: string;
    activeBillingRule: BillingDraft | null;
    activePanelItem: ActivePanelItem;
    currentProfile: SalesConditionProfile | null;
    currentSeller: SellerDraft | null;
    currentSellerDefaults: BillingDefaults | null;
    currentSellerProfile: SalesConditionProfile | null;
    currentSellerInheritedProfile: SalesConditionProfile | null;
    canManageProfiles: boolean;
    canManageSellerProfiles: boolean;
    canDelegateManage: boolean;
    carriers: Array<{ id: number; name: string; country?: string | null; zones?: Array<{ id: number; carrier_id: number; name: string }> }>;
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
            currentSeller.use_billing_profile
            && !currentSeller.billing_profile_id
            && !currentSellerInheritedProfile?.id
        ) {
            onChangeSellerBillingProfile(profiles[0].id);
        }
    }, [currentSeller, profiles, currentSellerInheritedProfile?.id, onChangeSellerBillingProfile]);

    return (
        <Card className={`p-6 space-y-4 ${className ?? ''}`}>
            {!activeBillingRule ? (
                <p className="text-sm text-muted-foreground">{t('Select a billing user to edit profiles and seller conditions.')}</p>
            ) : activePanelItem?.type === 'profile' && currentProfile ? (
                <>
                    <CardContent className="px-0 space-y-4">

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
                    <CardHeader className="px-0">
                        <CardTitle>
                            {userOptionById.get(Number(currentSeller.seller_user_id))?.label ?? `#${currentSeller.seller_user_id}`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-0 space-y-6">
                        {canDelegateManage ? (
                            <div className="space-y-2">
                                <label className="mb-4 flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={Boolean(currentSeller.can_manage)}
                                        onChange={(e) => onToggleSellerCanManage(e.target.checked)}
                                    />
                                    <span>{t('Peut gerer cette DB')}</span>
                                </label>
                            </div>
                        ) : null}

                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold">{t('A. Conditions facturant')}</h3>

                            <Select value={!currentSeller.use_billing_profile
                                ? '__custom__'
                                : (currentSeller.billing_profile_id ?? currentSellerInheritedProfile?.id ?? (profiles[0]?.id ?? '__custom__'))}
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
                                    <SelectItem value="__custom__">{t('Paramétrage custom')}</SelectItem>
                                    {profiles.map((profile) => (
                                        <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {!currentSeller.use_billing_profile ? (
                                <SalesConditionsForm
                                    value={currentSeller.conditions ?? {}}
                                    onChange={(next) => onChangeSellerCustomConditions(next)}
                                    carriers={carriers ?? []}
                                    mode="override"
                                />
                            ) : null}
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">{t('B. Profils commercial')}</h3>
                                {canManageSellerProfiles ? (
                                    <ButtonsActions
                                        add={onAddSellerProfile}
                                    />
                                ) : null}
                            </div>

                            <div className="space-y-2 max-h-[220px] overflow-y-auto">
                                {(currentSellerDefaults?.profiles ?? []).map((profile) => (
                                    <div key={profile.id} className="flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            className={`text-left rounded-md px-3 py-2 w-full border ${currentSellerProfile?.id === profile.id ? 'bg-muted border-primary' : 'border-border'}`}
                                            onClick={() => setActiveSellerProfileId(profile.id)}
                                        >
                                            <span className="font-medium">{profile.name}</span>
                                        </button>
                                        {canManageSellerProfiles ? (
                                            <Button
                                                type="button"
                                                variant="destructive-outline"
                                                size="icon"
                                                onClick={() => onDeleteSellerProfile(profile.id)}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
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

                                            onRenameSellerProfile(e.target.value);
                                        }}
                                    />

                                    <SalesConditionsForm
                                        value={currentSellerProfile.conditions ?? {}}
                                        onChange={(next) => {
                                            if (!canManageSellerProfiles) {
                                                return;
                                            }

                                            onChangeSellerProfileConditions(next);
                                        }}
                                        carriers={carriers ?? []}
                                        mode="defaults"
                                    />
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">{t('Aucun profil commercial défini.')}</p>
                            )}
                        </div>
                    </CardContent>
                </>
            ) : (
                <p className="text-sm text-muted-foreground">{t('Select a profile or seller to edit conditions.')}</p>
            )
            }
        </Card >
    );
}
