import { withAppLayout } from '@/layouts/app-layout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { leave as impersonateLeave, take as impersonateTake } from '@/actions/App/Http/Controllers/ImpersonationController';
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem as BreadcrumbItemUI,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
    type BreadcrumbItem,
    type dbProduct,
    type BillingUserRule,
    type SalesConditions,
} from '@/types';
import { Button } from '@/components/ui/button';
import { StickyBar } from '@/components/ui/sticky-bar';
import { useI18n } from '@/lib/i18n';
import products from '@/routes/products';
import dbProducts from '@/routes/db-products';
import { ArrowLeftCircle, SaveIcon } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import BillingUserSelector from '@/components/sales/BillingUserSelector';
import BillingTreePanel from '@/components/sales/BillingTreePanel';
import SellerProfilesPanel from '@/components/sales/SellerProfilesPanel';
import BillingConditionsEditor from '@/components/sales/BillingConditionsEditor';
import SellerProfileConditionsEditor from '@/components/sales/SellerProfileConditionsEditor';
import { normalizeConditions, normalizeBillingUsers, normalizeRowToDraft } from '@/components/sales/billing-utils';
import { normalizeBillingDefaultsToProfiles } from '@/lib/billing-defaults';
import {
    type ActivePanelItem,
    type BillingDraft,
    type UserOption,
} from '@/components/sales/types';
import CountryFlag from '@/components/ui/country-flag';

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
    // console.log(dbProduct);
    const { t } = useI18n();
    const auth = usePage<any>().props.auth;
    const isGlobalManager = billingAbilities?.is_global_manager ?? false;
    const isBillingUser = Array.isArray(dbProduct.billing_users) && dbProduct.billing_users.some((u: BillingUserRule) => Number(u.id) === Number(currentUserId));
    const isFullAccess = isGlobalManager || isBillingUser;
    const canManageBillingUsers = billingAbilities?.can_manage_billing_users ?? false;
    const canManageSellers = billingAbilities?.can_manage_sellers ?? false;
    const canDelegateManage = billingAbilities?.can_delegate_manage ?? false;

    const [billingSearch, setBillingSearch] = useState('');
    const [sellerSearch, setSellerSearch] = useState('');

    const STORAGE_KEY = `db-billing-view-${dbProduct.id}`;

    const loadViewPrefs = (): { billingUserId: number | null; panelItem: ActivePanelItem; openSection: 'profiles' | 'sellers' | null; sellerProfileId: string | null } => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    billingUserId: parsed.billingUserId ?? null,
                    panelItem: parsed.panelItem ?? null,
                    openSection: parsed.openSection ?? 'profiles',
                    sellerProfileId: parsed.sellerProfileId ?? null,
                };
            }
        } catch { }
        return { billingUserId: null, panelItem: null, openSection: 'profiles', sellerProfileId: null };
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

    const [activePanelItem, setActivePanelItem] = useState<ActivePanelItem>(() => viewPrefs.panelItem);
    const [openSection, setOpenSection] = useState<'profiles' | 'sellers' | null>(() => viewPrefs.openSection);
    const [activeSellerProfileId, setActiveSellerProfileId] = useState<string | null>(() => viewPrefs.sellerProfileId);

    const { data, setData, put, processing, errors, transform } = useForm({
        billing_users: initialBillingUsers,
    });

    const errorBag = errors as Record<string, string>;

    const billingUserOptions = useMemo(
        () => (eligibleBillingUsers ?? []).map((user) => ({
            value: String(user.id),
            label: user.name,
            description: user.email
        })),
        [eligibleBillingUsers],
    );

    const sellerUserOptions = useMemo(
        () => (eligibleSellerUsers ?? []).map((user) => ({
            value: String(user.id),
            label: user.name,
            description: user.email
        })),
        [eligibleSellerUsers],
    );

    const userOptionById = useMemo(() => {
        return new Map(
            [...(eligibleBillingUsers ?? []), ...(eligibleSellerUsers ?? [])].map((user) => [
                user.id,
                {
                    value: String(user.id),
                    label: user.name,
                    description: user.email
                },
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

    const currentSellerDefaults = useMemo(() => {
        if (!currentSeller) {
            return null;
        }

        return normalizeBillingDefaultsToProfiles(currentSeller.seller_defaults);
    }, [currentSeller]);

    const currentSellerInheritedProfile = useMemo(() => {
        if (!activeBillingRule) {
            return null;
        }

        const defaults = normalizeBillingDefaultsToProfiles(activeBillingRule.defaults);
        const defaultProfileId = defaults.default_profile_id ?? defaults.profiles[0]?.id;

        return defaults.profiles.find((profile) => profile.id === defaultProfileId) ?? defaults.profiles[0] ?? null;
    }, [activeBillingRule]);

    const currentSellerProfile = useMemo(() => {
        if (!currentSellerDefaults) {
            return null;
        }

        const requestedId = activeSellerProfileId ?? currentSellerDefaults.default_profile_id ?? currentSellerDefaults.profiles[0]?.id ?? null;
        if (!requestedId) {
            return null;
        }

        return currentSellerDefaults.profiles.find((profile) => profile.id === requestedId) ?? currentSellerDefaults.profiles[0] ?? null;
    }, [activeSellerProfileId, currentSellerDefaults]);

    const canManageSellerProfiles = useMemo(() => {
        if (!currentSeller) {
            return false;
        }

        return canManageSellers || Number(currentSeller.seller_user_id) === Number(currentUserId);
    }, [canManageSellers, currentSeller, currentUserId]);

    useEffect(() => {
        if (!currentSellerDefaults) {
            setActiveSellerProfileId(null);
            return;
        }

        const hasActiveProfile = !!activeSellerProfileId
            && (currentSellerDefaults.profiles ?? []).some((profile) => profile.id === activeSellerProfileId);

        if (hasActiveProfile) {
            return;
        }

        const nextId = currentSellerDefaults.default_profile_id ?? currentSellerDefaults.profiles[0]?.id ?? null;
        setActiveSellerProfileId(nextId);
    }, [currentSellerDefaults, activeSellerProfileId]);

    const canManageProfiles = useMemo(() => {
        if (!activeBillingRule) {
            return false;
        }

        return canManageSellers || Number(activeBillingRule.billing_user_id) === Number(currentUserId);
    }, [activeBillingRule, canManageSellers, currentUserId]);

    useEffect(() => {
        if (isFullAccess || !activeBillingRule) {
            return;
        }

        const ownSeller = (activeBillingRule.sellers ?? []).find((seller) => Number(seller.seller_user_id) === Number(currentUserId));
        const fallbackSeller = ownSeller ?? (activeBillingRule.sellers ?? [])[0] ?? null;

        if (!fallbackSeller) {
            if (activePanelItem !== null) {
                setActivePanelItem(null);
            }
            return;
        }

        if (activePanelItem?.type !== 'seller' || Number(activePanelItem.id) !== Number(fallbackSeller.seller_user_id)) {
            setActivePanelItem({ type: 'seller', id: Number(fallbackSeller.seller_user_id) });
        }
    }, [isFullAccess, activeBillingRule, currentUserId, activePanelItem]);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ billingUserId: activeBillingUserId, panelItem: activePanelItem, openSection, sellerProfileId: activeSellerProfileId }));
        } catch { }
    }, [activeBillingUserId, activePanelItem, openSection, activeSellerProfileId]);

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

    const billingLabel = activeBillingRule
        ? (userOptionById.get(Number(activeBillingRule.billing_user_id))?.label ?? `#${activeBillingRule.billing_user_id}`)
        : '';

    const addBillingUser = (id: number) => {
        const exists = (data.billing_users ?? []).some((rule) => Number(rule.billing_user_id) === id);
        if (exists) {
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
        setActivePanelItem({ type: 'profile', id: 'standard' });
    };

    const deleteBillingUser = (id: number) => {
        const next = (data.billing_users ?? []).filter((row) => Number(row.billing_user_id) !== id);
        setData('billing_users', next);

        if (activeBillingUserId === id) {
            const first = next[0];
            setActiveBillingUserId(first ? Number(first.billing_user_id) : null);
            setActivePanelItem(null);
        }
    };

    const addBillingProfile = () => {
        if (!activeBillingRule) {
            return;
        }

        const nextId = `profile-${Date.now()}`;
        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => {
            const profile = {
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
    };

    const deleteBillingProfile = (profileId: string) => {
        if (!activeBillingRule) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => {
            const profiles = (rule.defaults.profiles ?? []).filter((current) => current.id !== profileId);
            const default_profile_id =
                rule.defaults.default_profile_id === profileId
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

        if (activePanelItem?.type === 'profile' && String(activePanelItem.id) === profileId) {
            setActivePanelItem(null);
        }
    };

    const handleImpersonateSeller = async (sellerId: number) => {
        const isImpersonating = !!auth?.impersonate_from;

        try {
            if (isImpersonating) {
                const leaveRes = await fetch(impersonateLeave().url, {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' },
                });
                if (!leaveRes.ok) throw new Error('Unable to leave impersonation');
            }

            const takeRes = await fetch(impersonateTake({ id: sellerId }).url, {
                method: 'GET',
                credentials: 'include',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            if (!takeRes.ok) throw new Error('Impersonation failed');

            window.location.reload();
        } catch {
            // silently fail; impersonation errors handled server-side
        }
    };

    const addSellerToBilling = (sellerId: number) => {
        if (!activeBillingRule) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => {
            const exists = (rule.sellers ?? []).some((seller) => Number(seller.seller_user_id) === sellerId);
            if (exists) {
                return rule;
            }

            return {
                ...rule,
                sellers: [...(rule.sellers ?? []), { seller_user_id: sellerId, conditions: {}, use_billing_profile: true, billing_profile_id: null, can_manage: false, seller_defaults: undefined }],
            };
        });

        setActivePanelItem({ type: 'seller', id: sellerId });
    };

    const deleteSellerFromBilling = (sellerId: number) => {
        if (!activeBillingRule) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
            ...rule,
            sellers: (rule.sellers ?? []).filter((current) => Number(current.seller_user_id) !== sellerId),
        }));

        if (activePanelItem?.type === 'seller' && Number(activePanelItem.id) === sellerId) {
            setActivePanelItem(null);
        }
    };

    const addSellerProfile = () => {
        if (!activeBillingRule || !currentSeller) {
            return;
        }

        const nextId = `seller-profile-${Date.now()}`;
        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
            ...rule,
            sellers: (rule.sellers ?? []).map((seller) => {
                if (Number(seller.seller_user_id) !== Number(currentSeller.seller_user_id)) {
                    return seller;
                }

                const defaults = normalizeBillingDefaultsToProfiles(seller.seller_defaults);
                const profiles = [...defaults.profiles, { id: nextId, name: t('New profile'), conditions: {} }];

                return {
                    ...seller,
                    has_seller_defaults: true,
                    seller_defaults: {
                        profiles,
                        default_profile_id: defaults.default_profile_id ?? nextId,
                    },
                };
            }),
        }));

        setActiveSellerProfileId(nextId);
    };

    const deleteSellerProfile = (profileId: string) => {
        if (!activeBillingRule || !currentSeller) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
            ...rule,
            sellers: (rule.sellers ?? []).map((seller) => {
                if (Number(seller.seller_user_id) !== Number(currentSeller.seller_user_id)) {
                    return seller;
                }

                const defaults = normalizeBillingDefaultsToProfiles(seller.seller_defaults);
                const profiles = defaults.profiles.filter((current) => current.id !== profileId);
                return {
                    ...seller,
                    has_seller_defaults: true,
                    seller_defaults: {
                        profiles,
                        default_profile_id: defaults.default_profile_id === profileId ? (profiles[0]?.id ?? null) : defaults.default_profile_id,
                    },
                };
            }),
        }));

        if (currentSellerProfile?.id === profileId) {
            setActiveSellerProfileId(null);
        }
    };

    const renameBillingProfile = (name: string) => {
        if (!activeBillingRule || !currentProfile) {
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
                        name,
                    };
                }),
            },
        }));
    };

    const changeBillingProfileConditions = (next: SalesConditions) => {
        if (!activeBillingRule || !currentProfile) {
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
    };

    const toggleSellerCanManage = (checked: boolean) => {
        if (!activeBillingRule || !currentSeller) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
            ...rule,
            sellers: (rule.sellers ?? []).map((seller) => {
                if (Number(seller.seller_user_id) !== Number(currentSeller.seller_user_id)) {
                    return seller;
                }

                return {
                    ...seller,
                    can_manage: checked,
                };
            }),
        }));
    };

    const changeSellerUseBillingProfile = (useProfile: boolean) => {
        if (!activeBillingRule || !currentSeller) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
            ...rule,
            sellers: (rule.sellers ?? []).map((seller) => Number(seller.seller_user_id) === Number(currentSeller.seller_user_id)
                ? { ...seller, use_billing_profile: useProfile, billing_profile_id: useProfile ? (seller.billing_profile_id ?? currentSellerInheritedProfile?.id ?? null) : null }
                : seller),
        }));
    };

    const changeSellerBillingProfile = (profileId: string | null) => {
        if (!activeBillingRule || !currentSeller) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
            ...rule,
            sellers: (rule.sellers ?? []).map((seller) => Number(seller.seller_user_id) === Number(currentSeller.seller_user_id)
                ? { ...seller, billing_profile_id: profileId, use_billing_profile: true }
                : seller),
        }));
    };

    const changeSellerCustomConditions = (next: SalesConditions) => {
        if (!activeBillingRule || !currentSeller) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
            ...rule,
            sellers: (rule.sellers ?? []).map((seller) => {
                if (Number(seller.seller_user_id) !== Number(currentSeller.seller_user_id)) {
                    return seller;
                }

                return {
                    ...seller,
                    use_billing_profile: false,
                    conditions: normalizeConditions(next),
                };
            }),
        }));
    };

    const renameSellerProfile = (name: string) => {
        if (!activeBillingRule || !currentSeller || !currentSellerProfile) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
            ...rule,
            sellers: (rule.sellers ?? []).map((seller) => {
                if (Number(seller.seller_user_id) !== Number(currentSeller.seller_user_id)) {
                    return seller;
                }

                const defaults = normalizeBillingDefaultsToProfiles(seller.seller_defaults);
                return {
                    ...seller,
                    has_seller_defaults: true,
                    seller_defaults: {
                        ...defaults,
                        profiles: defaults.profiles.map((profile) => profile.id === currentSellerProfile.id
                            ? { ...profile, name }
                            : profile),
                    },
                };
            }),
        }));
    };

    const changeSellerProfileConditions = (next: SalesConditions) => {
        if (!activeBillingRule || !currentSeller || !currentSellerProfile) {
            return;
        }

        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
            ...rule,
            sellers: (rule.sellers ?? []).map((seller) => {
                if (Number(seller.seller_user_id) !== Number(currentSeller.seller_user_id)) {
                    return seller;
                }

                const defaults = normalizeBillingDefaultsToProfiles(seller.seller_defaults);
                return {
                    ...seller,
                    has_seller_defaults: true,
                    seller_defaults: {
                        ...defaults,
                        profiles: defaults.profiles.map((profile) => profile.id === currentSellerProfile.id
                            ? { ...profile, conditions: normalizeConditions(next) }
                            : profile),
                    },
                };
            }),
        }));
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
                                <Breadcrumb>
                                    <BreadcrumbList>
                                        <BreadcrumbItemUI>
                                            <CountryFlag countryCode={dbProduct.country} title={dbProduct.country} className="w-4" />
                                        </BreadcrumbItemUI>
                                        <BreadcrumbItemUI>
                                            <BreadcrumbPage className="text-3xl font-bold capitalize">{dbProduct.name || t('Database')}</BreadcrumbPage>
                                        </BreadcrumbItemUI>
                                        {activeBillingRule && (
                                            <>
                                                <BreadcrumbSeparator />
                                                <BreadcrumbItemUI>
                                                    <BreadcrumbPage className="text-3xl font-bold">{billingLabel}</BreadcrumbPage>
                                                </BreadcrumbItemUI>
                                            </>
                                        )}
                                        {activePanelItem && (
                                            <>
                                                <BreadcrumbSeparator />
                                                <BreadcrumbItemUI>
                                                    <BreadcrumbPage className="text-3xl font-bold">
                                                        {activePanelItem.type === 'profile'
                                                            ? (currentProfile?.name ?? t('Profile'))
                                                            : (userOptionById.get(Number(activePanelItem.id))?.label ?? t('Commercial'))
                                                        }
                                                    </BreadcrumbPage>
                                                </BreadcrumbItemUI>
                                            </>
                                        )}
                                        {activeSellerProfileId && currentSellerProfile && (
                                            <>
                                                <BreadcrumbSeparator />
                                                <BreadcrumbItemUI>
                                                    <BreadcrumbPage className="text-3xl font-bold">{currentSellerProfile.name}</BreadcrumbPage>
                                                </BreadcrumbItemUI>
                                            </>
                                        )}
                                    </BreadcrumbList>
                                </Breadcrumb>
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
                        {isFullAccess && (
                            <BillingUserSelector
                                className="xl:col-span-3"
                                billingUsers={data.billing_users ?? []}
                                activeBillingUserId={activeBillingUserId}
                                userOptionById={userOptionById}
                                billingSearch={billingSearch}
                                setBillingSearch={setBillingSearch}
                                availableBillingOptions={availableBillingOptions}
                                canManageBillingUsers={canManageBillingUsers}
                                onSelectBillingUser={(id) => {
                                    setActiveBillingUserId(id);
                                    setActivePanelItem(null);
                                }}
                                onAddBillingUser={addBillingUser}
                                onDeleteBillingUser={deleteBillingUser}
                                onImpersonateBillingUser={handleImpersonateSeller}
                                errors={errorBag}
                            />
                        )}

                        {isFullAccess ? (
                            <BillingTreePanel
                                className="xl:col-span-4"
                                activeBillingRule={activeBillingRule}
                                activeBillingLabel={billingLabel}
                                activePanelItem={activePanelItem}
                                setActivePanelItem={setActivePanelItem}
                                canManageProfiles={canManageProfiles}
                                canManageSellers={canManageSellers}
                                sellerSearch={sellerSearch}
                                setSellerSearch={setSellerSearch}
                                availableSellerOptions={availableSellerOptions}
                                userOptionById={userOptionById}
                                openSection={openSection}
                                onOpenSectionChange={setOpenSection}
                                onAddProfile={addBillingProfile}
                                onDeleteProfile={deleteBillingProfile}
                                onAddSeller={addSellerToBilling}
                                onDeleteSeller={deleteSellerFromBilling}
                                onImpersonateSeller={handleImpersonateSeller}
                            />
                        ) : (
                            <SellerProfilesPanel
                                className="xl:col-span-5"
                                currentSeller={currentSeller}
                                currentSellerDefaults={currentSellerDefaults}
                                currentSellerProfile={currentSellerProfile}
                                activeSellerProfileId={activeSellerProfileId}
                                setActiveSellerProfileId={setActiveSellerProfileId}
                                canManageSellerProfiles={canManageSellerProfiles}
                                onAddSellerProfile={addSellerProfile}
                                onDeleteSellerProfile={deleteSellerProfile}
                            />
                        )}

                        {isFullAccess ? (
                            <BillingConditionsEditor
                                className="xl:col-span-5"
                                activeBillingRule={activeBillingRule}
                                activePanelItem={activePanelItem}
                                currentProfile={currentProfile}
                                currentSeller={currentSeller}
                                currentSellerDefaults={currentSellerDefaults}
                                currentSellerProfile={currentSellerProfile}
                                currentSellerInheritedProfile={currentSellerInheritedProfile}
                                canManageProfiles={canManageProfiles}
                                canManageSellerProfiles={canManageSellerProfiles}
                                canDelegateManage={canDelegateManage}
                                carriers={carriers}
                                userOptionById={userOptionById}
                                setActiveSellerProfileId={setActiveSellerProfileId}
                                onRenameBillingProfile={renameBillingProfile}
                                onChangeBillingProfileConditions={changeBillingProfileConditions}
                                onToggleSellerCanManage={toggleSellerCanManage}
                                onChangeSellerUseBillingProfile={changeSellerUseBillingProfile}
                                onChangeSellerBillingProfile={changeSellerBillingProfile}
                                onChangeSellerCustomConditions={changeSellerCustomConditions}
                                onAddSellerProfile={addSellerProfile}
                                onDeleteSellerProfile={deleteSellerProfile}
                                onRenameSellerProfile={renameSellerProfile}
                                onChangeSellerProfileConditions={changeSellerProfileConditions}
                            />
                        ) : (
                            <SellerProfileConditionsEditor
                                className="xl:col-span-7"
                                currentSeller={currentSeller}
                                currentSellerProfile={currentSellerProfile}
                                canManageSellerProfiles={canManageSellerProfiles}
                                carriers={carriers}
                                onRenameSellerProfile={renameSellerProfile}
                                onChangeSellerProfileConditions={changeSellerProfileConditions}
                            />
                        )}
                    </div>
                </form>
            </div>
        </>
    );
});
