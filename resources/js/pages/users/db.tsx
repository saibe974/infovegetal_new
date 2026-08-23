import { Head, router, usePage, Form } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { Button } from '@/components/ui/button';
import { BreadcrumbItem, type SharedData, type User, type dbProduct, type ClientSalesCondition, type SalesConditions } from '@/types';
import { useI18n } from '@/lib/i18n';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchSelect from '@/components/app/search-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StickyBar } from '@/components/ui/sticky-bar';
import { TrashIcon } from 'lucide-react';
import { DatabaseAccessIcon } from '@/lib/icons';
import SalesConditionsForm from '@/components/sales/sales-conditions-form';
import { Separator } from '@/components/ui/separator';
import { normalizeBillingDefaultsToProfiles } from '@/lib/billing-defaults';
import CountryFlag from '@/components/ui/country-flag';
import { ButtonsActions } from '@/components/buttons-actions';
import { formatSalesConditionsSummary } from '@/components/sales/billing-utils';

type CarrierOption = {
    id: number;
    name: string;
    country?: string | null;
    zones?: Array<{
        id: number;
        carrier_id: number;
        name: string;
    }>;
};

type SalesConditionDraft = {
    db_product_id: number;
    billing_user_id: number | null;
    seller_user_id: number | null;
    conditions_override: SalesConditions;
    profile_selection_key: string | null;
};

type SearchSelectOption = {
    value: string;
    label: string;
    description?: string;
};

const EMPTY_SEARCH_SELECTION: SearchSelectOption[] = [];

type DbPageProps = SharedData & {
    user: User;
    dbProducts: dbProduct[];
    carriers: CarrierOption[];
    selectedDbId?: number[];
    salesConditions?: ClientSalesCondition[];
};


const normalizeConditions = (value: SalesConditions | undefined): SalesConditions => {
    if (!value) {
        return {};
    }

    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
};

const areConditionsEqual = (left: SalesConditions | undefined, right: SalesConditions | undefined): boolean => {
    return JSON.stringify(normalizeConditions(left)) === JSON.stringify(normalizeConditions(right));
};

const diffConditions = (base: SalesConditions | undefined, target: SalesConditions | undefined): SalesConditions => {
    const left = base ?? {};
    const right = target ?? {};
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    const diff: SalesConditions = {};

    keys.forEach((key) => {
        const typedKey = key as keyof SalesConditions;
        if (!Object.is(left[typedKey], right[typedKey])) {
            diff[typedKey] = right[typedKey];
        }
    });

    return normalizeConditions(diff);
};

const getDefaultProfileConditions = (defaults: ReturnType<typeof normalizeBillingDefaultsToProfiles>): SalesConditions => {
    const selected = defaults.profiles.find((profile) => profile.id === defaults.default_profile_id)
        ?? defaults.profiles[0]
        ?? null;

    return normalizeConditions(selected?.conditions ?? {});
};

const DEFAULT_VALUES: SalesConditions = {
    m: 0,
    mm: 0,
    pd: 0,
    h: 1,
    l: 0,
    lm: 0,
    c: '',
    mc: 0,
    me: 0,
    mr: 0,
    tvap: 0,
    tvat: null,
    t: null,
    z: null,
    p: '-1',
};

const normalizePriceMode = (value: unknown): string => {
    if (value === null || value === undefined || value === '') {
        return '-1';
    }

    const raw = String(value).trim().toLowerCase();

    if (raw === 'price_depart' || raw === 'depart' || raw === 'departure' || raw === '0') {
        return 'price_depart';
    }

    if (raw === 'price_render' || raw === 'price_rendu' || raw === 'render' || raw === 'rendered' || raw === 'rendu' || raw === '1') {
        return 'price_render';
    }

    if (raw === 'price' || raw === 'price_floor' || raw === 'price_roll' || raw === 'price_promo') {
        return raw;
    }

    return raw === '-1' ? '-1' : '-1';
};

const toNumber = (value: string, fallback = 0): number => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
};

export default function UserDbPage() {
    const { user: propsUser, dbProducts, carriers, salesConditions, selectedDbId } = usePage<DbPageProps>().props;
    const { t } = useI18n();
    const targetUser: User = propsUser;

    const dbProductsList = Array.isArray(dbProducts) ? dbProducts : [];
    const carriersList = Array.isArray(carriers) ? carriers : [];

    const dbById = useMemo(() => new Map(dbProductsList.map((db) => [Number(db.id), db])), [dbProductsList]);

    const [search, setSearch] = useState('');
    const [deliveryRaw, setDeliveryRaw] = useState('');
    const [lmRaw, setLmRaw] = useState('');
    const [tvatRaw, setTvatRaw] = useState('');

    const [rows, setRows] = useState<SalesConditionDraft[]>(() => {
        const existing = Array.isArray(salesConditions) ? salesConditions : [];
        if (existing.length > 0) {
            return existing.map((row) => ({
                db_product_id: Number(row.db_product_id),
                billing_user_id: row.billing_user_id ? Number(row.billing_user_id) : null,
                seller_user_id: row.seller_user_id !== null && row.seller_user_id !== undefined ? Number(row.seller_user_id) : null,
                conditions_override: normalizeConditions(row.conditions_override ?? {}),
                profile_selection_key: null,
            }));
        }

        return (selectedDbId ?? []).map((id) => ({
            db_product_id: Number(id),
            billing_user_id: null,
            seller_user_id: null,
            conditions_override: {},
            profile_selection_key: '',
        }));
    });

    const [activeIndex, setActiveIndex] = useState<number>(0);

    useEffect(() => {
        setDeliveryRaw('');
        setLmRaw('');
        setTvatRaw('');
    }, [activeIndex]);

    const dbOptions = useMemo(
        () => dbProductsList.map((db) => ({ value: String(db.id), label: (db.name), country: (db.country) })),
        [dbProductsList],
    );

    const availableDbOptions = useMemo(() => {
        const selected = new Set(rows.map((row) => Number(row.db_product_id)));
        return dbOptions.filter((option) => !selected.has(Number(option.value)));
    }, [dbOptions, rows]);

    const activeRow = rows[activeIndex] ?? null;

    // console.log(rows)
    // console.log(activeRow)

    const billingOptions = useMemo(() => {
        if (!activeRow) {
            return [];
        }

        const db = dbById.get(Number(activeRow.db_product_id));
        const list = Array.isArray(db?.billing_users) ? db.billing_users : [];

        return list.map((billing) => ({
            value: String(billing.id),
            label: billing.name,
            description: billing.email,
        }));
    }, [activeRow, dbById]);
    // console.log(billingOptions)

    const sellerOptions = useMemo(() => {
        if (!activeRow || !activeRow.billing_user_id) {
            return [];
        }

        const db = dbById.get(Number(activeRow.db_product_id));
        const billing = (db?.billing_users ?? []).find((row) => Number(row.id) === Number(activeRow.billing_user_id));

        return (billing?.sellers ?? []).map((seller) => ({
            value: String(seller.id),
            label: seller.name,
            description: seller.email,
        }));
    }, [activeRow, dbById]);

    // console.log(sellerOptions)

    const selectedBillingOption = useMemo(() => {
        if (!activeRow?.billing_user_id) {
            return EMPTY_SEARCH_SELECTION;
        }

        return billingOptions.filter((opt) => Number(opt.value) === Number(activeRow.billing_user_id));
    }, [activeRow?.billing_user_id, billingOptions]);

    // console.log(selectedBillingOption)

    useEffect(() => {
        if (!activeRow) return;
        if (billingOptions.length !== 1) return;

        const nextBillingId = Number(billingOptions[0]?.value);
        if (!Number.isInteger(nextBillingId) || nextBillingId <= 0) return;
        if (Number(activeRow.billing_user_id) === nextBillingId) return;

        updateRow(activeIndex, { billing_user_id: nextBillingId, seller_user_id: null });
    }, [billingOptions, activeRow?.billing_user_id, activeIndex]);

    const activeSellerData = useMemo(() => {
        if (!activeRow || !activeRow.billing_user_id || !activeRow.seller_user_id) {
            return null;
        }

        const db = dbById.get(Number(activeRow.db_product_id));
        const billing = (db?.billing_users ?? []).find((row) => Number(row.id) === Number(activeRow.billing_user_id));
        return (billing?.sellers ?? []).find((seller) => Number(seller.id) === Number(activeRow.seller_user_id)) ?? null;
    }, [activeRow, dbById]);
    // console.log(activeSellerData);

    const activeBillingData = useMemo(() => {
        if (!activeRow?.billing_user_id) {
            return null;
        }

        const db = dbById.get(Number(activeRow.db_product_id));
        return (db?.billing_users ?? []).find((row) => Number(row.id) === Number(activeRow.billing_user_id)) ?? null;
    }, [activeRow, dbById]);
    // console.log(activeBillingData);

    const activeBillingDefaults = useMemo(
        () => normalizeBillingDefaultsToProfiles(activeBillingData?.defaults),
        [activeBillingData],
    );

    const activeBillingProfile = useMemo(() => {
        if (!activeRow?.billing_user_id) {
            return null;
        }

        if (!activeSellerData) {
            const profile = activeBillingDefaults.profiles.find((item) => item.id === activeBillingDefaults.default_profile_id)
                ?? activeBillingDefaults.profiles[0]
                ?? null;

            return profile;
        }

        const profileId = activeSellerData.use_billing_profile
            ? (activeSellerData.billing_profile_id ?? activeBillingDefaults.default_profile_id ?? null)
            : null;

        if (!profileId) {
            return {
                id: '__custom__',
                name: t('Paramétrage custom'),
                conditions: normalizeConditions(activeSellerData.conditions ?? {}),
            };
        }

        const profile = activeBillingDefaults.profiles.find((p) => p.id === String(profileId));
        return profile ?? {
            id: String(profileId),
            name: String(profileId),
            conditions: {},
        };
    }, [activeBillingDefaults, activeSellerData, activeRow?.billing_user_id, t]);

    const sellerProfiles = useMemo(() => {
        if (!activeSellerData) {
            return [];
        }

        const sellerDefaults = normalizeBillingDefaultsToProfiles(activeSellerData.seller_defaults);
        return sellerDefaults.profiles.map((profile) => ({
            key: `seller:${profile.id}`,
            label: profile.name,
            conditions: normalizeConditions(profile.conditions),
        }));
    }, [activeSellerData, t]);

    const billingProfiles = useMemo(() => {
        if (!activeBillingData) {
            return [];
        }

        return activeBillingDefaults.profiles.map((profile) => ({
            key: `billing:${profile.id}`,
            label: profile.name,
            conditions: normalizeConditions(profile.conditions),
        }));
    }, [activeBillingData, activeBillingDefaults]);

    const inheritedConditions = useMemo(() => {
        if (!activeRow?.billing_user_id) {
            return {};
        }

        const billingBase = getDefaultProfileConditions(activeBillingDefaults);

        if (!activeRow.seller_user_id || !activeSellerData) {
            return billingBase;
        }

        const sellerDefaults = normalizeBillingDefaultsToProfiles(activeSellerData.seller_defaults);
        const sellerBase = getDefaultProfileConditions(sellerDefaults);

        const billingToSellerBase = activeSellerData.use_billing_profile
            ? normalizeConditions(
                activeBillingDefaults.profiles.find((p) => p.id === String(activeSellerData.billing_profile_id ?? activeBillingDefaults.default_profile_id ?? ''))?.conditions
                ?? billingBase,
            )
            : normalizeConditions(activeSellerData.conditions ?? {});

        return normalizeConditions({
            ...billingToSellerBase,
            ...sellerBase,
        });
    }, [activeBillingDefaults, activeRow, activeSellerData]);


    const activeProfileOptions = useMemo(
        () => (activeRow?.seller_user_id ? sellerProfiles : billingProfiles),
        [activeRow?.seller_user_id, billingProfiles, sellerProfiles],
    );

    const selectedProfileKey = useMemo(() => {
        if (!activeRow) {
            return '';
        }

        if (activeRow.profile_selection_key === '__custom__') {
            return '__custom__';
        }

        if (activeRow.profile_selection_key === '') {
            return '';
        }

        if (activeRow.profile_selection_key) {
            const explicitProfile = activeProfileOptions.find((profile) => profile.key === activeRow.profile_selection_key);
            return explicitProfile ? explicitProfile.key : '';
        }

        const override = normalizeConditions(activeRow.conditions_override ?? {});

        const matchingProfile = activeProfileOptions.find((profile) => {
            const profileOverride = diffConditions(
                inheritedConditions,
                normalizeConditions({ ...inheritedConditions, ...profile.conditions }),
            );

            return areConditionsEqual(profileOverride, override);
        });

        if (matchingProfile) {
            return matchingProfile.key;
        }

        return Object.keys(override).length > 0 ? '__custom__' : '';
    }, [activeProfileOptions, activeRow, inheritedConditions]);

    const selectedProfile = useMemo(() => {
        if (!selectedProfileKey || selectedProfileKey === '__custom__') {
            return null;
        }

        return activeProfileOptions.find((profile) => profile.key === selectedProfileKey) ?? null;
    }, [activeProfileOptions, selectedProfileKey]);

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('User database association'), href: '#' }];

    const updateRow = (index: number, patch: Partial<SalesConditionDraft>) => {
        setRows((prev) => prev.map((row, rowIndex) => {
            if (rowIndex !== index) {
                return row;
            }

            const patchEntries = Object.entries(patch) as Array<[keyof SalesConditionDraft, SalesConditionDraft[keyof SalesConditionDraft]]>;
            const hasChanges = patchEntries.some(([key, value]) => !Object.is(row[key], value));

            if (!hasChanges) {
                return row;
            }

            return { ...row, ...patch };
        }));
    };

    const mergedSource = selectedProfileKey === '__custom__'
        ? normalizeConditions({ ...inheritedConditions, ...(activeRow?.conditions_override ?? {}) })
        : selectedProfile
            ? normalizeConditions({ ...inheritedConditions, ...selectedProfile.conditions, ...(activeRow?.conditions_override ?? {}) })
            : inheritedConditions;


    const merged: SalesConditions = { ...DEFAULT_VALUES, ...mergedSource };

    type CarrierAssignment = { carrier_id: number | null; zone_id: number | null; tva?: number | null };

    const [carrierTvaRaw, setCarrierTvaRaw] = useState<Record<number, string>>({});

    const carrierAssignments: CarrierAssignment[] = useMemo(() => {
        if (merged.t === null || merged.t === undefined || merged.t === '') return [];
        if (typeof merged.t === 'number') return [{ carrier_id: merged.t, zone_id: merged.z ?? null }];
        try {
            const parsed = JSON.parse(merged.t);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }, [merged.t, merged.z]);

    const updateCarrierAssignments = (next: CarrierAssignment[]) => {
        const json = next.length === 0 ? null : JSON.stringify(next);
        updateWithoutChangingProfile({ t: json as unknown as SalesConditions['t'] });
    };

    const updateWithoutChangingProfile = (patch: Partial<SalesConditions>) => {
        const nextResolved = normalizeConditions({ ...merged, ...patch });

        updateRow(activeIndex, {
            profile_selection_key: selectedProfileKey,
            conditions_override: diffConditions(inheritedConditions, nextResolved),
        });
    };

    const update = (patch: Partial<SalesConditions>) => {
        const nextResolved = normalizeConditions({ ...merged, ...patch });

        updateRow(activeIndex, {
            profile_selection_key: '__custom__',
            conditions_override: diffConditions(inheritedConditions, nextResolved),
        });
    };

    const resolveRowSubmissionOverride = (row: SalesConditionDraft): SalesConditions => {
        const db = dbById.get(Number(row.db_product_id));
        const billing = (db?.billing_users ?? []).find((item) => Number(item.id) === Number(row.billing_user_id));

        if (!billing) {
            return row.profile_selection_key === '__custom__'
                ? normalizeConditions(row.conditions_override)
                : {};
        }

        const billingDefaults = normalizeBillingDefaultsToProfiles(billing.defaults);
        const billingBase = getDefaultProfileConditions(billingDefaults);

        const seller = row.seller_user_id
            ? (billing.sellers ?? []).find((item) => Number(item.id) === Number(row.seller_user_id))
            : null;

        const sellerDefaults = normalizeBillingDefaultsToProfiles(seller?.seller_defaults);
        const sellerBase = seller ? getDefaultProfileConditions(sellerDefaults) : {};

        const billingToSellerBase = seller
            ? ((seller.use_billing_profile ?? true)
                ? normalizeConditions(
                    billingDefaults.profiles.find((p) => p.id === String(seller.billing_profile_id ?? billingDefaults.default_profile_id ?? ''))?.conditions
                    ?? billingBase,
                )
                : normalizeConditions(seller.conditions ?? {}))
            : billingBase;

        const rowBase = normalizeConditions({
            ...billingToSellerBase,
            ...sellerBase,
        });

        if (row.profile_selection_key === '__custom__') {
            return normalizeConditions(row.conditions_override);
        }

        if (!row.profile_selection_key) {
            return {};
        }

        const profilePool = seller
            ? sellerDefaults.profiles.map((profile) => ({
                key: `seller:${profile.id}`,
                conditions: normalizeConditions(profile.conditions),
            }))
            : billingDefaults.profiles.map((profile) => ({
                key: `billing:${profile.id}`,
                conditions: normalizeConditions(profile.conditions),
            }));

        const selected = profilePool.find((profile) => profile.key === row.profile_selection_key);
        if (!selected) {
            return {};
        }

        const selectedResolved = normalizeConditions({
            ...rowBase,
            ...selected.conditions,
            ...row.conditions_override,
        });

        return diffConditions(rowBase, selectedResolved);
    };

    const submit = () => {
        const normalizedRows = rows
            .filter((row) => Number(row.db_product_id) > 0 && Number(row.billing_user_id ?? 0) > 0)
            .map((row) => ({
                db_product_id: Number(row.db_product_id),
                billing_user_id: Number(row.billing_user_id),
                seller_user_id: row.seller_user_id ? Number(row.seller_user_id) : null,
                conditions_override: resolveRowSubmissionOverride(row),
            }));

        const dbIds = Array.from(new Set(rows.map((row) => Number(row.db_product_id)).filter((id) => id > 0)));

        router.post(
            `/admin/users/${targetUser.id}/db`,
            {
                merge: true,
                db_ids: dbIds,
                sales_conditions: normalizedRows,
            },
            {
                preserveScroll: true,
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('User database association')} />

            <SettingsLayout>
                <div className="space-y-4">
                    <StickyBar topOffsetElement=".top-sticky, .settings-sticky">
                        <div className="ml-auto">
                            <Button type="button" onClick={submit}>
                                {t('Save')}
                            </Button>
                        </div>
                    </StickyBar>


                    <Form method="post" action={`/admin/users/${targetUser.id}/db`} className="space-y-4">
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <Card className="p-6 space-y-4">
                                <FormField label={<><DatabaseAccessIcon className="inline mx-2" /> {t('Select DB product')}</>}>
                                    <SearchSelect
                                        value={search}
                                        onChange={setSearch}
                                        onSubmit={(value) => {
                                            const id = Number(value.trim().split(/\s+/).pop() ?? '');
                                            if (!Number.isInteger(id) || id <= 0) {
                                                return;
                                            }

                                            setRows((prev) => {
                                                const exists = prev.some((row) => Number(row.db_product_id) === id);
                                                if (exists) {
                                                    return prev;
                                                }

                                                return [...prev, { db_product_id: id, billing_user_id: null, seller_user_id: null, conditions_override: {}, profile_selection_key: '' }];
                                            });
                                            setActiveIndex(rows.length);
                                            setSearch('');
                                        }}
                                        propositions={availableDbOptions}
                                        selection={EMPTY_SEARCH_SELECTION}
                                        loading={false}
                                        minQueryLength={0}
                                    />
                                </FormField>

                                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                                    {rows.map((row, index) => {
                                        const db = dbById.get(Number(row.db_product_id));
                                        // console.log(db)
                                        if (!db) {
                                            return null;
                                        }

                                        return (
                                            <div key={`${row.db_product_id}-${index}`} className="flex items-center justify-between gap-2">
                                                {db.country && <CountryFlag countryCode={db.country} title={db.country} className="w-4" />}
                                                <button
                                                    type="button"
                                                    className={`text-left rounded-md px-3 py-2 w-full border ${activeIndex === index ? 'bg-muted border-primary' : 'border-border'}`}
                                                    onClick={() => setActiveIndex(index)}
                                                >
                                                    <span className="font-medium">{db.name}</span>
                                                </button>
                                                <Button
                                                    type="button"
                                                    variant="destructive-outline"
                                                    size="icon"
                                                    onClick={() => {
                                                        setRows((prev) => prev.filter((_, i) => i !== index));
                                                        setActiveIndex(0);
                                                    }}
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>

                            <Card className="p-6 xl:col-span-2 space-y-4">
                                {!activeRow ? (
                                    <p className="text-sm text-muted-foreground">{t('Select a DB product to configure sales conditions.')}</p>
                                ) : (
                                    <>
                                        <CardHeader className="px-0">
                                            <CardTitle className="flex items-center gap-2">
                                                {dbById.get(Number(activeRow.db_product_id))?.country && <CountryFlag countryCode={dbById.get(Number(activeRow.db_product_id))!.country!} title={dbById.get(Number(activeRow.db_product_id))!.country!} className="w-5" />}
                                                {dbById.get(Number(activeRow.db_product_id))?.name}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="px-0 space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField label={t('Facturant')}>
                                                    {billingOptions.length <= 1 ? (
                                                        <Input
                                                            disabled
                                                            readOnly
                                                            value={billingOptions[0]?.label ?? ''}
                                                            placeholder={t('Facturant')}
                                                        />
                                                    ) : (
                                                        <SearchSelect
                                                            value={''}
                                                            onChange={() => undefined}
                                                            onSubmit={(value) => {
                                                                const id = Number(value.trim().split(/\s+/).pop() ?? '');
                                                                if (!Number.isInteger(id) || id <= 0) {
                                                                    return;
                                                                }

                                                                if (Number(activeRow.billing_user_id) === id) {
                                                                    return;
                                                                }

                                                                updateRow(activeIndex, {
                                                                    billing_user_id: id,
                                                                    seller_user_id: null,
                                                                    profile_selection_key: null,
                                                                });
                                                            }}
                                                            propositions={billingOptions}
                                                            selection={selectedBillingOption}
                                                            loading={false}
                                                            minQueryLength={0}
                                                        />
                                                    )}

                                                    {activeRow.seller_user_id ? (
                                                        <div
                                                            className="w-full rounded-md border border-border bg-muted/40 px-3 py-2"
                                                            title={activeBillingProfile ? formatSalesConditionsSummary(activeBillingProfile.conditions, t('Vente directe')) : undefined}
                                                        >
                                                            <span className="block truncate font-medium">
                                                                {activeBillingProfile?.name ?? t('Profil facturant assigné')}
                                                            </span>
                                                            {activeBillingProfile ? (
                                                                <span className="block truncate text-xs text-muted-foreground">
                                                                    {formatSalesConditionsSummary(activeBillingProfile.conditions, t('Vente directe'))}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    ) : (<></>)}

                                                </FormField>

                                                {!activeRow.seller_user_id ? (
                                                    <FormField label={t('Commercial')}>
                                                        {sellerOptions.length > 0 ? (
                                                            <Select
                                                                value={activeRow.seller_user_id ? String(activeRow.seller_user_id) : 'none'}
                                                                onValueChange={(val) => {
                                                                    if (val === 'none') {
                                                                        updateRow(activeIndex, {
                                                                            seller_user_id: null,
                                                                            profile_selection_key: null,
                                                                        });
                                                                        return;
                                                                    }

                                                                    const id = Number(val);
                                                                    if (!Number.isInteger(id) || id <= 0) {
                                                                        return;
                                                                    }

                                                                    updateRow(activeIndex, {
                                                                        seller_user_id: id,
                                                                        profile_selection_key: null,
                                                                    });
                                                                }}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={t('Select a commercial')} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="none">{t('No commercial')}</SelectItem>
                                                                    {sellerOptions.map((seller) => (
                                                                        <SelectItem key={seller.value} value={seller.value}>
                                                                            {seller.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <Input
                                                                disabled
                                                                readOnly
                                                                value={t('No commercial')}
                                                                placeholder={t('Commercial')}
                                                            />
                                                        )}
                                                        <Select
                                                            value={selectedProfileKey}
                                                            onValueChange={(val) => {
                                                                if (val === '__custom__') {
                                                                    updateRow(activeIndex, {
                                                                        profile_selection_key: '__custom__',
                                                                        conditions_override: {},
                                                                    });
                                                                } else {
                                                                    const profile = billingProfiles.find((item) => item.key === val);
                                                                    if (profile) {
                                                                        const resolvedProfile = normalizeConditions({
                                                                            ...inheritedConditions,
                                                                            ...profile.conditions,
                                                                        });

                                                                        updateRow(activeIndex, {
                                                                            profile_selection_key: profile.key,
                                                                            conditions_override: diffConditions(inheritedConditions, resolvedProfile),
                                                                        });
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={t('Select a billing profile')} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__custom__">{t('Paramétrage custom')}</SelectItem>
                                                                {billingProfiles.map((profile) => (
                                                                    <SelectItem key={profile.key} value={profile.key}>
                                                                        <span className="block">{profile.label}</span>
                                                                        <span className="block text-xs text-muted-foreground">
                                                                            {formatSalesConditionsSummary(profile.conditions, t('Vente directe'))}
                                                                        </span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormField>
                                                ) : (
                                                    <FormField label={t('Commercial')}>
                                                        <Select
                                                            value={activeRow.seller_user_id ? String(activeRow.seller_user_id) : 'none'}
                                                            onValueChange={(val) => {
                                                                if (val === 'none') {
                                                                    updateRow(activeIndex, {
                                                                        seller_user_id: null,
                                                                        profile_selection_key: null,
                                                                    });
                                                                    return;
                                                                }

                                                                const id = Number(val);
                                                                if (!Number.isInteger(id) || id <= 0) {
                                                                    return;
                                                                }

                                                                updateRow(activeIndex, {
                                                                    seller_user_id: id,
                                                                    profile_selection_key: null,
                                                                });
                                                            }}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={t('Select a commercial')} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">{t('No commercial')}</SelectItem>
                                                                {sellerOptions.map((seller) => (
                                                                    <SelectItem key={seller.value} value={seller.value}>
                                                                        {seller.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <Select
                                                            value={selectedProfileKey}
                                                            onValueChange={(val) => {
                                                                if (val === '__custom__') {
                                                                    updateRow(activeIndex, {
                                                                        profile_selection_key: '__custom__',
                                                                        conditions_override: {},
                                                                    });
                                                                } else {
                                                                    const profile = sellerProfiles.find((item) => item.key === val);
                                                                    if (profile) {
                                                                        const resolvedProfile = normalizeConditions({
                                                                            ...inheritedConditions,
                                                                            ...profile.conditions,
                                                                        });

                                                                        updateRow(activeIndex, {
                                                                            profile_selection_key: profile.key,
                                                                            conditions_override: diffConditions(inheritedConditions, resolvedProfile),
                                                                        });
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder={t('Select a seller profile')} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__custom__">{t('Paramétrage custom')}</SelectItem>
                                                                {sellerProfiles.map((profile) => (
                                                                    <SelectItem key={profile.key} value={profile.key}>
                                                                        <span className="block">{profile.label}</span>
                                                                        <span className="block text-xs text-muted-foreground">
                                                                            {formatSalesConditionsSummary(profile.conditions, t('Vente directe'))}
                                                                        </span>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormField>
                                                )}

                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <FormField label={t('Price mode')}>
                                                    <Select value={normalizePriceMode(merged.p)} onValueChange={(v) => updateWithoutChangingProfile({ p: v })}>
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="-1">{t('Auto (inherits from parent)')}</SelectItem>
                                                            <SelectItem value="price_depart">{t('Departure price')}</SelectItem>
                                                            <SelectItem value="price_render">{t('Rendered price')}</SelectItem>
                                                            <SelectItem value="price">{t('Base price')}</SelectItem>
                                                            <SelectItem value="price_floor">{t('Floor price')}</SelectItem>
                                                            <SelectItem value="price_roll">{t('Roll price')}</SelectItem>
                                                            <SelectItem value="price_promo">{t('Promo price')}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </FormField>

                                            </div>

                                            {selectedProfileKey === '__custom__' ? (
                                                <SalesConditionsForm
                                                    value={merged}
                                                    onChange={(next) => updateRow(activeIndex, {
                                                        profile_selection_key: '__custom__',
                                                        conditions_override: diffConditions(inheritedConditions, normalizeConditions(next)),
                                                    })}
                                                    carriers={carriersList}
                                                    mode="client"
                                                />
                                            ) : null}

                                            <Separator />

                                            <div className="space-y-4">
                                                <FormField label={t('Carriers')}>
                                                    <div className="space-y-2">
                                                        {carrierAssignments.map((assignment, index) => {
                                                            const carrierZones = carriersList.find((c) => c.id === assignment.carrier_id)?.zones ?? [];
                                                            return (
                                                                <div key={index} className="flex items-center gap-2">
                                                                    <Select
                                                                        value={assignment.carrier_id !== null ? String(assignment.carrier_id) : 'none'}
                                                                        onValueChange={(v) => {
                                                                            const next = [...carrierAssignments];
                                                                            next[index] = { carrier_id: v === 'none' ? null : Number(v), zone_id: null };
                                                                            updateCarrierAssignments(next);
                                                                        }}
                                                                    >
                                                                        <SelectTrigger className="flex-1">
                                                                            <SelectValue placeholder={t('Select a carrier')} />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="none">{t('None')}</SelectItem>
                                                                            {carriersList.map((carrier) => (
                                                                                <SelectItem key={carrier.id} value={String(carrier.id)}>
                                                                                    {carrier.name}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Select
                                                                        value={assignment.zone_id !== null ? String(assignment.zone_id) : 'none'}
                                                                        onValueChange={(v) => {
                                                                            const next = [...carrierAssignments];
                                                                            next[index] = { ...next[index], zone_id: v === 'none' ? null : Number(v) };
                                                                            updateCarrierAssignments(next);
                                                                        }}
                                                                        disabled={!assignment.carrier_id}
                                                                    >
                                                                        <SelectTrigger className="flex-1">
                                                                            <SelectValue placeholder={t('Select a zone')} />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="none">{t('None')}</SelectItem>
                                                                            {carrierZones.map((zone) => (
                                                                                <SelectItem key={zone.id} value={String(zone.id)}>
                                                                                    {zone.name}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                    <Input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        className="h-9 w-20"
                                                                        placeholder={t('TVA %')}
                                                                        value={index in carrierTvaRaw ? carrierTvaRaw[index] : (assignment.tva !== null && assignment.tva !== undefined ? String(assignment.tva) : '')}
                                                                        onChange={(e) => {
                                                                            setCarrierTvaRaw((prev) => ({ ...prev, [index]: e.target.value }));
                                                                            const num = toNumber(e.target.value);
                                                                            if (Number.isFinite(num)) {
                                                                                const next = [...carrierAssignments];
                                                                                next[index] = { ...next[index], tva: num };
                                                                                updateCarrierAssignments(next);
                                                                            }
                                                                        }}
                                                                        onBlur={() => setCarrierTvaRaw((prev) => {
                                                                            const next = { ...prev };
                                                                            delete next[index];
                                                                            return next;
                                                                        })}
                                                                    />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-9 w-9 shrink-0 text-destructive"
                                                                        onClick={() => {
                                                                            const next = carrierAssignments.filter((_, i) => i !== index);
                                                                            updateCarrierAssignments(next);
                                                                        }}
                                                                    >
                                                                        <TrashIcon className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            );
                                                        })}
                                                        <ButtonsActions
                                                            add={() => updateCarrierAssignments([...carrierAssignments, { carrier_id: null, zone_id: null }])}
                                                        />
                                                    </div>
                                                </FormField>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <FormField label={t('Delivery (€)')}>
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={deliveryRaw || String(merged.l ?? 0)}
                                                            onChange={(e) => {
                                                                setDeliveryRaw(e.target.value);
                                                                const num = toNumber(e.target.value);
                                                                if (Number.isFinite(num)) {
                                                                    update({ l: num });
                                                                }
                                                            }}
                                                            onBlur={() => setDeliveryRaw('')}
                                                        />
                                                    </FormField>
                                                    <FormField label={t('Minimum delivery (€)')}>
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={lmRaw || String(merged.lm ?? 0)}
                                                            onChange={(e) => {
                                                                setLmRaw(e.target.value);
                                                                const num = toNumber(e.target.value);
                                                                if (Number.isFinite(num)) {
                                                                    update({ lm: num });
                                                                }
                                                            }}
                                                            onBlur={() => setLmRaw('')}
                                                        />
                                                    </FormField>

                                                    <FormField label={t('Transport VAT (%)')}>
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={tvatRaw !== '' ? tvatRaw : (merged.tvat === null || merged.tvat === undefined ? '' : String(merged.tvat))}
                                                            onChange={(e) => {
                                                                setTvatRaw(e.target.value);
                                                                const num = toNumber(e.target.value);
                                                                update({ tvat: e.target.value === '' ? null : (Number.isFinite(num) ? num : merged.tvat) });
                                                            }}
                                                            onBlur={() => setTvatRaw('')}
                                                        />
                                                    </FormField>

                                                </div>
                                            </div>
                                        </CardContent>
                                    </>
                                )}
                            </Card>
                        </div>
                    </Form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
