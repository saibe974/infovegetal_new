import { Head, router, usePage, Form } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { Button } from '@/components/ui/button';
import { BreadcrumbItem, type SharedData, type User, type dbProduct, type ClientSalesCondition, type SalesConditions } from '@/types';
import { useI18n } from '@/lib/i18n';
import { FormField } from '@/components/ui/form-field';
import SearchSelect from '@/components/app/search-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StickyBar } from '@/components/ui/sticky-bar';
import { TrashIcon, ServerIcon } from 'lucide-react';
import SalesConditionsForm from '@/components/sales/sales-conditions-form';

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
            label: `${billing.name} (${billing.email})`,
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
            label: `${seller.name} (${seller.email})`,
        }));
    }, [activeRow, dbById]);

    const breadcrumbs: BreadcrumbItem[] = [{ title: t('User database association'), href: '#' }];

    const updateRow = (index: number, patch: Partial<SalesConditionDraft>) => {
        setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
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
                    <StickyBar>
                        <Button type="button" onClick={submit}>
                            {t('Save')}
                        </Button>
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
                                                <FormField label={t('Billing user')}>
                                                    <SearchSelect
                                                        value={activeRow.billing_user_id ? String(activeRow.billing_user_id) : ''}
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
                                                </FormField>

                                                <FormField label={t('Seller')}>
                                                    <SearchSelect
                                                        value={activeRow.seller_user_id ? String(activeRow.seller_user_id) : ''}
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
                                                </FormField>
                                            </div>

                                            <SalesConditionsForm
                                                value={activeRow.conditions_override ?? {}}
                                                onChange={(next) => updateRow(activeIndex, { conditions_override: normalizeConditions(next) })}
                                                carriers={carriersList}
                                                mode="client"
                                            />
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
