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
import { TrashIcon, ServerIcon } from 'lucide-react';
import SalesConditionsForm from '@/components/sales/sales-conditions-form';
import { Separator } from '@/components/ui/separator';
import { normalizeBillingDefaultsToProfiles } from '@/lib/billing-defaults';

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
};

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

const DEFAULT_VALUES: SalesConditions = {
    m: 0,
    mm: 0,
    pd: 0,
    h: 1,
    l: 0,
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

    const [rows, setRows] = useState<SalesConditionDraft[]>(() => {
        const existing = Array.isArray(salesConditions) ? salesConditions : [];
        if (existing.length > 0) {
            return existing.map((row) => ({
                db_product_id: Number(row.db_product_id),
                billing_user_id: row.billing_user_id ? Number(row.billing_user_id) : null,
                seller_user_id: row.seller_user_id !== null && row.seller_user_id !== undefined ? Number(row.seller_user_id) : null,
                conditions_override: normalizeConditions(row.conditions_override ?? {}),
            }));
        }

        return (selectedDbId ?? []).map((id) => ({
            db_product_id: Number(id),
            billing_user_id: null,
            seller_user_id: null,
            conditions_override: {},
        }));
    });

    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [selectedProfileKey, setSelectedProfileKey] = useState<string>('');

    const dbOptions = useMemo(
        () => dbProductsList.map((db) => ({ value: String(db.id), label: String(db.name) })),
        [dbProductsList],
    );

    const availableDbOptions = useMemo(() => {
        const selected = new Set(rows.map((row) => Number(row.db_product_id)));
        return dbOptions.filter((option) => !selected.has(Number(option.value)));
    }, [dbOptions, rows]);

    const activeRow = rows[activeIndex] ?? null;

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

    useEffect(() => {
        if (!activeRow) return;
        if (billingOptions.length === 1 && !activeRow.billing_user_id) {
            updateRow(activeIndex, { billing_user_id: Number(billingOptions[0].value), seller_user_id: null });
        }
    }, [billingOptions, activeRow?.billing_user_id, activeIndex]);

    useEffect(() => {
        if (!activeRow) return;
        if (sellerOptions.length === 1 && !activeRow.seller_user_id) {
            updateRow(activeIndex, { seller_user_id: Number(sellerOptions[0].value) });
        }
    }, [sellerOptions, activeRow?.seller_user_id, activeIndex]);

    const activeSellerData = useMemo(() => {
        if (!activeRow || !activeRow.billing_user_id || !activeRow.seller_user_id) {
            return null;
        }

        const db = dbById.get(Number(activeRow.db_product_id));
        const billing = (db?.billing_users ?? []).find((row) => Number(row.id) === Number(activeRow.billing_user_id));
        return (billing?.sellers ?? []).find((seller) => Number(seller.id) === Number(activeRow.seller_user_id)) ?? null;
    }, [activeRow, dbById]);

    const activeBillingProfileName = useMemo(() => {
        if (!activeSellerData || !activeRow?.billing_user_id) {
            return '';
        }

        const db = dbById.get(Number(activeRow.db_product_id));
        const billing = (db?.billing_users ?? []).find((row) => Number(row.id) === Number(activeRow.billing_user_id));
        if (!billing) {
            return '';
        }

        const billingDefaults = normalizeBillingDefaultsToProfiles(billing.defaults);
        const profileId = activeSellerData.use_billing_profile
            ? (activeSellerData.billing_profile_id ?? billingDefaults.default_profile_id ?? null)
            : null;

        if (!profileId) {
            return t('Paramétrage custom');
        }

        const profile = billingDefaults.profiles.find((p) => p.id === String(profileId));
        return profile?.name ?? String(profileId);
    }, [activeSellerData, activeRow, dbById, t]);

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

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('User database association'), href: '#' }];

    const updateRow = (index: number, patch: Partial<SalesConditionDraft>) => {
        setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
    };

    const merged: SalesConditions = { ...DEFAULT_VALUES, ...(activeRow?.conditions_override ?? {}) };
    const currentCarrierId = merged.t !== null && merged.t !== undefined ? Number(merged.t) : null;
    const zones = carriersList.find((carrier) => carrier.id === currentCarrierId)?.zones ?? [];

    const update = (key: keyof SalesConditions, nextValue: SalesConditions[keyof SalesConditions]) => {
        setRows((prev) => prev.map((row, rowIndex) => (rowIndex === activeIndex ? { ...row, conditions_override: { ...DEFAULT_VALUES, ...(row.conditions_override ?? {}), [key]: nextValue } } : row)));
    };

    const submit = () => {
        const normalizedRows = rows
            .filter((row) => Number(row.db_product_id) > 0 && Number(row.billing_user_id ?? 0) > 0)
            .map((row) => ({
                db_product_id: Number(row.db_product_id),
                billing_user_id: Number(row.billing_user_id),
                seller_user_id: row.seller_user_id ? Number(row.seller_user_id) : null,
                conditions_override: normalizeConditions(row.conditions_override),
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
                                <FormField label={<><ServerIcon className="inline mx-2" /> {t('Select DB product')}</>}>
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

                                                return [...prev, { db_product_id: id, billing_user_id: null, seller_user_id: null, conditions_override: {} }];
                                            });
                                            setActiveIndex(rows.length);
                                            setSearch('');
                                        }}
                                        propositions={availableDbOptions}
                                        selection={[]}
                                        loading={false}
                                        minQueryLength={0}
                                    />
                                </FormField>

                                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                                    {rows.map((row, index) => {
                                        const db = dbById.get(Number(row.db_product_id));
                                        if (!db) {
                                            return null;
                                        }

                                        return (
                                            <div key={`${row.db_product_id}-${index}`} className="flex items-center justify-between gap-2">
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
                                            <CardTitle>{dbById.get(Number(activeRow.db_product_id))?.name}</CardTitle>
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
                                                            value={activeRow.billing_user_id ? (billingOptions.find((opt) => Number(opt.value) === Number(activeRow.billing_user_id))?.label ?? '') : ''}
                                                            onChange={() => undefined}
                                                            onSubmit={(value) => {
                                                                const id = Number(value.trim().split(/\s+/).pop() ?? '');
                                                                if (!Number.isInteger(id) || id <= 0) {
                                                                    return;
                                                                }

                                                                updateRow(activeIndex, {
                                                                    billing_user_id: id,
                                                                    seller_user_id: null,
                                                                });
                                                            }}
                                                            propositions={billingOptions}
                                                            selection={
                                                                activeRow.billing_user_id
                                                                    ? billingOptions.filter((opt) => Number(opt.value) === Number(activeRow.billing_user_id))
                                                                    : []
                                                            }
                                                            loading={false}
                                                            minQueryLength={0}
                                                        />
                                                    )}
                                                    <Input
                                                        disabled
                                                        readOnly
                                                        value={activeBillingProfileName}
                                                        placeholder={t('Profil facturant assigné')}
                                                    />
                                                </FormField>

                                                {sellerOptions.length > 0 && (
                                                <FormField label={t('Commercial')}>
                                                    {sellerOptions.length <= 1 ? (
                                                        <Input
                                                            disabled
                                                            readOnly
                                                            value={sellerOptions[0]?.label ?? ''}
                                                            placeholder={t('Commercial')}
                                                        />
                                                    ) : (
                                                        <SearchSelect
                                                            value={activeRow.seller_user_id ? (sellerOptions.find((opt) => Number(opt.value) === Number(activeRow.seller_user_id))?.label ?? '') : ''}
                                                            onChange={() => undefined}
                                                            onSubmit={(value) => {
                                                                const id = Number(value.trim().split(/\s+/).pop() ?? '');
                                                                if (!Number.isInteger(id) || id <= 0) {
                                                                    return;
                                                                }

                                                                updateRow(activeIndex, { seller_user_id: id });
                                                            }}
                                                            propositions={sellerOptions}
                                                            selection={
                                                                activeRow.seller_user_id
                                                                    ? sellerOptions.filter((opt) => Number(opt.value) === Number(activeRow.seller_user_id))
                                                                    : []
                                                            }
                                                            loading={false}
                                                            minQueryLength={0}
                                                        />
                                                    )}
                                                    <Select
                                                        value={selectedProfileKey}
                                                        onValueChange={(val) => {
                                                            setSelectedProfileKey(val);
                                                            if (val === '__custom__') {
                                                                updateRow(activeIndex, { conditions_override: {} });
                                                            } else {
                                                                const profile = sellerProfiles.find((item) => item.key === val);
                                                                if (profile) {
                                                                    updateRow(activeIndex, { conditions_override: normalizeConditions(profile.conditions) });
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
                                                                <SelectItem key={profile.key} value={profile.key}>{profile.label}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                 </FormField>
                                                )}

                                             </div>

                                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                 <FormField label={t('Price mode')}>
                                                    <Select value={normalizePriceMode(merged.p)} onValueChange={(v) => update('p', v)}>
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
                                                    value={activeRow.conditions_override ?? {}}
                                                    onChange={(next) => updateRow(activeIndex, { conditions_override: normalizeConditions(next) })}
                                                    carriers={carriersList}
                                                    mode="client"
                                                />
                                            ) : null}

                                            <Separator />

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <FormField label={t('Higher roll')}>
                                                    <Input
                                                        type="checkbox"
                                                        checked={Number(merged.h ?? 0) === 1}
                                                        onChange={(e) => update('h', e.target.checked ? 1 : 0)}
                                                    />
                                                </FormField>
                                                <FormField label={t('Carrier')}>
                                                    <Select
                                                        value={currentCarrierId !== null ? String(currentCarrierId) : 'none'}
                                                        onValueChange={(v) => {
                                                            const nextCarrierId = v === 'none' ? null : Number(v);
                                                            update('t', nextCarrierId);
                                                            if (!nextCarrierId) {
                                                                update('z', null);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger>
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
                                                </FormField>
                                                <FormField label={t('Zone')}>
                                                    <Select
                                                        value={merged.z !== null && merged.z !== undefined ? String(merged.z) : 'none'}
                                                        onValueChange={(v) => update('z', v === 'none' ? null : Number(v))}
                                                        disabled={!currentCarrierId}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={t('Select a zone')} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">{t('None')}</SelectItem>
                                                            {zones.map((zone) => (
                                                                <SelectItem key={zone.id} value={String(zone.id)}>
                                                                    {zone.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormField>
                                                <FormField label={t('Delivery (€)')}>
                                                    <Input type="number" step="0.01" value={String(merged.l ?? 0)} onChange={(e) => update('l', toNumber(e.target.value))} />
                                                </FormField>

                                                <FormField label={t('Transport VAT (%)')}>
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={merged.tvat === null || merged.tvat === undefined ? '' : String(merged.tvat)}
                                                        onChange={(e) => update('tvat', e.target.value === '' ? null : toNumber(e.target.value))}
                                                    />
                                                 </FormField>

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
