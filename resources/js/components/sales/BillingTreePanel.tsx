import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Separator } from '@/components/ui/separator';
import SearchSelect from '@/components/app/search-select';
import { TrashIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { type ActivePanelItem, type BillingDraft } from '@/components/sales/types';

type Option = { value: string; label: string };

type BillingTreePanelProps = {
    className?: string;
    activeBillingRule: BillingDraft | null;
    activeBillingLabel: string;
    activePanelItem: ActivePanelItem;
    setActivePanelItem: (value: ActivePanelItem) => void;
    canManageProfiles: boolean;
    canManageSellers: boolean;
    sellerSearch: string;
    setSellerSearch: (value: string) => void;
    availableSellerOptions: Option[];
    userOptionById: Map<number, Option>;
    onAddProfile: () => void;
    onDeleteProfile: (profileId: string) => void;
    onAddSeller: (sellerId: number) => void;
    onDeleteSeller: (sellerId: number) => void;
};

export default function BillingTreePanel({
    className,
    activeBillingRule,
    activeBillingLabel,
    activePanelItem,
    setActivePanelItem,
    canManageProfiles,
    canManageSellers,
    sellerSearch,
    setSellerSearch,
    availableSellerOptions,
    userOptionById,
    onAddProfile,
    onDeleteProfile,
    onAddSeller,
    onDeleteSeller,
}: BillingTreePanelProps) {
    const { t } = useI18n();

    return (
        <Card className={`p-6 space-y-4 ${className ?? ''}`}>
            {!activeBillingRule ? (
                <p className="text-sm text-muted-foreground">{t('Select a billing user from the list.')}</p>
            ) : (
                <>
                    <CardHeader className="px-0 pb-2">
                        <CardTitle>{activeBillingLabel}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0 space-y-5">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">{t('Profils du facturant')}</h3>
                                {canManageProfiles ? (
                                    <Button type="button" size="sm" variant="outline" onClick={onAddProfile}>
                                        + {t('Add')}
                                    </Button>
                                ) : null}
                            </div>

                            <div className="space-y-2 max-h-[220px] overflow-y-auto">
                                {(activeBillingRule.defaults.profiles ?? []).map((profile) => (
                                    <div key={profile.id} className="flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            className={`text-left rounded-md px-3 py-2 w-full border ${activePanelItem?.type === 'profile' && String(activePanelItem.id) === profile.id ? 'bg-muted border-primary' : 'border-border'}`}
                                            onClick={() => setActivePanelItem({ type: 'profile', id: profile.id })}
                                        >
                                            <span className="font-medium">{profile.name}</span>
                                        </button>
                                        {canManageProfiles ? (
                                            <Button
                                                type="button"
                                                variant="destructive-outline"
                                                size="icon"
                                                onClick={() => onDeleteProfile(profile.id)}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold">{t('Commerciaux du facturant')}</h3>

                            {canManageSellers ? (
                                <FormField label={t('Ajouter un commercial')}>
                                    <SearchSelect
                                        value={sellerSearch}
                                        onChange={setSellerSearch}
                                        onSubmit={(value) => {
                                            const id = Number(value.trim().split(/\s+/).pop() ?? '');
                                            if (!Number.isInteger(id) || id <= 0) {
                                                return;
                                            }

                                            onAddSeller(id);
                                            setSellerSearch('');
                                        }}
                                        propositions={availableSellerOptions}
                                        selection={[]}
                                        loading={false}
                                        minQueryLength={0}
                                    />
                                </FormField>
                            ) : null}

                            <div className="space-y-2 max-h-[220px] overflow-y-auto">
                                {(activeBillingRule.sellers ?? []).map((seller) => {
                                    const id = Number(seller.seller_user_id);
                                    const option = userOptionById.get(id);
                                    if (!option) {
                                        return null;
                                    }

                                    return (
                                        <div key={id} className="flex items-center justify-between gap-2">
                                            <button
                                                type="button"
                                                className={`text-left rounded-md px-3 py-2 w-full border ${activePanelItem?.type === 'seller' && Number(activePanelItem.id) === id ? 'bg-muted border-primary' : 'border-border'}`}
                                                onClick={() => setActivePanelItem({ type: 'seller', id })}
                                            >
                                                <span className="font-medium">{option.label}</span>
                                            </button>
                                            {canManageSellers ? (
                                                <Button
                                                    type="button"
                                                    variant="destructive-outline"
                                                    size="icon"
                                                    onClick={() => onDeleteSeller(id)}
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </Button>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </CardContent>
                </>
            )}
        </Card>
    );
}
