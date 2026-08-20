import SearchSelect from '@/components/app/search-select';
import {
    type ActivePanelItem,
    type BillingDraft,
} from '@/components/sales/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { FormField } from '@/components/ui/form-field';
import { useI18n } from '@/lib/i18n';
import { ChevronDown, TrashIcon } from 'lucide-react';
import { useState } from 'react';
import { ButtonsActions } from '../buttons-actions';

type Option = {
    description: any;
    value: string;
    label: string;
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
        <Card className={`space-y-4 p-6 ${className ?? ''}`}>
            {!activeBillingRule ? (
                <p className="text-sm text-muted-foreground">
                    {t('Select a billing user from the list.')}
                </p>
            ) : (
                <>
                    <CardHeader className="px-0 pb-2">
                        <CardTitle>{activeBillingLabel}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 px-0">
                        <Collapsible
                            open={openSection === 'profiles'}
                            onOpenChange={() => toggleSection('profiles')}
                            className="rounded-md border border-border"
                        >
                            <CollapsibleTrigger asChild>
                                <div
                                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 transition-colors hover:bg-muted ${openSection === 'profiles' ? 'bg-muted' : ''}`}
                                >
                                    <h3 className="text-lg font-semibold">
                                        {t('Profils')}
                                    </h3>
                                    <div className="flex items-center gap-1">
                                        {canManageProfiles &&
                                            openSection === 'profiles' ? (
                                            <ButtonsActions
                                                add={() => {
                                                    onAddProfile();
                                                }}
                                            />
                                        ) : null}
                                        <ChevronDown
                                            className={`size-4 transition-transform duration-200 ${openSection === 'profiles' ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t border-border px-3 py-3 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
                                <div className="max-h-[220px] space-y-2 overflow-y-auto">
                                    {(
                                        activeBillingRule.defaults.profiles ??
                                        []
                                    ).map((profile) => (
                                        <div
                                            key={profile.id}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <button
                                                type="button"
                                                className={`w-full rounded-md border px-3 py-2 text-left ${activePanelItem?.type === 'profile' && String(activePanelItem.id) === profile.id ? 'border-primary bg-muted' : 'border-border'}`}
                                                onClick={() =>
                                                    setActivePanelItem({
                                                        type: 'profile',
                                                        id: profile.id,
                                                    })
                                                }
                                            >
                                                <span className="font-medium">
                                                    {profile.name}
                                                </span>
                                            </button>
                                            {canManageProfiles ? (
                                                <Button
                                                    type="button"
                                                    variant="destructive-outline"
                                                    size="icon"
                                                    onClick={() =>
                                                        onDeleteProfile(
                                                            profile.id,
                                                        )
                                                    }
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
                            className="rounded-md border border-blue-200/80 bg-blue-50/60 dark:border-blue-400/25 dark:bg-blue-500/10"
                        >
                            <CollapsibleTrigger asChild>
                                <div
                                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 transition-colors hover:bg-blue-100/70 dark:hover:bg-blue-500/15 ${openSection === 'sellers' ? 'bg-blue-100/70 dark:bg-blue-500/15' : ''}`}
                                >
                                    <h3 className="text-lg font-semibold">
                                        {t('Commerciaux')}
                                    </h3>
                                    <div className="flex items-center gap-1">
                                        {canManageSellers &&
                                            openSection === 'sellers' ? (
                                            <ButtonsActions
                                                add={() =>
                                                    setShowSellerSearch(
                                                        (prev) => !prev,
                                                    )
                                                }
                                            />
                                        ) : null}
                                        <ChevronDown
                                            className={`size-4 transition-transform duration-200 ${openSection === 'sellers' ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="border-t border-blue-200/80 px-3 py-3 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 dark:border-blue-400/25">
                                <div className="space-y-3">
                                    {canManageSellers && showSellerSearch ? (
                                        <FormField
                                            label={t('Ajouter un commercial')}
                                        >
                                            <SearchSelect
                                                value={sellerSearch}
                                                onChange={setSellerSearch}
                                                onSubmit={(value) => {
                                                    const id = Number(
                                                        value
                                                            .trim()
                                                            .split(/\s+/)
                                                            .pop() ?? '',
                                                    );
                                                    if (
                                                        !Number.isInteger(id) ||
                                                        id <= 0
                                                    ) {
                                                        return;
                                                    }

                                                    onAddSeller(id);
                                                    setSellerSearch('');
                                                    setShowSellerSearch(false);
                                                }}
                                                propositions={
                                                    availableSellerOptions
                                                }
                                                selection={[]}
                                                loading={false}
                                                minQueryLength={0}
                                            />
                                        </FormField>
                                    ) : null}

                                    <div className="max-h-[220px] space-y-2 overflow-y-auto">
                                        {(activeBillingRule.sellers ?? []).map(
                                            (seller) => {
                                                const id = Number(
                                                    seller.seller_user_id,
                                                );
                                                const option =
                                                    userOptionById.get(id);
                                                if (!option) {
                                                    return null;
                                                }

                                                return (
                                                    <div
                                                        key={id}
                                                        className="flex items-center justify-between gap-2"
                                                    >
                                                        <button
                                                            type="button"
                                                            className={`w-full rounded-md border bg-background/80 px-3 py-2 text-left ${activePanelItem?.type === 'seller' && Number(activePanelItem.id) === id ? 'border-blue-500 bg-blue-100 dark:border-blue-400/40 dark:bg-blue-500/15' : 'border-blue-200/80 dark:border-blue-400/25'}`}
                                                            onClick={() =>
                                                                setActivePanelItem(
                                                                    {
                                                                        type: 'seller',
                                                                        id,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            <span
                                                                className="font-medium"
                                                                {...(option?.description
                                                                    ? {
                                                                        title: option.description,
                                                                    }
                                                                    : {})}
                                                            >
                                                                {option.label}
                                                            </span>
                                                        </button>
                                                        {onImpersonateSeller ? (
                                                            <ButtonsActions
                                                                impersonate={() =>
                                                                    onImpersonateSeller(
                                                                        id,
                                                                    )
                                                                }
                                                            />
                                                        ) : null}
                                                        {canManageSellers ? (
                                                            <ButtonsActions
                                                                delete={() =>
                                                                    onDeleteSeller(
                                                                        id,
                                                                    )
                                                                }
                                                            />
                                                        ) : null}
                                                    </div>
                                                );
                                            },
                                        )}
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
