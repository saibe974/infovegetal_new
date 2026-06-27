import { withAppLayout } from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { type BreadcrumbItem, type BillingUserRule, type SalesConditions, type dbProduct } from '@/types';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import SearchSelect from '@/components/app/search-select';
import ProductImportConfigPanel from '@/components/products/import-config-panel';
import SalesConditionsForm from '@/components/sales/sales-conditions-form';
import { useI18n } from '@/lib/i18n';
import products from '@/routes/products';
import dbProducts from '@/routes/db-products';
import { ArrowLeftCircle, InfoIcon, RowsIcon, SaveIcon, ShellIcon, TrashIcon } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type Props = {
    dbProduct: dbProduct;
    categoryOptions: { id: number; name: string }[];
    eligibleUsers: { id: number; name: string; email: string }[];
    carriers: Array<{
        id: number;
        name: string;
        country?: string | null;
        zones?: Array<{ id: number; carrier_id: number; name: string }>;
    }>;
};

type KVPair = { key: string; value: string };
type EditTab = 'info' | 'billing' | 'mapping';

type SellerDraft = {
    seller_user_id: number;
    conditions_override: SalesConditions;
};

type BillingDraft = {
    billing_user_id: number;
    defaults: SalesConditions;
    sellers: SellerDraft[];
};

const objectToKV = (obj: Record<string, unknown> | null | undefined): KVPair[] => {
    if (!obj) return [];
    return Object.entries(obj).map(([key, value]) => ({ key, value: String(value ?? '') }));
};

const kvToObject = (pairs: KVPair[]): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const { key, value } of pairs) {
        const k = key.trim();
        if (k) result[k] = value;
    }
    return result;
};

const normalizeConditions = (value: SalesConditions | undefined): SalesConditions => {
    if (!value) {
        return {};
    }

    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return Object.fromEntries(entries);
};

const normalizeBillingUsers = (rules: BillingDraft[]): BillingDraft[] => {
    return rules.map((rule) => ({
        billing_user_id: Number(rule.billing_user_id),
        defaults: normalizeConditions(rule.defaults),
        sellers: (rule.sellers ?? []).map((seller) => ({
            seller_user_id: Number(seller.seller_user_id),
            conditions_override: normalizeConditions(seller.conditions_override),
        })),
    }));
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
        title: 'Edit',
        href: '#',
    },
];

export default withAppLayout<Props>(breadcrumbs, true, ({ dbProduct, categoryOptions, eligibleUsers, carriers }) => {
    const { t } = useI18n();
    const isCreate = dbProduct.id == null;

    const [activeTab, setActiveTab] = useState<EditTab>('info');
    const [billingSearch, setBillingSearch] = useState('');
    const [sellerSearch, setSellerSearch] = useState('');

    const initialBillingUsers: BillingDraft[] = useMemo(() => {
        const rows = Array.isArray(dbProduct.billing_users) ? (dbProduct.billing_users as BillingUserRule[]) : [];

        return rows.map((row) => ({
            billing_user_id: Number(row.id),
            defaults: normalizeConditions(row.defaults ?? {}),
            sellers: (row.sellers ?? []).map((seller) => ({
                seller_user_id: Number(seller.id),
                conditions_override: normalizeConditions(seller.conditions_override ?? {}),
            })),
        }));
    }, [dbProduct.billing_users]);

    const [activeBillingUserId, setActiveBillingUserId] = useState<number | null>(
        initialBillingUsers.length > 0 ? initialBillingUsers[0].billing_user_id : null,
    );
    const [activeSellerId, setActiveSellerId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, transform } = useForm({
        name: dbProduct.name ?? '',
        description: dbProduct.description ?? '',
        champs: objectToKV(dbProduct.champs),
        categories: objectToKV(dbProduct.categories),
        traitement: dbProduct.traitement ?? '',
        country: dbProduct.country ?? '',
        mod_liv: dbProduct.mod_liv ?? '',
        mini: dbProduct.mini !== null && dbProduct.mini !== undefined ? String(dbProduct.mini) : '',
        billing_users: initialBillingUsers,
        billable_user_ids: (dbProduct.billable_user_ids ?? []).map((id) => Number(id)),
    });

    const errorBag = errors as Record<string, string>;

    const userOptionById = useMemo(
        () => new Map((eligibleUsers ?? []).map((user) => [user.id, { value: String(user.id), label: `${user.name} (${user.email})` }])),
        [eligibleUsers],
    );

    const billingOptions = useMemo(
        () => (eligibleUsers ?? []).map((user) => ({ value: String(user.id), label: `${user.name} (${user.email})` })),
        [eligibleUsers],
    );

    const activeBillingRule = useMemo(() => {
        if (activeBillingUserId === null) {
            return null;
        }

        return (data.billing_users ?? []).find((rule) => Number(rule.billing_user_id) === Number(activeBillingUserId)) ?? null;
    }, [activeBillingUserId, data.billing_users]);

    const availableBillingOptions = useMemo(() => {
        const selected = new Set((data.billing_users ?? []).map((rule) => Number(rule.billing_user_id)));
        return billingOptions.filter((option) => !selected.has(Number(option.value)));
    }, [billingOptions, data.billing_users]);

    const availableSellerOptions = useMemo(() => {
        const selected = new Set((activeBillingRule?.sellers ?? []).map((seller) => Number(seller.seller_user_id)));
        return billingOptions.filter((option) => !selected.has(Number(option.value)));
    }, [activeBillingRule?.sellers, billingOptions]);

    const categoryValueOptions = useMemo(
        () => categoryOptions.map((category) => ({ value: String(category.id), label: `${category.id} - ${category.name}` })),
        [categoryOptions],
    );

    const updateBillingRule = (billingUserId: number, updater: (rule: BillingDraft) => BillingDraft) => {
        setData('billing_users', (data.billing_users ?? []).map((rule) => {
            if (Number(rule.billing_user_id) !== Number(billingUserId)) {
                return rule;
            }

            return updater(rule);
        }));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        transform((d) => {
            const normalizedRules = normalizeBillingUsers(d.billing_users ?? []);
            const billableUserIds = normalizedRules.map((rule) => Number(rule.billing_user_id));

            return {
                ...d,
                champs: kvToObject(d.champs),
                categories: kvToObject(d.categories),
                mini: d.mini === '' ? null : Number(d.mini),
                billing_users: normalizedRules,
                billable_user_ids: billableUserIds,
            };
        });

        const submit = isCreate ? post : put;
        const url = isCreate ? dbProducts.store().url : dbProducts.update(dbProduct.id as number).url;

        submit(url, {
            onFinish: () => transform((d) => d),
        });
    };

    return (
        <>
            <Head title={isCreate ? t('Add Database') : `${t('Edit')} - ${dbProduct.name}`} />

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
                                <h1 className="text-3xl font-bold capitalize">{dbProduct.name || t('New database')}</h1>
                            </div>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <Button type="button" variant={activeTab === 'info' ? 'default' : 'outline'} onClick={() => setActiveTab('info')}>
                                <InfoIcon size={20} className="mr-2" />
                                {t('Info')}
                            </Button>
                            <Button type="button" variant={activeTab === 'billing' ? 'default' : 'outline'} onClick={() => setActiveTab('billing')}>
                                <ShellIcon size={20} className="mr-2" />
                                {t('Billing')}
                            </Button>
                            <Button type="button" variant={activeTab === 'mapping' ? 'default' : 'outline'} onClick={() => setActiveTab('mapping')}>
                                <RowsIcon size={20} className="mr-2" />
                                {t('Mapping')}
                            </Button>
                            <Button type="submit" disabled={processing}>
                                <SaveIcon size={20} className="mr-2" />
                                {isCreate ? t('Create') : t('Save')}
                            </Button>
                        </div>
                    </StickyBar>

                    {activeTab === 'info' && (
                        <div className="flex-1 w-full max-w-[1200px] mx-auto">
                            <Card className="p-6 space-y-4">
                                <FormField label={t('Name')} htmlFor="db-name">
                                    <Input id="db-name" value={data.name} onChange={(e) => setData('name', e.target.value)} />
                                    <InputError message={errors.name} />
                                </FormField>

                                <FormField label={t('Description')} htmlFor="db-description">
                                    <Input id="db-description" value={data.description} onChange={(e) => setData('description', e.target.value)} />
                                    <InputError message={errors.description} />
                                </FormField>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField label={t('Country')} htmlFor="db-country">
                                        <Input id="db-country" maxLength={2} placeholder="fr" value={data.country} onChange={(e) => setData('country', e.target.value.toLowerCase())} />
                                        <InputError message={errors.country} />
                                    </FormField>

                                    <FormField label={t('Delivery mode')} htmlFor="db-mod-liv">
                                        <Input id="db-mod-liv" value={data.mod_liv} onChange={(e) => setData('mod_liv', e.target.value)} />
                                        <InputError message={errorBag.mod_liv} />
                                    </FormField>

                                    <FormField label={t('Minimum rolls')} htmlFor="db-mini">
                                        <Input id="db-mini" type="number" min={0} value={data.mini} onChange={(e) => setData('mini', e.target.value)} />
                                        <InputError message={errors.mini} />
                                    </FormField>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'billing' && (
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <Card className="p-6 space-y-4">
                                <FormField label={t('Billing users')}>
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
                                                { billing_user_id: id, defaults: {}, sellers: [] },
                                            ];
                                            setData('billing_users', nextRules);
                                            setActiveBillingUserId(id);
                                            setActiveSellerId(null);
                                            setBillingSearch('');
                                        }}
                                        propositions={availableBillingOptions}
                                        selection={[]}
                                        loading={false}
                                        minQueryLength={0}
                                    />
                                    <InputError message={errorBag.billable_user_ids || errorBag.billing_users} />
                                </FormField>

                                <div className="space-y-2 max-h-[420px] overflow-y-auto">
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
                                                        setActiveSellerId(null);
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
                                                            setActiveBillingUserId(next.length > 0 ? Number(next[0].billing_user_id) : null);
                                                            setActiveSellerId(null);
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

                            <Card className="p-6 xl:col-span-2 space-y-4">
                                {!activeBillingRule ? (
                                    <p className="text-sm text-muted-foreground">{t('Select a billing user from the list.')}</p>
                                ) : (
                                    <>
                                        <CardHeader className="px-0">
                                            <CardTitle>
                                                {t('Default conditions')} - {userOptionById.get(Number(activeBillingRule.billing_user_id))?.label ?? `#${activeBillingRule.billing_user_id}`}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="px-0 space-y-6">
                                            <SalesConditionsForm
                                                value={activeBillingRule.defaults ?? {}}
                                                onChange={(next) => {
                                                    updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
                                                        ...rule,
                                                        defaults: normalizeConditions(next),
                                                    }));
                                                }}
                                                carriers={carriers ?? []}
                                                mode="defaults"
                                            />

                                            <Separator />

                                            <div className="space-y-4">
                                                <FormField label={t('Sellers')}>
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
                                                                    sellers: [...(rule.sellers ?? []), { seller_user_id: id, conditions_override: {} }],
                                                                };
                                                            });
                                                            setActiveSellerId(id);
                                                            setSellerSearch('');
                                                        }}
                                                        propositions={availableSellerOptions}
                                                        selection={[]}
                                                        loading={false}
                                                        minQueryLength={0}
                                                    />
                                                </FormField>

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
                                                                    className={`text-left rounded-md px-3 py-2 w-full border ${activeSellerId === id ? 'bg-muted border-primary' : 'border-border'}`}
                                                                    onClick={() => setActiveSellerId(id)}
                                                                >
                                                                    <span className="font-medium">{option.label}</span>
                                                                </button>
                                                                <Button
                                                                    type="button"
                                                                    variant="destructive-outline"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
                                                                            ...rule,
                                                                            sellers: (rule.sellers ?? []).filter((current) => Number(current.seller_user_id) !== id),
                                                                        }));
                                                                        if (activeSellerId === id) {
                                                                            setActiveSellerId(null);
                                                                        }
                                                                    }}
                                                                >
                                                                    <TrashIcon className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {activeSellerId !== null && (
                                                <>
                                                    <Separator />
                                                    <div className="space-y-3">
                                                        <h3 className="text-base font-semibold">
                                                            {t('Seller override')} - {userOptionById.get(activeSellerId)?.label ?? `#${activeSellerId}`}
                                                        </h3>
                                                        <SalesConditionsForm
                                                            value={(activeBillingRule.sellers ?? []).find((seller) => Number(seller.seller_user_id) === Number(activeSellerId))?.conditions_override ?? {}}
                                                            onChange={(next) => {
                                                                updateBillingRule(Number(activeBillingRule.billing_user_id), (rule) => ({
                                                                    ...rule,
                                                                    sellers: (rule.sellers ?? []).map((seller) => {
                                                                        if (Number(seller.seller_user_id) !== Number(activeSellerId)) {
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
                                                    </div>
                                                </>
                                            )}
                                        </CardContent>
                                    </>
                                )}
                            </Card>
                        </div>
                    )}

                    {activeTab === 'mapping' && (
                        <div className="flex-1 w-full max-w-[1200px] mx-auto space-y-6">
                            <Card className="p-6 space-y-4">
                                <h2 className="text-base font-semibold">{t('Column mapping (champs)')}</h2>
                                {!isCreate ? (
                                    <ProductImportConfigPanel
                                        dbProductId={dbProduct.id as number}
                                        headerRowIndex={dbProduct.header_row_index}
                                        sourceDelimiter={dbProduct.source_delimiter}
                                    />
                                ) : null}
                                <Separator />
                                <div className="space-y-2">
                                    {data.champs.map((pair, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <Input
                                                className="flex-1 font-mono text-sm"
                                                placeholder={t('CSV column')}
                                                value={pair.key}
                                                onChange={(e) => {
                                                    const next = [...data.champs];
                                                    next[i] = { ...next[i], key: e.target.value };
                                                    setData('champs', next);
                                                }}
                                            />
                                            <Input
                                                className="flex-1 font-mono text-sm"
                                                placeholder={t('Product field')}
                                                value={pair.value}
                                                onChange={(e) => {
                                                    const next = [...data.champs];
                                                    next[i] = { ...next[i], value: e.target.value };
                                                    setData('champs', next);
                                                }}
                                            />
                                        </div>
                                    ))}
                                    <Button type="button" size="sm" variant="outline" onClick={() => setData('champs', [...data.champs, { key: '', value: '' }])}>
                                        + {t('Add')}
                                    </Button>
                                </div>
                            </Card>

                            <Card className="p-6 space-y-4">
                                <h2 className="text-base font-semibold">{t('Category mapping (categories)')}</h2>
                                <Separator />
                                <div className="space-y-2">
                                    {data.categories.map((pair, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <Input
                                                className="flex-1 font-mono text-sm"
                                                placeholder={t('Supplier slug')}
                                                value={pair.key}
                                                onChange={(e) => {
                                                    const next = [...data.categories];
                                                    next[i] = { ...next[i], key: e.target.value };
                                                    setData('categories', next);
                                                }}
                                            />
                                            <SearchSelect
                                                value={pair.value}
                                                onChange={(v) => {
                                                    const next = [...data.categories];
                                                    next[i] = { ...next[i], value: v };
                                                    setData('categories', next);
                                                }}
                                                onSubmit={(v) => {
                                                    const next = [...data.categories];
                                                    next[i] = { ...next[i], value: v.trim().split(/\s+/).pop() ?? '' };
                                                    setData('categories', next);
                                                }}
                                                propositions={categoryValueOptions}
                                                selection={[]}
                                                loading={false}
                                                minQueryLength={0}
                                            />
                                        </div>
                                    ))}
                                    <Button type="button" size="sm" variant="outline" onClick={() => setData('categories', [...data.categories, { key: '', value: '' }])}>
                                        + {t('Add')}
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}
                </form>
            </div>
        </>
    );
});
