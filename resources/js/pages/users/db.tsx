import { Head, router, usePage, Form } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { Button } from '@/components/ui/button';
import { BreadcrumbItem, type SharedData, type User } from '@/types';
import { useI18n } from '@/lib/i18n';
import { FormField } from '@/components/ui/form-field';
import SearchSelect from '@/components/app/search-select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

type DbProductAttributes = {
    m: number;          // marge en %
    mm: number;         // marge min par roll
    pd: number;         // coef de pondération
    h: number;          // hausse sur roll
    l: number;          // livraison
    c: string;          // catégorie de marges
    mc: number;         // marge par carton
    me: number;         // marge par étage
    mr: number;         // marge par roll
    tvap: number;       // tva produit
    tvat: number | null;// tva transport
    t: number | null;   // id transporteur
    z: number | null;   // id zone transporteur
    p: string;          // -1=auto, 0=prix départ, 1=prix rendu, ou nom de champ prix spécial
    com: number | null; // id commercial
    fact: number | null; // id facturant
};

const normalizePriceMode = (value: unknown): string => {
    if (value === null || value === undefined || value === '') {
        return '-1';
    }

    const raw = String(value).trim().toLowerCase();

    if (raw === 'price_depart' || raw === 'depart' || raw === 'departure') {
        return 'price_depart';
    }

    if (raw === 'price_render' || raw === 'price_rendu' || raw === 'render' || raw === 'rendered' || raw === 'rendu') {
        return 'price_render';
    }

    if (raw === '-1') {
        return '-1';
    }

    if (raw === '0') {
        return 'price_depart';
    }

    if (raw === '1') {
        return 'price_render';
    }

    if (raw === 'price' || raw === 'price_floor' || raw === 'price_roll' || raw === 'price_promo') {
        return raw;
    }

    return '-1';
};

const DEFAULT_ATTRIBUTES: DbProductAttributes = {
    m: 0,
    mm: 0,
    pd: 0,
    h: 1,
    l: 0,
    c: 'admin',
    mc: 0,
    me: 0,
    mr: 0,
    tvap: 0,
    tvat: null,
    t: null,
    z: null,
    p: '-1',
    com: null,
    fact: null,
};

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

type DbPageProps = SharedData & {
    user: User;
    dbProducts: Array<{ id: number; name: string; description?: string }>;
    eligibleUsers: Array<{ id: number; name: string; email: string }>;
    billableEligibleUsers: Array<{ id: number; name: string; email: string; can_sell_db_ids?: number[] }>;
    carriers: CarrierOption[];
    selectedDbId?: number[];
    dbUserAttributes?: Record<number, Partial<DbProductAttributes>>;
};

export default function UserDbPage() {
    const { user: propsUser, dbProducts, carriers, selectedDbId, dbUserAttributes, eligibleUsers, billableEligibleUsers } = usePage<DbPageProps>().props;
    const carrierOptions: CarrierOption[] = Array.isArray(carriers) ? carriers : [];
    const commercialUserOptions = useMemo(() => {
        const list = Array.isArray(eligibleUsers) ? eligibleUsers : [];
        return list.map((user) => ({
            value: String(user.id),
            label: `${user.name} (${user.email})`,
        }));
    }, [eligibleUsers]);
    const billableUserOptions = useMemo(() => {
        const list = Array.isArray(billableEligibleUsers) ? billableEligibleUsers : [];
        return list.map((user) => ({
            value: String(user.id),
            label: `${user.name} (${user.email})`,
        }));
    }, [billableEligibleUsers]);
    const commercialUserOptionById = useMemo(() => {
        return new Map(commercialUserOptions.map((option) => [Number(option.value), option]));
    }, [commercialUserOptions]);
    const billableUserOptionById = useMemo(() => {
        return new Map(billableUserOptions.map((option) => [Number(option.value), option]));
    }, [billableUserOptions]);
    const billableUserOptionsByDbId = useMemo(() => {
        const list = Array.isArray(billableEligibleUsers) ? billableEligibleUsers : [];
        const byDbId = new Map<number, Array<{ value: string; label: string }>>();

        for (const user of list) {
            const option = { value: String(user.id), label: `${user.name} (${user.email})` };
            for (const dbId of user.can_sell_db_ids ?? []) {
                if (!byDbId.has(dbId)) {
                    byDbId.set(dbId, []);
                }
                byDbId.get(dbId)?.push(option);
            }
        }

        return byDbId;
    }, [billableEligibleUsers]);

    const { t } = useI18n();
    const targetUser: User = propsUser;

    // État pour les attributs de chaque DB
    const [attributesByDbId, setAttributesByDbId] = useState<Record<number, DbProductAttributes>>(() => {
        const initial: Record<number, DbProductAttributes> = {};
        if (dbUserAttributes && typeof dbUserAttributes === 'object') {
            Object.entries(dbUserAttributes).forEach(([dbId, attrs]) => {
                if (attrs && typeof attrs === 'object') {
                    const merged = { ...DEFAULT_ATTRIBUTES, ...attrs as Partial<DbProductAttributes> };
                    merged.p = normalizePriceMode((attrs as Partial<DbProductAttributes>).p);
                    initial[Number(dbId)] = merged;
                } else {
                    initial[Number(dbId)] = { ...DEFAULT_ATTRIBUTES };
                }
            });
        }
        return initial;
    });

    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>(Array.isArray(selectedDbId) ? selectedDbId : []);
    const processing = false;
    const [savingDbId, setSavingDbId] = useState<number | null>(null);
    const [contactSearchByDbId, setContactSearchByDbId] = useState<Record<number, { com: string; fact: string }>>({});
    const [deliveryInputByDbId, setDeliveryInputByDbId] = useState<Record<number, string>>(() => {
        const initial: Record<number, string> = {};

        if (dbUserAttributes && typeof dbUserAttributes === 'object') {
            Object.entries(dbUserAttributes).forEach(([dbId, attrs]) => {
                const rawValue = (attrs as Partial<DbProductAttributes> | undefined)?.l;
                initial[Number(dbId)] = rawValue === null || rawValue === undefined || rawValue === 0 ? '' : String(rawValue);
            });
        }

        return initial;
    });

    // Préparer la sélection initiale pour SearchSelect
    const initialSelection = useMemo(() => {
        return (Array.isArray(selectedDbId) ? selectedDbId : []).map((id: number) => {
            const found = dbProducts.find((d) => d.id === id);
            return { value: found ? found.name : String(id), label: found ? found.name : String(id) };
        });
    }, [dbProducts, selectedDbId]);

    // Initialiser les attributs pour les nouvelles sélections
    useEffect(() => {
        setAttributesByDbId(prev => {
            const updated = { ...prev };
            selectedIds.forEach(id => {
                if (!updated[id]) {
                    updated[id] = { ...DEFAULT_ATTRIBUTES };
                }
            });
            return updated;
        });
    }, [selectedIds]);

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('User database association'),
            href: '#',
        },
    ];

    const updateAttribute = (dbId: number, key: keyof DbProductAttributes, value: unknown) => {
        const nextValue = key === 'p' ? normalizePriceMode(value) : value;
        setAttributesByDbId(prev => ({
            ...prev,
            [dbId]: {
                ...prev[dbId],
                [key]: nextValue
            }
        }));
    };

    const parseDeliveryValue = (value: string): number => {
        const normalized = value.trim().replace(',', '.');
        if (normalized === '') {
            return 0;
        }

        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const commitDeliveryValue = (dbId: number) => {
        const rawValue = deliveryInputByDbId[dbId] ?? '';
        updateAttribute(dbId, 'l', parseDeliveryValue(rawValue));
    };

    const updateContactSearch = (dbId: number, key: 'com' | 'fact', value: string) => {
        setContactSearchByDbId((prev) => ({
            ...prev,
            [dbId]: {
                com: prev[dbId]?.com ?? '',
                fact: prev[dbId]?.fact ?? '',
                [key]: value,
            },
        }));
    };

    const handleSaveDb = (dbId: number) => {
        const attrs = {
            ...(attributesByDbId[dbId] ?? DEFAULT_ATTRIBUTES),
            l: parseDeliveryValue(deliveryInputByDbId[dbId] ?? ''),
        };

        router.post(
            `/admin/users/${targetUser.id}/db`,
            {
                db_ids: [dbId],
                merge: true,
                attributes: {
                    [dbId]: attrs,
                },
            },
            {
                preserveScroll: true,
                onStart: () => setSavingDbId(dbId),
                onFinish: () => setSavingDbId(null),
            }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('User database association')} />

            <SettingsLayout>
                <Form method="post" action={`/admin/users/${targetUser.id}/db`} className="space-y-4">
                    <Card className="p-6">
                        <div className="flex flex-col gap-6">
                            <FormField label={t('Select DB product')}>
                                <SearchSelect
                                    value={search}
                                    onChange={(v) => setSearch(v)}
                                    onSubmit={(s) => {
                                        const names = s && s.trim() ? s.trim().split(/\s+/) : [];
                                        const ids = (names || []).map((name) => {
                                            const found = dbProducts.find((d) => d.name === name);
                                            return found ? found.id : null;
                                        }).filter((v) => v !== null) as number[];
                                        setSelectedIds(ids);
                                    }}
                                    propositions={dbProducts.map((d) => d.name)}
                                    selection={initialSelection}
                                    loading={false}
                                    minQueryLength={0}
                                />

                                {/* Hidden inputs for selected ids */}
                                {(selectedIds || []).map((id) => (
                                    <input key={id} type="hidden" name="db_ids[]" value={id} />
                                ))}
                            </FormField>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button disabled={processing} type="submit">{t('Save')}</Button>
                        </div>
                    </Card>

                    {/* Formulaires d'attributs pour chaque DB sélectionné */}
                    {selectedIds.length > 0 && (
                        <div className="mt-6 space-y-4">
                            {selectedIds.map((dbId) => {
                                const db = dbProducts.find((d) => d.id === dbId);
                                const attrs = attributesByDbId[dbId] || DEFAULT_ATTRIBUTES;
                                const commercialOption = attrs.com ? commercialUserOptionById.get(attrs.com) : undefined;
                                const facturantOption = attrs.fact ? billableUserOptionById.get(attrs.fact) : undefined;
                                const commercialSelection = commercialOption ? [commercialOption] : [];
                                const facturantSelection = facturantOption ? [facturantOption] : [];
                                const dbBillableUserOptions = billableUserOptionsByDbId.get(dbId) ?? [];

                                return (
                                    <Card key={dbId}>
                                        <CardHeader>
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                    <CardTitle className='text-lg'>{db ? db.name : `DB #${dbId}`}</CardTitle>
                                                    {db?.description && (
                                                        <CardDescription>{db.description}</CardDescription>
                                                    )}
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    onClick={() => handleSaveDb(dbId)}
                                                    disabled={savingDbId === dbId}
                                                >
                                                    {savingDbId === dbId ? t('Saving...') : t('Save')}
                                                </Button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* Section Contacts */}
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <FormField label="Facturant" htmlFor={`fact-${dbId}`}>
                                                        <SearchSelect
                                                            value={contactSearchByDbId[dbId]?.fact ?? ''}
                                                            onChange={(value) => updateContactSearch(dbId, 'fact', value)}
                                                            onSubmit={(value) => {
                                                                const tokens = value.trim().split(/\s+/).filter(Boolean);
                                                                const nextValue = tokens.length > 0 ? tokens[tokens.length - 1] : '';
                                                                const nextId = nextValue ? Number(nextValue) : null;
                                                                updateAttribute(dbId, 'fact', Number.isFinite(nextId) ? nextId : null);
                                                                updateContactSearch(dbId, 'fact', '');
                                                            }}
                                                            propositions={dbBillableUserOptions}
                                                            selection={facturantSelection}
                                                            loading={false}
                                                            minQueryLength={0}
                                                        />
                                                    </FormField>

                                                    <FormField label="Commercial" htmlFor={`com-${dbId}`}>
                                                        <SearchSelect
                                                            value={contactSearchByDbId[dbId]?.com ?? ''}
                                                            onChange={(value) => updateContactSearch(dbId, 'com', value)}
                                                            onSubmit={(value) => {
                                                                const tokens = value.trim().split(/\s+/).filter(Boolean);
                                                                const nextValue = tokens.length > 0 ? tokens[tokens.length - 1] : '';
                                                                const nextId = nextValue ? Number(nextValue) : null;
                                                                updateAttribute(dbId, 'com', Number.isFinite(nextId) ? nextId : null);
                                                                updateContactSearch(dbId, 'com', '');
                                                            }}
                                                            propositions={commercialUserOptions}
                                                            selection={commercialSelection}
                                                            loading={false}
                                                            minQueryLength={0}
                                                        />
                                                    </FormField>
                                                </div>
                                            </div>

                                            <Separator />

                                            {/* Section Marges */}
                                            <div className="space-y-6 ">
                                                <h3 className="text-md font-semibold">{t('Margin')}</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <FormField label={t('Margin category')} htmlFor={`c-${dbId}`}>
                                                        <Input
                                                            id={`c-${dbId}`}
                                                            type="text"
                                                            value={attrs.c}
                                                            onChange={(e) => updateAttribute(dbId, 'c', e.target.value)}
                                                        />
                                                    </FormField>

                                                    <FormField label={t('General margin (%)')} htmlFor={`m-${dbId}`}>
                                                        <Input
                                                            id={`m-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.m}
                                                            onChange={(e) => updateAttribute(dbId, 'm', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label={t('Minimum margin per roll (€)')} htmlFor={`mm-${dbId}`}>
                                                        <Input
                                                            id={`mm-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.mm}
                                                            onChange={(e) => updateAttribute(dbId, 'mm', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    {/* </div> */}
                                                    {/* <div className='grid grid-cols-1 md:grid-cols-3 gap-4 w-full'> */}
                                                    <FormField label={t('Margin per carton (%)')} htmlFor={`mc-${dbId}`}>
                                                        <Input
                                                            id={`mc-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.mc}
                                                            onChange={(e) => updateAttribute(dbId, 'mc', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label={t('Margin per level (%)')} htmlFor={`me-${dbId}`}>
                                                        <Input
                                                            id={`me-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.me}
                                                            onChange={(e) => updateAttribute(dbId, 'me', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label={t('Margin per roll (%)')} htmlFor={`mr-${dbId}`}>
                                                        <Input
                                                            id={`mr-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.mr}
                                                            onChange={(e) => updateAttribute(dbId, 'mr', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>
                                                </div>

                                            </div>

                                            <Separator />

                                            {/* Section Prix et Pondération */}
                                            <div className="space-y-6">
                                                <h3 className="text-md font-semibold">{t('Price and Weighting')}</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <FormField label={t('Price mode')} htmlFor={`p-${dbId}`}>
                                                        <Select
                                                            value={normalizePriceMode(attrs.p)}
                                                            onValueChange={(value) => updateAttribute(dbId, 'p', value)}
                                                        >
                                                            <SelectTrigger id={`p-${dbId}`}>
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

                                                    <FormField label={t('Ponderation coefficient (%)')} htmlFor={`pd-${dbId}`}>
                                                        <Input
                                                            id={`pd-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.pd}
                                                            onChange={(e) => updateAttribute(dbId, 'pd', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>


                                                </div>
                                            </div>

                                            <Separator />

                                            {/* Section Livraison et TVA */}
                                            <div className="space-y-6">
                                                <h3 className="text-md font-semibold">{t('Delivery and VAT')}</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                                    <FormField label={t('Higher roll')} htmlFor={`h-${dbId}`} >
                                                        <Input
                                                            id={`h-${dbId}`}
                                                            type="checkbox"
                                                            // step="0.01"
                                                            checked={attrs.h === 1}
                                                            // defaultChecked={attrs.h === 1}
                                                            value={attrs.h}
                                                            onChange={(e) => updateAttribute(dbId, 'h', parseFloat(e.target.value) || 0)}
                                                        />
                                                        {/* <Checkbox id={`h-${dbId}`} checked={attrs.h === 1} onCheckedChange={(checked) => updateAttribute(dbId, 'h', checked ? 1 : 0)} /> */}

                                                    </FormField>

                                                    <FormField label={t('Carrier')} htmlFor={`t-${dbId}`}>
                                                        <Select
                                                            value={attrs.t !== null ? String(attrs.t) : 'none'}
                                                            onValueChange={(value) => {
                                                                const carrierId = value === 'none' ? null : Number(value);
                                                                const selectedCarrier = carrierOptions.find((c) => c.id === carrierId);
                                                                const selectedZones = selectedCarrier?.zones ?? [];

                                                                updateAttribute(dbId, 't', carrierId);
                                                                updateAttribute(
                                                                    dbId,
                                                                    'z',
                                                                    carrierId && selectedZones.some((zone) => zone.id === attrs.z)
                                                                        ? attrs.z
                                                                        : null,
                                                                );
                                                            }}
                                                        >
                                                            <SelectTrigger id={`t-${dbId}`}>
                                                                <SelectValue placeholder="Sélectionner un transporteur" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">{t('None')}</SelectItem>
                                                                {carrierOptions.map((carrier) => (
                                                                    <SelectItem key={carrier.id} value={String(carrier.id)}>
                                                                        {carrier.name}{carrier.country ? ` (${carrier.country})` : ''}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormField>

                                                    <FormField label={t('Zone')} htmlFor={`z-${dbId}`}>
                                                        <Select
                                                            value={attrs.z !== null ? String(attrs.z) : 'none'}
                                                            onValueChange={(value) => updateAttribute(dbId, 'z', value === 'none' ? null : Number(value))}
                                                            disabled={!attrs.t}
                                                        >
                                                            <SelectTrigger id={`z-${dbId}`}>
                                                                <SelectValue placeholder={t('Select a zone')} />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">{t('None')}</SelectItem>
                                                                {(carrierOptions.find((c) => c.id === attrs.t)?.zones ?? []).map((zone) => (
                                                                    <SelectItem key={zone.id} value={String(zone.id)}>
                                                                        {zone.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormField>

                                                    <FormField label={t('Delivery (€)')} htmlFor={`l-${dbId}`}>
                                                        <Input
                                                            id={`l-${dbId}`}
                                                            type="text"
                                                            inputMode="decimal"
                                                            step="0.01"
                                                            value={deliveryInputByDbId[dbId] ?? (attrs.l ? String(attrs.l) : '')}
                                                            onChange={(e) => setDeliveryInputByDbId((prev) => ({
                                                                ...prev,
                                                                [dbId]: e.target.value,
                                                            }))}
                                                            onBlur={() => commitDeliveryValue(dbId)}
                                                        />
                                                    </FormField>

                                                    <FormField label={t('Product VAT (%)')} htmlFor={`tvap-${dbId}`}>
                                                        <Input
                                                            id={`tvap-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.tvap}
                                                            onChange={(e) => updateAttribute(dbId, 'tvap', parseFloat(e.target.value) || 0)}
                                                        />
                                                    </FormField>

                                                    <FormField label={t('Transport VAT (%)')} htmlFor={`tvat-${dbId}`}>
                                                        <Input
                                                            id={`tvat-${dbId}`}
                                                            type="number"
                                                            step="0.01"
                                                            value={attrs.tvat ?? ''}
                                                            onChange={(e) => updateAttribute(dbId, 'tvat', e.target.value ? parseFloat(e.target.value) : null)}
                                                        />
                                                    </FormField>
                                                </div>
                                            </div>

                                            <Separator />



                                            {/* Champ caché pour envoyer le JSON au backend */}
                                            <input
                                                type="hidden"
                                                name={`attributes[${dbId}]`}
                                                value={JSON.stringify(attrs)}
                                            />
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </Form>
            </SettingsLayout>
        </AppLayout>
    );
}
