import { withAppLayout } from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    type BillingDefaults,
    type BillingUserRule,
    type BreadcrumbItem,
    type SalesConditionProfile,
    type SalesConditions,
    type SellerUserRule,
    type dbProduct,
} from '@/types';
import { FormField } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SearchSelect from '@/components/app/search-select';
import SalesConditionsForm from '@/components/sales/sales-conditions-form';
import { useI18n } from '@/lib/i18n';
import { normalizeBillingDefaultsToProfiles, profilesToBillingDefaults } from '@/lib/billing-defaults';
import products from '@/routes/products';
import dbProducts from '@/routes/db-products';
import { ArrowLeftCircle, SaveIcon, TrashIcon } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import InputError from '@/components/ui/input-error';

type UserOption = { id: number; name: string; email: string };

type Props = {
    dbProduct: dbProduct;
    eligibleBillingUsers: UserOption[];
    eligibleSellerUsers: UserOption[];
    billingAbilities: {
        can_manage_billing_users: boolean;
        can_manage_sellers: boolean;
        can_delegate_manage: boolean;
        is_global_manager: boolean;
    };
    currentUserId: number;
    carriers: Array<{
        id: number;
        name: string;
        country?: string | null;
        zones?: Array<{ id: number; carrier_id: number; name: string }>;
    }>;
};

type SellerDraft = {
    seller_user_id: number;
    conditions_override: SalesConditions;
    can_manage: boolean;
};

type BillingDraft = {
    billing_user_id: number;
    defaults: BillingDefaults;
    sellers: SellerDraft[];
};

type ActivePanelItem = {
    type: 'profile' | 'seller';
    id: string | number;
} | null;

const normalizeConditions = (value: SalesConditions | undefined): SalesConditions => {
    if (!value) {
        return {};
    }

    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
};

const normalizeBillingUsers = (rules: BillingDraft[]): BillingDraft[] => {
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
                conditions_override: normalizeConditions(seller.conditions_override),
                can_manage: Boolean(seller.can_manage ?? false),
            })),
        };
    });
};

const normalizeRowToDraft = (row: BillingUserRule): BillingDraft => {
    const defaults = normalizeBillingDefaultsToProfiles(row.defaults);

    return {
        billing_user_id: Number(row.id),
        defaults,
        sellers: (row.sellers ?? []).map((seller: SellerUserRule) => ({
            seller_user_id: Number(seller.id),
            conditions_override: normalizeConditions(seller.conditions_override ?? {}),
            can_manage: Boolean(seller.can_manage ?? false),
        })),
    };
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
    {
        title: 'Database',
        href: dbProducts.index().url,
    },
    {
        title: 'Billing',
        href: '#',
    },
];

export default withAppLayout<Props>(breadcrumbs, true, ({ dbProduct, eligibleBillingUsers, eligibleSellerUsers, billingAbilities, currentUserId, carriers }) => {
    const { t } = useI18n();
    const isGlobalManager = billingAbilities?.is_global_manager ?? false;
    const canManageBillingUsers = billingAbilities?.can_manage_billing_users ?? false;
    const canManageSellers = billingAbilities?.can_manage_sellers ?? false;
    const canDelegateManage = billingAbilities?.can_delegate_manage ?? false;

    const [billingSearch, setBillingSearch] = useState('');
    const [sellerSearch, setSellerSearch] = useState('');

    const STORAGE_KEY = `db-billing-view-${dbProduct.id}`;

    const loadViewPrefs = (): { billingUserId: number | null; tab: string; panelItem: ActivePanelItem } => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    billingUserId: parsed.billingUserId ?? null,
                    tab: parsed.tab ?? 'predefined',
                    panelItem: parsed.panelItem ?? null,
                };
            }
        } catch { }
        return { billingUserId: null, tab: 'predefined', panelItem: null };
    };

    const initialBillingUsers: BillingDraft[] = useMemo(() => {
        const rows = Array.isArray(dbProduct.billing_users) ? (dbProduct.billing_users as BillingUserRule[]) : [];
        return rows.map(normalizeRowToDraft);
    }, [dbProduct.billing_users]);

    const viewPrefs = useMemo(() => loadViewPrefs(), []);

    const [activeBillingUserId, setActiveBillingUserId] = useState<number | null>(() => {
        if (viewPrefs.billingUserId !== null && initialBillingUsers.some((u) => Number(u.billing_user_id) === Number(viewPrefs.billingUserId))) {
            return viewPrefs.billingUserId;
        }
        return initialBillingUsers.length > 0 ? initialBillingUsers[0].billing_user_id : null;
    });

    const [activeTab, setActiveTab] = useState<string>(() => viewPrefs.tab);

    const [activePanelItem, setActivePanelItem] = useState<ActivePanelItem>(() => viewPrefs.panelItem);

    const { data, setData, put, processing, errors, transform } = useForm({
        billing_users: initialBillingUsers,
    });

    const errorBag = errors as Record<string, string>;

    const billingUserOptions = useMemo(
        () => (eligibleBillingUsers ?? []).map((user) => ({ value: String(user.id), label: `${user.name} (${user.email})` })),
        [eligibleBillingUsers],
    );

    const sellerUserOptions = useMemo(
        () => (eligibleSellerUsers ?? []).map((user) => ({ value: String(user.id), label: `${user.name} (${user.email})` })),
        [eligibleSellerUsers],
    );

    const userOptionById = useMemo(() => {
        return new Map(
            [...(eligibleBillingUsers ?? []), ...(eligibleSellerUsers ?? [])].map((user) => [
                user.id,
                { value: String(user.id), label: `${user.name} (${user.email})` },
            ]),
        );
    }, [eligibleBillingUsers, eligibleSellerUsers]);

    const activeBillingRule = useMemo(() => {
        if (activeBillingUserId === null) {
            return null;
        }

        return (data.billing_users ?? []).find((rule) => Number(rule.billing_user_id) === Number(activeBillingUserId)) ?? null;
    }, [activeBillingUserId, data.billing_users]);

    const availableBillingOptions = useMemo(() => {
        const selected = new Set((data.billing_users ?? []).map((rule) => Number(rule.billing_user_id)));
        return billingUserOptions.filter((option) => !selected.has(Number(option.value)));
    }, [billingUserOptions, data.billing_users]);

    const availableSellerOptions = useMemo(() => {
        const selected = new Set((activeBillingRule?.sellers ?? []).map((seller) => Number(seller.seller_user_id)));
        return sellerUserOptions.filter((option) => !selected.has(Number(option.value)));
    }, [activeBillingRule?.sellers, sellerUserOptions]);

    const updateBillingRule = (billingUserId: number, updater: (rule: BillingDraft) => BillingDraft) => {
        setData('billing_users', (data.billing_users ?? []).map((rule) => {
            if (Number(rule.billing_user_id) !== Number(billingUserId)) {
                return rule;
            }

            return updater(rule);
        }));
    };

    const currentProfile = useMemo(() => {
        if (!activeBillingRule || activePanelItem?.type !== 'profile') {
            return null;
        }

        return (activeBillingRule.defaults.profiles ?? []).find((profile) => profile.id === String(activePanelItem.id)) ?? null;
    }, [activeBillingRule, activePanelItem]);

    const currentSeller = useMemo(() => {
        if (!activeBillingRule || activePanelItem?.type !== 'seller') {
            return null;
        }

        return (activeBillingRule.sellers ?? []).find((seller) => Number(seller.seller_user_id) === Number(activePanelItem.id)) ?? null;
    }, [activeBillingRule, activePanelItem]);

    const canManageProfiles = useMemo(() => {
        if (!activeBillingRule) {
            return false;
        }

        return canManageSellers || Number(activeBillingRule.billing_user_id) === Number(currentUserId);
    }, [activeBillingRule, canManageSellers, currentUserId]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ billingUserId: activeBillingUserId, tab: activeTab, panelItem: activePanelItem }));
        } catch { }
    }, [activeBillingUserId, activeTab, activePanelItem]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        transform((d) => ({
            ...d,
            billing_users: normalizeBillingUsers(d.billing_users ?? []),
        }));

        put(dbProducts.updateBilling(dbProduct.id as number).url, {
            onFinish: () => transform((d) => d),
        });
    };

    return (
        <>
            <Head title={`${t('Billing')} - ${dbProduct.name}`} />

            <div className="space-y-6">
                <form onSubmit={handleSubmit}>
                    <StickyBar className="mb-4 w-full">
                        <div className="flex items-center gap-4 ">
                            <Link
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.history.back();
                                }}
                                className="hover:text-gray-500 transition-colors duration-200"
                            >
                                <ArrowLeftCircle size={35} />
                            </Link>
                            <div className="flex flex-col">
                                <h1 className="text-3xl font-bold capitalize">{dbProduct.name || t('Database')}</h1>
                            </div>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <Button type="submit" disabled={processing}>
                                <SaveIcon size={20} className="mr-2" />
                                {t('Save')}
                            </Button>
                        </div>
                    </StickyBar>

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        {isGlobalManager ? (
                            <Card className="p-6 space-y-4 xl:col-span-3">
                                <FormField label={t('Ajouter un Facturant')}>
                                    <SearchSelect
                                        value={billingSearch}
                                        onChange={setBillingSearch}
                                        onSubmit={(value) => {
                                            const id = Number(value.trim().split(/\s+/).pop() ?? '');
                                            if (!Number.isInteger(id) || id <= 0) {
                                                return;
                                            }

                                            const exists = (data.billing_users ?? []).some((rule) => Number(rule.billing_user_id) === id);
                                            if (exists) {
                                                setBillingSearch('');
                                                return;
                                            }

                                            const nextRules: BillingDraft[] = [
                                                ...(data.billing_users ?? []),
                                                {
                                                    billing_user_id: id,
                                                    defaults: {
                                                        profiles: [{ id: 'standard', name: 'Standard', conditions: {} }],
                                                        default_profile_id: 'standard',
                                                    },
                                                    sellers: [],
                                                },
                                            ];
                                            setData('billing_users', nextRules);
                                            setActiveBillingUserId(id);
                                            setActiveTab('predefined');
                                            setActivePanelItem({ type: 'profile', id: 'standard' });
                                            setBillingSearch('');
                                        }}
                                        propositions={availableBillingOptions}
                                        selection={[]}
                                        loading={false}
                                        minQueryLength={0}
                                    />
                                    <InputError message={errorBag.billing_users} />
                                </FormField>

                                <div className="space-y-2 max-h-[460px] overflow-y-auto">
                                    {(data.billing_users ?? []).map((rule) => {
                                        const id = Number(rule.billing_user_id);
                                        const option = userOptionById.get(id);
                                        if (!option) {
                                            return null;
                                        }

                                        return (
                                            <div key={id} className="flex items-center justify-between gap-2">
                                                <button
                                                    type="button"
                                                    className={`text-left rounded-md px-3 py-2 w-full border ${activeBillingUserId === id ? 'bg-muted border-primary' : 'border-border'}`}
                                                    onClick={() => {
                                                        setActiveBillingUserId(id);
                                                        setActiveTab('predefined');
                                                        setActivePanelItem(null);
                                                    }}
                                                >
                                                    <span className="font-medium">{option.label}</span>
                                                </button>
                                                <Button
                                                    type="button"
                                                    variant="destructive-outline"
                                                    size="icon"
                                                    onClick={() => {
                                                        const next = (data.billing_users ?? []).filter((row) => Number(row.billing_user_id) !== id);
                                                        setData('billing_users', next);
                                                        if (activeBillingUserId === id) {
                                                            const first = next[0];
                                                            setActiveBillingUserId(first ? Number(first.billing_user_id) : null);
                                                            setActivePanelItem(null);
                                                        }
                                                    }}
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        ) : null}

                        <Card className={`p-6 space-y-4 ${isGlobalManager ? 'xl:col-span-4' : 'xl:col-span-5'}`}>
                            {!activeBillingRule ? (
                                <p className="text-sm text-muted-foreground">{t('Select a billing user from the list.')}</p>
                            ) : (
                                <>
                                    <CardHeader className="px-0 pb-2">
                                        <CardTitle>
                                            {userOptionById.get(Number(activeBillingRule.billing_user_id))?.label ?? `#${activeBillingRule.billing_user_id}`}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-0 space-y-5">
                                        <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setActivePanelItem(null); }}>
                                            <TabsList className="grid w-full grid-cols-3">
                                                <TabsTrigger value="predefined">{t('Prédéfinie')}</TabsTrigger>
                                                <TabsTrigger value="commercial">{t('Commerciaux')}</TabsTrigger>
                                                <TabsTrigger value="users">{t('Users')}</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="predefined" className="space-y-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <h3 className="text-sm font-semibold">{t('Conditions predefinies')}</h3>
                                                    {canManageProfiles ? (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                const nextId = `profile-${Date.now()}`;
                                                                updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => {
                                                                    const profile: SalesConditionProfile = {
                                                                        id: nextId,
                                                                        name: t('New profile'),
                                                                        conditions: {},
                                                                    };
                                                                    const profiles = [...(rule.defaults.profiles ?? []), profile];
                                                                    return {
                                                                        ...rule,
                                                                        defaults: {
                                                                            profiles,
                                                                            default_profile_id: rule.defaults.default_profile_id ?? profile.id,
                                                                        },
                                                                    };
                                                                });
                                                                setActivePanelItem({ type: 'profile', id: nextId });
                                                            }}
                                                        >
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
                                                                    onClick={() => {
                                                                        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => {
                                                                            const profiles = (rule.defaults.profiles ?? []).filter((current) => current.id !== profile.id);
                                                                            const default_profile_id =
                                                                                rule.defaults.default_profile_id === profile.id
                                                                                    ? (profiles[0]?.id ?? null)
                                                                                    : rule.defaults.default_profile_id;

                                                                            return {
                                                                                ...rule,
                                                                                defaults: {
                                                                                    profiles,
                                                                                    default_profile_id,
                                                                                },
                                                                            };
                                                                        });

                                                                        if (activePanelItem?.type === 'profile' && String(activePanelItem.id) === profile.id) {
                                                                            setActivePanelItem(null);
                                                                        }
                                                                    }}
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="commercial" className="space-y-3">
                                                {/* <div className="flex items-center justify-between gap-2">
                                                    <h3 className="text-sm font-semibold">{t('Vendeurs / commerciaux')}</h3>
                                                    {canManageSellers ? (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                const id = Number(sellerSearch.trim().split(/\s+/).pop() ?? '');
                                                                if (!Number.isInteger(id) || id <= 0) {
                                                                    return;
                                                                }

                                                                updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => {
                                                                    const exists = (rule.sellers ?? []).some((seller) => Number(seller.seller_user_id) === id);
                                                                    if (exists) {
                                                                        return rule;
                                                                    }

                                                                    return {
                                                                        ...rule,
                                                                        sellers: [...(rule.sellers ?? []), { seller_user_id: id, conditions_override: {}, can_manage: false }],
                                                                    };
                                                                });
                                                                setActivePanelItem({ type: 'seller', id });
                                                                setSellerSearch('');
                                                            }}
                                                        >
                                                            + {t('Add')}
                                                        </Button>
                                                    ) : null}
                                                </div> */}

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

                                                                updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => {
                                                                    const exists = (rule.sellers ?? []).some((seller) => Number(seller.seller_user_id) === id);
                                                                    if (exists) {
                                                                        return rule;
                                                                    }

                                                                    return {
                                                                        ...rule,
                                                                        sellers: [...(rule.sellers ?? []), { seller_user_id: id, conditions_override: {}, can_manage: false }],
                                                                    };
                                                                });
                                                                setActivePanelItem({ type: 'seller', id });
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
                                                                        onClick={() => {
                                                                            updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
                                                                                ...rule,
                                                                                sellers: (rule.sellers ?? []).filter((current) => Number(current.seller_user_id) !== id),
                                                                            }));

                                                                            if (activePanelItem?.type === 'seller' && Number(activePanelItem.id) === id) {
                                                                                setActivePanelItem(null);
                                                                            }
                                                                        }}
                                                                    >
                                                                        <TrashIcon className="h-4 w-4" />
                                                                    </Button>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </TabsContent>

                                            <TabsContent value="users">
                                                <p className="text-sm text-muted-foreground">{t('À développer')}</p>
                                            </TabsContent>
                                        </Tabs>
                                    </CardContent>
                                </>
                            )}
                        </Card>

                        {activeBillingRule && ((activePanelItem?.type === 'profile' && currentProfile) || (activePanelItem?.type === 'seller' && currentSeller)) ? (
                            <Card className={`p-6 space-y-4 ${isGlobalManager ? 'xl:col-span-5' : 'xl:col-span-7'}`}>
                                {!activeBillingRule ? (
                                    <p className="text-sm text-muted-foreground">{t('Select a billing user to edit profiles and seller conditions.')}</p>
                                ) : activePanelItem?.type === 'profile' && currentProfile ? (
                                <>
                                    <CardHeader className="px-0">
                                        <div className="flex items-center gap-5 align-middle px-0">
                                            {t('Condition predefinie')}&nbsp;-&nbsp;
                                            <FormField label=''>
                                                <input
                                                    className="w-full rounded-md border px-3 py-2"
                                                    value={currentProfile.name}
                                                    disabled={!canManageProfiles}
                                                    onChange={(e) => {
                                                        if (!canManageProfiles) {
                                                            return;
                                                        }

                                                        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
                                                            ...rule,
                                                            defaults: {
                                                                ...rule.defaults,
                                                                profiles: (rule.defaults.profiles ?? []).map((profile) => {
                                                                    if (profile.id !== currentProfile.id) {
                                                                        return profile;
                                                                    }

                                                                    return {
                                                                        ...profile,
                                                                        name: e.target.value,
                                                                    };
                                                                }),
                                                            },
                                                        }));
                                                    }}
                                                />
                                            </FormField>
                                        </div>
                                    </CardHeader>


                                    <CardContent className="px-0 space-y-4">


                                        <SalesConditionsForm
                                            value={currentProfile.conditions ?? {}}
                                            onChange={(next) => {
                                                if (!canManageProfiles) {
                                                    return;
                                                }

                                                updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
                                                    ...rule,
                                                    defaults: {
                                                        ...rule.defaults,
                                                        profiles: (rule.defaults.profiles ?? []).map((profile) => {
                                                            if (profile.id !== currentProfile.id) {
                                                                return profile;
                                                            }

                                                            return {
                                                                ...profile,
                                                                conditions: normalizeConditions(next),
                                                            };
                                                        }),
                                                    },
                                                }));
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
                                            {t('Condition vendeur')} - {userOptionById.get(Number(currentSeller.seller_user_id))?.label ?? `#${currentSeller.seller_user_id}`}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-0">
                                        {canDelegateManage ? (
                                            <label className="mb-4 flex items-center gap-2 text-sm">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(currentSeller.can_manage)}
                                                    onChange={(e) => {
                                                        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
                                                            ...rule,
                                                            sellers: (rule.sellers ?? []).map((seller) => {
                                                                if (Number(seller.seller_user_id) !== Number(currentSeller.seller_user_id)) {
                                                                    return seller;
                                                                }

                                                                return {
                                                                    ...seller,
                                                                    can_manage: e.target.checked,
                                                                };
                                                            }),
                                                        }));
                                                    }}
                                                />
                                                <span>{t('Peut gerer cette DB')}</span>
                                            </label>
                                        ) : null}

                                        <SalesConditionsForm
                                            value={currentSeller.conditions_override ?? {}}
                                            onChange={(next) => {
                                                updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
                                                    ...rule,
                                                    sellers: (rule.sellers ?? []).map((seller) => {
                                                        if (Number(seller.seller_user_id) !== Number(currentSeller.seller_user_id)) {
                                                            return seller;
                                                        }

                                                        return {
                                                            ...seller,
                                                            conditions_override: normalizeConditions(next),
                                                        };
                                                    }),
                                                }));
                                            }}
                                            carriers={carriers ?? []}
                                            mode="override"
                                        />
                                    </CardContent>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground">{t('Select a profile or seller to edit conditions.')}</p>
                            )}
                            </Card>
                        ) : null}
                    </div>
                </form>
            </div>
        </>
    );
});
