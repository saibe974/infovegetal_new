import {
    leave as impersonateLeave,
    take as impersonateTake,
} from '@/actions/App/Http/Controllers/ImpersonationController';
import { DatabaseStickyBar } from '@/components/products/database-sticky-bar';
import BillingConditionsEditor from '@/components/sales/BillingConditionsEditor';
import BillingTreePanel from '@/components/sales/BillingTreePanel';
import BillingUserSelector from '@/components/sales/BillingUserSelector';
import SellerProfileConditionsEditor from '@/components/sales/SellerProfileConditionsEditor';
import SellerProfilesPanel from '@/components/sales/SellerProfilesPanel';
import {
    normalizeBillingUsers,
    normalizeConditions,
    normalizeRowToDraft,
} from '@/components/sales/billing-utils';
import {
    type ActivePanelItem,
    type BillingDraft,
    type UserOption,
} from '@/components/sales/types';
import {
    Breadcrumb,
    BreadcrumbItem as BreadcrumbItemUI,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { withAppLayout } from '@/layouts/app-layout';
import {
    createOrderCsvTemplate,
    createOrderPdfTemplate,
    normalizeBillingDefaultsToProfiles,
} from '@/lib/billing-defaults';
import { useI18n } from '@/lib/i18n';
import dbProducts from '@/routes/db-products';
import products from '@/routes/products';
import {
    type BillingFileTemplate,
    type BillingUserRule,
    type BreadcrumbItem,
    type dbProduct,
    type SalesConditions,
    type SharedData,
} from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import {
    FormEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

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

export default withAppLayout<Props>(
    breadcrumbs,
    true,
    ({
        dbProduct,
        eligibleBillingUsers,
        eligibleSellerUsers,
        billingAbilities,
        currentUserId,
        carriers,
    }) => {
        // console.log(dbProduct);
        const { t } = useI18n();
        const formRef = useRef<HTMLFormElement>(null);
        const auth = usePage<SharedData>().props.auth;
        const isGlobalManager = billingAbilities?.is_global_manager ?? false;
        const isBillingUser =
            Array.isArray(dbProduct.billing_users) &&
            dbProduct.billing_users.some(
                (u: BillingUserRule) => Number(u.id) === Number(currentUserId),
            );
        const isFullAccess = isGlobalManager || isBillingUser;
        const canManageBillingUsers =
            billingAbilities?.can_manage_billing_users ?? false;
        const canManageSellers = billingAbilities?.can_manage_sellers ?? false;
        const canDelegateManage =
            billingAbilities?.can_delegate_manage ?? false;

        const [billingSearch, setBillingSearch] = useState('');
        const [sellerSearch, setSellerSearch] = useState('');

        const STORAGE_KEY = `db-billing-view-${dbProduct.id}`;

        const loadViewPrefs = useCallback((): {
            billingUserId: number | null;
            panelItem: ActivePanelItem;
            openSection: 'profiles' | 'sellers' | 'files' | null;
            sellerProfileId: string | null;
        } => {
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
            } catch {
                // preferences illisibles : on retombe sur les valeurs par defaut
            }
            return {
                billingUserId: null,
                panelItem: null,
                openSection: 'profiles',
                sellerProfileId: null,
            };
        }, [STORAGE_KEY]);

        const initialBillingUsers: BillingDraft[] = useMemo(() => {
            const rows = Array.isArray(dbProduct.billing_users)
                ? (dbProduct.billing_users as BillingUserRule[])
                : [];
            return rows.map(normalizeRowToDraft);
        }, [dbProduct.billing_users]);

        const viewPrefs = useMemo(() => loadViewPrefs(), [loadViewPrefs]);

        const [activeBillingUserId, setActiveBillingUserId] = useState<
            number | null
        >(() => {
            if (
                viewPrefs.billingUserId !== null &&
                initialBillingUsers.some(
                    (u) =>
                        Number(u.billing_user_id) ===
                        Number(viewPrefs.billingUserId),
                )
            ) {
                return viewPrefs.billingUserId;
            }
            return initialBillingUsers.length > 0
                ? initialBillingUsers[0].billing_user_id
                : null;
        });

        const [activePanelItem, setActivePanelItem] = useState<ActivePanelItem>(
            () => viewPrefs.panelItem,
        );
        const [openSection, setOpenSection] = useState<
            'profiles' | 'sellers' | 'files' | null
        >(() => viewPrefs.openSection);
        const [activeSellerProfileId, setActiveSellerProfileId] = useState<
            string | null
        >(() => viewPrefs.sellerProfileId);
        const [isFileEditorExpanded, setIsFileEditorExpanded] = useState(false);

        const { data, setData, put, processing, errors, transform } = useForm({
            billing_users: initialBillingUsers,
        });

        const errorBag = errors as Record<string, string>;

        const billingUserOptions = useMemo(
            () =>
                (eligibleBillingUsers ?? []).map((user) => ({
                    value: String(user.id),
                    label: user.name,
                    description: user.email,
                })),
            [eligibleBillingUsers],
        );

        const sellerUserOptions = useMemo(
            () =>
                (eligibleSellerUsers ?? []).map((user) => ({
                    value: String(user.id),
                    label: user.name,
                    description: user.email,
                })),
            [eligibleSellerUsers],
        );

        const userOptionById = useMemo(() => {
            const assignedUsers = (dbProduct.billing_users ?? []).flatMap(
                (billingUser) => [billingUser, ...(billingUser.sellers ?? [])],
            );

            return new Map(
                [
                    ...assignedUsers,
                    ...(eligibleBillingUsers ?? []),
                    ...(eligibleSellerUsers ?? []),
                ].map((user) => [
                    user.id,
                    {
                        value: String(user.id),
                        label: user.name,
                        description: user.email,
                    },
                ]),
            );
        }, [
            dbProduct.billing_users,
            eligibleBillingUsers,
            eligibleSellerUsers,
        ]);

        const activeBillingRule = useMemo(() => {
            if (activeBillingUserId === null) {
                return null;
            }

            return (
                (data.billing_users ?? []).find(
                    (rule) =>
                        Number(rule.billing_user_id) ===
                        Number(activeBillingUserId),
                ) ?? null
            );
        }, [activeBillingUserId, data.billing_users]);

        const availableBillingOptions = useMemo(() => {
            const selected = new Set(
                (data.billing_users ?? []).map((rule) =>
                    Number(rule.billing_user_id),
                ),
            );
            return billingUserOptions.filter(
                (option) => !selected.has(Number(option.value)),
            );
        }, [billingUserOptions, data.billing_users]);

        const availableSellerOptions = useMemo(() => {
            const selected = new Set(
                (activeBillingRule?.sellers ?? []).map((seller) =>
                    Number(seller.seller_user_id),
                ),
            );
            return sellerUserOptions.filter(
                (option) => !selected.has(Number(option.value)),
            );
        }, [activeBillingRule?.sellers, sellerUserOptions]);

        const updateBillingRule = (
            billingUserId: number,
            updater: (rule: BillingDraft) => BillingDraft,
        ) => {
            setData(
                'billing_users',
                (data.billing_users ?? []).map((rule) => {
                    if (
                        Number(rule.billing_user_id) !== Number(billingUserId)
                    ) {
                        return rule;
                    }

                    return updater(rule);
                }),
            );
        };

        const currentProfile = useMemo(() => {
            if (!activeBillingRule || activePanelItem?.type !== 'profile') {
                return null;
            }

            return (
                (activeBillingRule.defaults.profiles ?? []).find(
                    (profile) => profile.id === String(activePanelItem.id),
                ) ?? null
            );
        }, [activeBillingRule, activePanelItem]);

        const currentSeller = useMemo(() => {
            if (!activeBillingRule || activePanelItem?.type !== 'seller') {
                return null;
            }

            return (
                (activeBillingRule.sellers ?? []).find(
                    (seller) =>
                        Number(seller.seller_user_id) ===
                        Number(activePanelItem.id),
                ) ?? null
            );
        }, [activeBillingRule, activePanelItem]);

        const currentFile = useMemo(() => {
            if (!activeBillingRule || activePanelItem?.type !== 'file') {
                return null;
            }

            return (
                (activeBillingRule.defaults.files ?? []).find(
                    (file) => file.id === String(activePanelItem.id),
                ) ?? null
            );
        }, [activeBillingRule, activePanelItem]);

        const currentSellerDefaults = useMemo(() => {
            if (!currentSeller) {
                return null;
            }

            return normalizeBillingDefaultsToProfiles(
                currentSeller.seller_defaults,
            );
        }, [currentSeller]);

        const currentSellerInheritedProfile = useMemo(() => {
            if (!activeBillingRule) {
                return null;
            }

            const defaults = normalizeBillingDefaultsToProfiles(
                activeBillingRule.defaults,
            );
            const defaultProfileId =
                defaults.default_profile_id ?? defaults.profiles[0]?.id;

            return (
                defaults.profiles.find(
                    (profile) => profile.id === defaultProfileId,
                ) ??
                defaults.profiles[0] ??
                null
            );
        }, [activeBillingRule]);

        const currentSellerProfile = useMemo(() => {
            if (!currentSellerDefaults) {
                return null;
            }

            const requestedId = activeSellerProfileId;
            if (!requestedId) {
                return null;
            }

            return (
                currentSellerDefaults.profiles.find(
                    (profile) => profile.id === requestedId,
                ) ??
                currentSellerDefaults.profiles[0] ??
                null
            );
        }, [activeSellerProfileId, currentSellerDefaults]);

        const canManageSellerProfiles = useMemo(() => {
            if (!currentSeller) {
                return false;
            }

            return (
                canManageSellers ||
                Number(currentSeller.seller_user_id) === Number(currentUserId)
            );
        }, [canManageSellers, currentSeller, currentUserId]);

        useEffect(() => {
            if (
                activeSellerProfileId &&
                !(currentSellerDefaults?.profiles ?? []).some(
                    (profile) => profile.id === activeSellerProfileId,
                )
            ) {
                setActiveSellerProfileId(null);
            }
        }, [currentSellerDefaults, activeSellerProfileId]);

        useEffect(() => {
            setActiveSellerProfileId(null);
        }, [currentSeller?.seller_user_id]);

        const canManageProfiles = useMemo(() => {
            if (!activeBillingRule) {
                return false;
            }

            return (
                canManageSellers ||
                Number(activeBillingRule.billing_user_id) ===
                    Number(currentUserId)
            );
        }, [activeBillingRule, canManageSellers, currentUserId]);

        useEffect(() => {
            if (isFullAccess || !activeBillingRule) {
                return;
            }

            const ownSeller = (activeBillingRule.sellers ?? []).find(
                (seller) =>
                    Number(seller.seller_user_id) === Number(currentUserId),
            );
            const fallbackSeller =
                ownSeller ?? (activeBillingRule.sellers ?? [])[0] ?? null;

            if (!fallbackSeller) {
                if (activePanelItem !== null) {
                    setActivePanelItem(null);
                }
                return;
            }

            if (
                activePanelItem?.type !== 'seller' ||
                Number(activePanelItem.id) !==
                    Number(fallbackSeller.seller_user_id)
            ) {
                setActivePanelItem({
                    type: 'seller',
                    id: Number(fallbackSeller.seller_user_id),
                });
            }
        }, [isFullAccess, activeBillingRule, currentUserId, activePanelItem]);

        useEffect(() => {
            try {
                localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify({
                        billingUserId: activeBillingUserId,
                        panelItem: activePanelItem,
                        openSection,
                        sellerProfileId: activeSellerProfileId,
                    }),
                );
            } catch {
                // localStorage indisponible : on ignore silencieusement
            }
        }, [
            STORAGE_KEY,
            activeBillingUserId,
            activePanelItem,
            openSection,
            activeSellerProfileId,
        ]);

        useEffect(() => {
            if (!isFileEditorExpanded) return;

            const handleKeyDown = (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                    setIsFileEditorExpanded(false);
                }
            };

            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }, [isFileEditorExpanded]);

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
            ? (userOptionById.get(Number(activeBillingRule.billing_user_id))
                  ?.label ?? `#${activeBillingRule.billing_user_id}`)
            : '';

        const addBillingUser = (id: number) => {
            const exists = (data.billing_users ?? []).some(
                (rule) => Number(rule.billing_user_id) === id,
            );
            if (exists) {
                return;
            }

            const nextRules: BillingDraft[] = [
                ...(data.billing_users ?? []),
                {
                    billing_user_id: id,
                    defaults: {
                        profiles: [
                            {
                                id: 'standard',
                                name: 'Standard',
                                conditions: {},
                            },
                        ],
                        default_profile_id: 'standard',
                        files: [
                            createOrderPdfTemplate(),
                            createOrderCsvTemplate(),
                        ],
                    },
                    sellers: [],
                },
            ];

            setData('billing_users', nextRules);
            setActiveBillingUserId(id);
            setActivePanelItem({ type: 'profile', id: 'standard' });
        };

        const deleteBillingUser = (id: number) => {
            const next = (data.billing_users ?? []).filter(
                (row) => Number(row.billing_user_id) !== id,
            );
            setData('billing_users', next);

            if (activeBillingUserId === id) {
                const first = next[0];
                setActiveBillingUserId(
                    first ? Number(first.billing_user_id) : null,
                );
                setActivePanelItem(null);
            }
        };

        const addBillingProfile = () => {
            if (!activeBillingRule) {
                return;
            }

            const nextId = `profile-${Date.now()}`;
            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => {
                    const profile = {
                        id: nextId,
                        name: t('New profile'),
                        conditions: {},
                    };
                    const profiles = [
                        ...(rule.defaults.profiles ?? []),
                        profile,
                    ];
                    return {
                        ...rule,
                        defaults: {
                            profiles,
                            default_profile_id:
                                rule.defaults.default_profile_id ?? profile.id,
                        },
                    };
                },
            );
            setActivePanelItem({ type: 'profile', id: nextId });
        };

        const deleteBillingProfile = (profileId: string) => {
            if (!activeBillingRule) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => {
                    const profiles = (rule.defaults.profiles ?? []).filter(
                        (current) => current.id !== profileId,
                    );
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
                },
            );

            if (
                activePanelItem?.type === 'profile' &&
                String(activePanelItem.id) === profileId
            ) {
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
                    if (!leaveRes.ok)
                        throw new Error('Unable to leave impersonation');
                }

                const takeRes = await fetch(
                    impersonateTake({ id: sellerId }).url,
                    {
                        method: 'GET',
                        credentials: 'include',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    },
                );
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

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => {
                    const exists = (rule.sellers ?? []).some(
                        (seller) => Number(seller.seller_user_id) === sellerId,
                    );
                    if (exists) {
                        return rule;
                    }

                    return {
                        ...rule,
                        sellers: [
                            ...(rule.sellers ?? []),
                            {
                                seller_user_id: sellerId,
                                conditions: {},
                                use_billing_profile: true,
                                billing_profile_id: null,
                                can_manage: false,
                                seller_defaults: undefined,
                            },
                        ],
                    };
                },
            );

            setActivePanelItem({ type: 'seller', id: sellerId });
        };

        const deleteSellerFromBilling = (sellerId: number) => {
            if (!activeBillingRule) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    sellers: (rule.sellers ?? []).filter(
                        (current) =>
                            Number(current.seller_user_id) !== sellerId,
                    ),
                }),
            );

            if (
                activePanelItem?.type === 'seller' &&
                Number(activePanelItem.id) === sellerId
            ) {
                setActivePanelItem(null);
            }
        };

        const addSellerProfile = () => {
            if (!activeBillingRule || !currentSeller) {
                return;
            }

            const nextId = `seller-profile-${Date.now()}`;
            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    sellers: (rule.sellers ?? []).map((seller) => {
                        if (
                            Number(seller.seller_user_id) !==
                            Number(currentSeller.seller_user_id)
                        ) {
                            return seller;
                        }

                        const defaults = normalizeBillingDefaultsToProfiles(
                            seller.seller_defaults,
                        );
                        const profiles = [
                            ...defaults.profiles,
                            {
                                id: nextId,
                                name: t('New profile'),
                                conditions: {},
                            },
                        ];

                        return {
                            ...seller,
                            has_seller_defaults: true,
                            seller_defaults: {
                                profiles,
                                default_profile_id:
                                    defaults.default_profile_id ?? nextId,
                            },
                        };
                    }),
                }),
            );

            setActiveSellerProfileId(nextId);
        };

        const deleteSellerProfile = (profileId: string) => {
            if (!activeBillingRule || !currentSeller) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    sellers: (rule.sellers ?? []).map((seller) => {
                        if (
                            Number(seller.seller_user_id) !==
                            Number(currentSeller.seller_user_id)
                        ) {
                            return seller;
                        }

                        const defaults = normalizeBillingDefaultsToProfiles(
                            seller.seller_defaults,
                        );
                        const profiles = defaults.profiles.filter(
                            (current) => current.id !== profileId,
                        );
                        return {
                            ...seller,
                            has_seller_defaults: true,
                            seller_defaults: {
                                profiles,
                                default_profile_id:
                                    defaults.default_profile_id === profileId
                                        ? (profiles[0]?.id ?? null)
                                        : defaults.default_profile_id,
                            },
                        };
                    }),
                }),
            );

            if (currentSellerProfile?.id === profileId) {
                setActiveSellerProfileId(null);
            }
        };

        const renameBillingProfile = (name: string) => {
            if (!activeBillingRule || !currentProfile) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    defaults: {
                        ...rule.defaults,
                        profiles: (rule.defaults.profiles ?? []).map(
                            (profile) => {
                                if (profile.id !== currentProfile.id) {
                                    return profile;
                                }

                                return {
                                    ...profile,
                                    name,
                                };
                            },
                        ),
                    },
                }),
            );
        };

        const changeBillingProfileConditions = (next: SalesConditions) => {
            if (!activeBillingRule || !currentProfile) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    defaults: {
                        ...rule.defaults,
                        profiles: (rule.defaults.profiles ?? []).map(
                            (profile) => {
                                if (profile.id !== currentProfile.id) {
                                    return profile;
                                }

                                return {
                                    ...profile,
                                    conditions: normalizeConditions(next),
                                };
                            },
                        ),
                    },
                }),
            );
        };

        const toggleSellerCanManage = (checked: boolean) => {
            if (!activeBillingRule || !currentSeller) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    sellers: (rule.sellers ?? []).map((seller) => {
                        if (
                            Number(seller.seller_user_id) !==
                            Number(currentSeller.seller_user_id)
                        ) {
                            return seller;
                        }

                        return {
                            ...seller,
                            can_manage: checked,
                        };
                    }),
                }),
            );
        };

        const changeSellerUseBillingProfile = (useProfile: boolean) => {
            if (!activeBillingRule || !currentSeller) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    sellers: (rule.sellers ?? []).map((seller) =>
                        Number(seller.seller_user_id) ===
                        Number(currentSeller.seller_user_id)
                            ? {
                                  ...seller,
                                  use_billing_profile: useProfile,
                                  billing_profile_id: useProfile
                                      ? (seller.billing_profile_id ??
                                        currentSellerInheritedProfile?.id ??
                                        null)
                                      : null,
                              }
                            : seller,
                    ),
                }),
            );
        };

        const changeSellerBillingProfile = (profileId: string | null) => {
            if (!activeBillingRule || !currentSeller) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    sellers: (rule.sellers ?? []).map((seller) =>
                        Number(seller.seller_user_id) ===
                        Number(currentSeller.seller_user_id)
                            ? {
                                  ...seller,
                                  billing_profile_id: profileId,
                                  use_billing_profile: true,
                              }
                            : seller,
                    ),
                }),
            );
        };

        const changeSellerCustomConditions = (next: SalesConditions) => {
            if (!activeBillingRule || !currentSeller) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    sellers: (rule.sellers ?? []).map((seller) => {
                        if (
                            Number(seller.seller_user_id) !==
                            Number(currentSeller.seller_user_id)
                        ) {
                            return seller;
                        }

                        return {
                            ...seller,
                            use_billing_profile: false,
                            conditions: normalizeConditions(next),
                        };
                    }),
                }),
            );
        };

        const renameSellerProfile = (name: string) => {
            if (!activeBillingRule || !currentSeller || !currentSellerProfile) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    sellers: (rule.sellers ?? []).map((seller) => {
                        if (
                            Number(seller.seller_user_id) !==
                            Number(currentSeller.seller_user_id)
                        ) {
                            return seller;
                        }

                        const defaults = normalizeBillingDefaultsToProfiles(
                            seller.seller_defaults,
                        );
                        return {
                            ...seller,
                            has_seller_defaults: true,
                            seller_defaults: {
                                ...defaults,
                                profiles: defaults.profiles.map((profile) =>
                                    profile.id === currentSellerProfile.id
                                        ? { ...profile, name }
                                        : profile,
                                ),
                            },
                        };
                    }),
                }),
            );
        };

        const changeSellerProfileConditions = (next: SalesConditions) => {
            if (!activeBillingRule || !currentSeller || !currentSellerProfile) {
                return;
            }

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    sellers: (rule.sellers ?? []).map((seller) => {
                        if (
                            Number(seller.seller_user_id) !==
                            Number(currentSeller.seller_user_id)
                        ) {
                            return seller;
                        }

                        const defaults = normalizeBillingDefaultsToProfiles(
                            seller.seller_defaults,
                        );
                        return {
                            ...seller,
                            has_seller_defaults: true,
                            seller_defaults: {
                                ...defaults,
                                profiles: defaults.profiles.map((profile) =>
                                    profile.id === currentSellerProfile.id
                                        ? {
                                              ...profile,
                                              conditions:
                                                  normalizeConditions(next),
                                          }
                                        : profile,
                                ),
                            },
                        };
                    }),
                }),
            );
        };

        const addBillingFile = () => {
            if (!activeBillingRule) return;

            const fileNumber =
                (activeBillingRule.defaults.files ?? []).length + 1;
            const fileId = `custom-${Date.now()}`;
            const nextFile: BillingFileTemplate = {
                id: fileId,
                name: `${t('Fichier')} ${fileNumber}`,
                filename: `%document.number%_fichier-${fileNumber}_%db.name%`,
                event: 'order',
                events: ['order'],
                enabled: true,
                shared: false,
                delimiter: ';',
                extension: 'csv',
                blocks: [
                    {
                        id: 'header',
                        name: t('Entête'),
                        type: 'header',
                        enabled: true,
                        show_headers: false,
                        columns: [
                            { id: 'column-1', name: `${t('Colonne')} 1` },
                        ],
                        rows: [
                            {
                                id: 'row-1',
                                cells: { 'column-1': '' },
                            },
                        ],
                    },
                ],
            };

            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    defaults: {
                        ...rule.defaults,
                        files: [...(rule.defaults.files ?? []), nextFile],
                    },
                }),
            );
            setActivePanelItem({ type: 'file', id: fileId });
        };

        const changeBillingFile = (nextFile: BillingFileTemplate) => {
            if (!activeBillingRule) return;
            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    defaults: {
                        ...rule.defaults,
                        files: (rule.defaults.files ?? []).map((file) =>
                            file.id === nextFile.id ? nextFile : file,
                        ),
                    },
                }),
            );
        };

        const deleteBillingFile = (fileId: string) => {
            if (!activeBillingRule) return;
            updateBillingRule(
                Number(activeBillingRule.billing_user_id),
                (rule) => ({
                    ...rule,
                    defaults: {
                        ...rule.defaults,
                        files: (rule.defaults.files ?? []).filter(
                            (file) => file.id !== fileId,
                        ),
                    },
                }),
            );
            if (
                activePanelItem?.type === 'file' &&
                activePanelItem.id === fileId
            ) {
                setActivePanelItem(null);
            }
        };

        const isFileEditorWide =
            activePanelItem?.type === 'file' && isFileEditorExpanded;

        return (
            <>
                <Head title={`${t('Billing')} - ${dbProduct.name}`} />

                <div className="space-y-6">
                    <form ref={formRef} onSubmit={handleSubmit}>
                        <DatabaseStickyBar
                            dbProductId={dbProduct.id}
                            country={dbProduct.country}
                            activeSection="billing"
                            canAccessBilling
                            onSave={() => formRef.current?.requestSubmit()}
                            saving={processing}
                            title={
                                <>
                                    <span className="block truncate text-lg sm:hidden">
                                        {dbProduct.name || t('Database')}
                                    </span>
                                    <div className="hidden sm:block">
                                        <Breadcrumb>
                                            <BreadcrumbList>
                                                <BreadcrumbItemUI>
                                                    <BreadcrumbPage className="text-3xl font-bold capitalize">
                                                        {dbProduct.name ||
                                                            t('Database')}
                                                    </BreadcrumbPage>
                                                </BreadcrumbItemUI>
                                                {activeBillingRule && (
                                                    <>
                                                        <BreadcrumbSeparator />
                                                        <BreadcrumbItemUI>
                                                            <BreadcrumbPage className="text-3xl font-bold">
                                                                {billingLabel}
                                                            </BreadcrumbPage>
                                                        </BreadcrumbItemUI>
                                                    </>
                                                )}
                                                {activePanelItem && (
                                                    <>
                                                        <BreadcrumbSeparator />
                                                        <BreadcrumbItemUI>
                                                            <BreadcrumbPage className="text-3xl font-bold">
                                                                {activePanelItem.type ===
                                                                'profile'
                                                                    ? (currentProfile?.name ??
                                                                      t(
                                                                          'Profile',
                                                                      ))
                                                                    : activePanelItem.type ===
                                                                        'file'
                                                                      ? (currentFile?.name ??
                                                                        t(
                                                                            'Fichier',
                                                                        ))
                                                                      : (userOptionById.get(
                                                                            Number(
                                                                                activePanelItem.id,
                                                                            ),
                                                                        )
                                                                            ?.label ??
                                                                        t(
                                                                            'Commercial',
                                                                        ))}
                                                            </BreadcrumbPage>
                                                        </BreadcrumbItemUI>
                                                    </>
                                                )}
                                                {/* {activeSellerProfileId &&
                                            currentSellerProfile && (
                                                <>
                                                    <BreadcrumbSeparator />
                                                    <BreadcrumbItemUI>
                                                        <BreadcrumbPage className="text-3xl font-bold">
                                                            {
                                                                currentSellerProfile.name
                                                            }
                                                        </BreadcrumbPage>
                                                    </BreadcrumbItemUI>
                                                </>
                                            )} */}
                                            </BreadcrumbList>
                                        </Breadcrumb>
                                    </div>
                                </>
                            }
                        />

                        <div
                            className={`grid grid-cols-1 ${isFullAccess ? (isFileEditorWide ? 'gap-0 transition-all duration-300 ease-in-out xl:grid-cols-[minmax(0,0fr)_minmax(0,0fr)_minmax(0,1fr)]' : 'gap-6 transition-all duration-300 ease-in-out xl:grid-cols-[minmax(0,3fr)_minmax(0,4fr)_minmax(0,5fr)]') : 'gap-6 xl:grid-cols-12'}`}
                        >
                            {isFullAccess ? (
                                <BillingUserSelector
                                    className={`min-w-0 overflow-hidden transition-all duration-300 ${isFileEditorWide ? 'hidden xl:pointer-events-none xl:block xl:-translate-x-4 xl:opacity-0' : 'translate-x-0 opacity-100'}`}
                                    billingUsers={data.billing_users ?? []}
                                    activeBillingUserId={activeBillingUserId}
                                    userOptionById={userOptionById}
                                    billingSearch={billingSearch}
                                    setBillingSearch={setBillingSearch}
                                    availableBillingOptions={
                                        availableBillingOptions
                                    }
                                    canManageBillingUsers={
                                        canManageBillingUsers
                                    }
                                    onSelectBillingUser={(id) => {
                                        setActiveBillingUserId(id);
                                        setActivePanelItem(null);
                                    }}
                                    onAddBillingUser={addBillingUser}
                                    onDeleteBillingUser={deleteBillingUser}
                                    onImpersonateBillingUser={
                                        handleImpersonateSeller
                                    }
                                    errors={errorBag}
                                />
                            ) : null}

                            {isFullAccess ? (
                                <BillingTreePanel
                                    className={`min-w-0 overflow-hidden transition-all duration-300 ${isFileEditorWide ? 'hidden xl:pointer-events-none xl:block xl:-translate-x-4 xl:opacity-0' : 'translate-x-0 opacity-100'}`}
                                    activeBillingRule={activeBillingRule}
                                    activeBillingLabel={billingLabel}
                                    activePanelItem={activePanelItem}
                                    setActivePanelItem={setActivePanelItem}
                                    canManageProfiles={canManageProfiles}
                                    canManageSellers={canManageSellers}
                                    sellerSearch={sellerSearch}
                                    setSellerSearch={setSellerSearch}
                                    availableSellerOptions={
                                        availableSellerOptions
                                    }
                                    userOptionById={userOptionById}
                                    openSection={openSection}
                                    onOpenSectionChange={setOpenSection}
                                    onAddProfile={addBillingProfile}
                                    onDeleteProfile={deleteBillingProfile}
                                    onAddSeller={addSellerToBilling}
                                    onDeleteSeller={deleteSellerFromBilling}
                                    onAddFile={addBillingFile}
                                    onChangeFile={changeBillingFile}
                                    onDeleteFile={deleteBillingFile}
                                    onImpersonateSeller={
                                        handleImpersonateSeller
                                    }
                                />
                            ) : (
                                <SellerProfilesPanel
                                    className="xl:col-span-5"
                                    currentSeller={currentSeller}
                                    currentSellerDefaults={
                                        currentSellerDefaults
                                    }
                                    currentSellerProfile={currentSellerProfile}
                                    activeSellerProfileId={
                                        activeSellerProfileId
                                    }
                                    setActiveSellerProfileId={
                                        setActiveSellerProfileId
                                    }
                                    canManageSellerProfiles={
                                        canManageSellerProfiles
                                    }
                                    onAddSellerProfile={addSellerProfile}
                                    onDeleteSellerProfile={deleteSellerProfile}
                                />
                            )}

                            {isFullAccess ? (
                                <BillingConditionsEditor
                                    className="min-w-0 transition-all duration-300"
                                    activeBillingRule={activeBillingRule}
                                    activeBillingLabel={billingLabel}
                                    activePanelItem={activePanelItem}
                                    currentProfile={currentProfile}
                                    currentSeller={currentSeller}
                                    currentFile={currentFile}
                                    isFileEditorExpanded={isFileEditorExpanded}
                                    currentSellerDefaults={
                                        currentSellerDefaults
                                    }
                                    currentSellerProfile={currentSellerProfile}
                                    currentSellerInheritedProfile={
                                        currentSellerInheritedProfile
                                    }
                                    canManageProfiles={canManageProfiles}
                                    canManageSellerProfiles={
                                        canManageSellerProfiles
                                    }
                                    canDelegateManage={canDelegateManage}
                                    carriers={carriers}
                                    userOptionById={userOptionById}
                                    setActiveSellerProfileId={
                                        setActiveSellerProfileId
                                    }
                                    onRenameBillingProfile={
                                        renameBillingProfile
                                    }
                                    onChangeBillingProfileConditions={
                                        changeBillingProfileConditions
                                    }
                                    onToggleSellerCanManage={
                                        toggleSellerCanManage
                                    }
                                    onChangeSellerUseBillingProfile={
                                        changeSellerUseBillingProfile
                                    }
                                    onChangeSellerBillingProfile={
                                        changeSellerBillingProfile
                                    }
                                    onChangeSellerCustomConditions={
                                        changeSellerCustomConditions
                                    }
                                    onChangeBillingFile={changeBillingFile}
                                    onFileEditorExpandedChange={
                                        setIsFileEditorExpanded
                                    }
                                    onAddSellerProfile={addSellerProfile}
                                    onDeleteSellerProfile={deleteSellerProfile}
                                    onRenameSellerProfile={renameSellerProfile}
                                    onChangeSellerProfileConditions={
                                        changeSellerProfileConditions
                                    }
                                />
                            ) : (
                                <SellerProfileConditionsEditor
                                    className="xl:col-span-7"
                                    currentSeller={currentSeller}
                                    currentSellerProfile={currentSellerProfile}
                                    canManageSellerProfiles={
                                        canManageSellerProfiles
                                    }
                                    carriers={carriers}
                                    onRenameSellerProfile={renameSellerProfile}
                                    onChangeSellerProfileConditions={
                                        changeSellerProfileConditions
                                    }
                                />
                            )}
                        </div>
                    </form>
                </div>
            </>
        );
    },
);
