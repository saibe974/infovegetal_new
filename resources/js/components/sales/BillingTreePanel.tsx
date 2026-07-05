import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import SearchSelect from '@/components/app/search-select';
import { ChevronDown, TrashIcon, UserRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useState } from 'react';
import { type ActivePanelItem, type BillingDraft } from '@/components/sales/types';
import { ButtonsActions } from '../buttons-actions';

type Option = {
    description: any; value: string; label: string
};

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
    openSection: 'profiles' | 'sellers' | null;
    onOpenSectionChange: (section: 'profiles' | 'sellers' | null) => void;
    onAddProfile: () => void;
    onDeleteProfile: (profileId: string) => void;
    onAddSeller: (sellerId: number) => void;
    onDeleteSeller: (sellerId: number) => void;
    onImpersonateSeller?: (sellerId: number) => void;
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
    openSection,
    onOpenSectionChange,
    onAddProfile,
    onDeleteProfile,
    onAddSeller,
    onDeleteSeller,
    onImpersonateSeller,
}: BillingTreePanelProps) {
    const { t } = useI18n();

    const [showSellerSearch, setShowSellerSearch] = useState(false);

    const toggleSection = (section: 'profiles' | 'sellers') => {
        onOpenSectionChange(openSection === section ? null : section);
        setActivePanelItem(null);
    };

    return (
        <Card className={`p-6 space-y-4 ${className ?? ''}`}>
            {!activeBillingRule ? (
                <p className="text-sm text-muted-foreground">{t('Select a billing user from the list.')}</p>
            ) : (
                <>
                    <CardHeader className="px-0 pb-2">
                        <CardTitle>{activeBillingLabel}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0 space-y-2">
                        <Collapsible
                            open={openSection === 'profiles'}
                            onOpenChange={() => toggleSection('profiles')}
                            className="rounded-md border border-border"
                        >
                            <CollapsibleTrigger asChild>
                                <div className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-muted transition-colors rounded-md ${openSection === 'profiles' ? 'bg-muted' : ''}`}>
                                    <h3 className="text-lg font-semibold">{t('Profils')}</h3>
                                    <div className="flex items-center gap-1">
                                        {canManageProfiles && openSection === 'profiles' ? (
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <ButtonsActions
                                                    add={() => { onAddProfile(); }}
                                                />
                                            </div>
                                        ) : null}
                                        <ChevronDown
                                            className={`size-4 transition-transform duration-200 ${openSection === 'profiles' ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t border-border px-3 py-3 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
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
                            </CollapsibleContent>
                        </Collapsible>

                        <Collapsible
                            open={openSection === 'sellers'}
                            onOpenChange={() => toggleSection('sellers')}
                            className="rounded-md border border-border"
                        >
                            <CollapsibleTrigger asChild>
                                <div className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-muted transition-colors rounded-md ${openSection === 'sellers' ? 'bg-muted' : ''}`}>
                                    <h3 className="text-lg font-semibold">{t('Commerciaux')}</h3>
                                    <div className="flex items-center gap-1">
                                        {canManageSellers && openSection === 'sellers' ? (
                                            <div onClick={(e) => e.stopPropagation()}>
                                                <ButtonsActions
                                                    add={() => setShowSellerSearch((prev) => !prev)}
                                                />
                                            </div>
                                        ) : null}
                                        <ChevronDown
                                            className={`size-4 transition-transform duration-200 ${openSection === 'sellers' ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t border-border px-3 py-3 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
                                <div className="space-y-3">
                                    {canManageSellers && showSellerSearch ? (
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
                                                    setShowSellerSearch(false);
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
                                                        <span className="font-medium" {...(option?.description ? { title: option.description } : {})}>{option.label}</span>
                                                    </button>
                                                    {onImpersonateSeller ? (
                                                        <ButtonsActions
                                                            impersonate={() => onImpersonateSeller(id)}
                                                        />
                                                    ) : null}
                                                    {canManageSellers ? (
                                                        <ButtonsActions
                                                            delete={() => onDeleteSeller(id)} />

                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </CollapsibleContent>
                        </Collapsible>
                    </CardContent>
                </>
            )}
        </Card>
    );
}
