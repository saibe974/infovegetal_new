import { withAppLayout } from '@/layouts/app-layout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { type BreadcrumbItem } from '@/types';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchSelect from '@/components/app/search-select';
import ProductImportConfigPanel from '@/components/products/import-config-panel';
import { useI18n } from '@/lib/i18n';
import products from '@/routes/products';
import dbProducts from '@/routes/db-products';
import { ArrowLeftCircle, CirclePlusIcon, InfoIcon, PlusIcon, RowsIcon, SaveIcon, ShellIcon, TrashIcon } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import type { SharedData, dbProduct } from '@/types';
import { getEffectiveUser, isAdmin, isDev, hasPermission } from '@/lib/roles';

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

type Props = {
    dbProduct: dbProduct;
    categoryOptions: { id: number; name: string }[];
    eligibleUsers: { id: number; name: string; email: string }[];
};

type KVPair = { key: string; value: string };
type EditTab = 'info' | 'billing' | 'mapping';

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

interface KVEditorProps {
    pairs: KVPair[];
    onChange: (pairs: KVPair[]) => void;
    keyPlaceholder?: string;
    valuePlaceholder?: string;
    error?: string;
    unknownValueLabel?: string;
    valueOptions?: { value: string; label: string }[];
}

function KVEditor({ pairs, onChange, keyPlaceholder = 'Clé', valuePlaceholder = 'Valeur', error, unknownValueLabel = 'Unknown', valueOptions }: KVEditorProps) {
    const addRow = () => onChange([...pairs, { key: '', value: '' }]);

    const updateRow = (index: number, field: 'key' | 'value', val: string) => {
        const next = [...pairs];
        next[index] = { ...next[index], [field]: val };
        onChange(next);
    };

    const removeRow = (index: number) => {
        const next = [...pairs];
        next.splice(index, 1);
        onChange(next);
    };

    return (
        <div className="space-y-2">
            {pairs.map((pair, i) => (
                <div key={i} className="flex gap-2 items-center">
                    <Input
                        className="flex-1 font-mono text-sm"
                        placeholder={keyPlaceholder}
                        value={pair.key}
                        onChange={(e) => updateRow(i, 'key', e.target.value)}
                    />
                    <span className="text-muted-foreground shrink-0">→</span>
                    {valueOptions ? (
                        <Select
                            value={pair.value}
                            onValueChange={(value) => updateRow(i, 'value', value)}
                        >
                            <SelectTrigger className="flex-1 font-mono text-sm">
                                <SelectValue placeholder={valuePlaceholder} />
                            </SelectTrigger>
                            <SelectContent>
                                {pair.value.trim() !== '' && !valueOptions.some((opt) => opt.value === pair.value.trim()) && (
                                    <SelectItem value={pair.value.trim()}>{`${pair.value.trim()} - ${unknownValueLabel}`}</SelectItem>
                                )}
                                {valueOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <Input
                            className="flex-1 font-mono text-sm"
                            placeholder={valuePlaceholder}
                            value={pair.value}
                            onChange={(e) => updateRow(i, 'value', e.target.value)}
                        />
                    )}

                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeRow(i)}
                        className="shrink-0 text-destructive hover:text-destructive"
                    >
                        <TrashIcon size={14} />
                    </Button>
                </div>
            ))}
            {error && <InputError message={error} />}
            <Button type="button" size="sm" variant="outline" onClick={addRow}>
                <PlusIcon size={14} className="mr-1" />
                Ajouter
            </Button>
        </div>
    );
}

export default withAppLayout<Props>(breadcrumbs, false, ({ dbProduct, categoryOptions, eligibleUsers }) => {
    const { t } = useI18n();

    const { auth, locale } = usePage<SharedData>().props;
    const effectiveUser = getEffectiveUser(auth);
    // const canEdit = isDev(effectiveUser);// || hasPermission(effectiveUser, 'products.db_products');

    const isCreate = dbProduct.id == null;
    const categoryValueOptions = useMemo(
        () => categoryOptions.map((category) => ({ value: String(category.id), label: `${category.id} - ${category.name}` })),
        [categoryOptions],
    );
    const [billableUsersSearch, setBillableUsersSearch] = useState('');
    const [activeTab, setActiveTab] = useState<EditTab>('info');
    const [activeBillableUserId, setActiveBillableUserId] = useState<number | null>(() => {
        const ids = Array.isArray(dbProduct.billable_user_ids) ? dbProduct.billable_user_ids : [];
        return ids.length > 0 ? Number(ids[0]) : null;
    });
    const eligibleUserOptions = useMemo(
        () => (Array.isArray(eligibleUsers) ? eligibleUsers : []).map((user) => ({
            value: String(user.id),
            label: `${user.name} (${user.email})`,
        })),
        [eligibleUsers],
    );
    const eligibleUserOptionById = useMemo(
        () => new Map(eligibleUserOptions.map((option) => [Number(option.value), option])),
        [eligibleUserOptions],
    );
    const { data, setData, post, put, processing, errors, transform } = useForm({
        name: dbProduct.name ?? '',
        description: dbProduct.description ?? '',
        champs: objectToKV(dbProduct.champs),
        categories: objectToKV(dbProduct.categories),
        traitement: dbProduct.traitement ?? '',
        country: dbProduct.country ?? '',
        mod_liv: dbProduct.mod_liv ?? '',
        mini: dbProduct.mini !== null && dbProduct.mini !== undefined ? String(dbProduct.mini) : '',
        billable_user_ids: dbProduct.billable_user_ids ?? [],
    });

    const availableEligibleUserOptions = useMemo(() => {
        const selected = new Set((data.billable_user_ids ?? []).map((id) => Number(id)));
        return eligibleUserOptions.filter((option) => !selected.has(Number(option.value)));
    }, [data.billable_user_ids, eligibleUserOptions]);

    const activeBillableUser = useMemo(() => {
        if (activeBillableUserId === null) {
            return null;
        }

        return eligibleUserOptionById.get(activeBillableUserId) ?? null;
    }, [activeBillableUserId, eligibleUserOptionById]);

    const errorBag = errors as Record<string, string>;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({
            ...d,
            champs: kvToObject(d.champs),
            categories: kvToObject(d.categories),
            mini: d.mini === '' ? null : Number(d.mini),
        }));
        const submit = isCreate ? post : put;
        const url = isCreate
            ? dbProducts.store().url
            : dbProducts.update(dbProduct.id as number).url;

        submit(url, {
            onFinish: () => transform((d) => d),
        });
    };

    const updateChamps = useCallback(
        (pairs: KVPair[]) => setData('champs', pairs),
        [setData],
    );

    const updateCategories = useCallback(
        (pairs: KVPair[]) => setData('categories', pairs),
        [setData],
    );

    useEffect(() => {
        const ids = (data.billable_user_ids ?? []).map((id) => Number(id));

        if (ids.length === 0) {
            setActiveBillableUserId(null);
            return;
        }

        if (activeBillableUserId === null || !ids.includes(activeBillableUserId)) {
            setActiveBillableUserId(ids[0]);
        }
    }, [activeBillableUserId, data.billable_user_ids]);

    return (
        <>
            <Head title={isCreate ? t('Add Database') : `${t('Edit')} — ${dbProduct.name}`} />

            <div className='space-y-6'>
                <form onSubmit={handleSubmit}>
                    <StickyBar className="mb-4 w-full">

                        <div className="flex items-center gap-4 ">
                            <Link href="#"
                                onClick={(e) => { e.preventDefault(); window.history.back(); }}
                                className='hover:text-gray-500 transition-colors duration-200'
                            >
                                <ArrowLeftCircle size={35} />
                            </Link>
                            <div className='flex flex-col'>
                                <h1 className='text-3xl font-bold capitalize'>{dbProduct.name}</h1>
                                <p className="text-gray-500">
                                    {isCreate ? `Add a new database` :
                                        activeTab === 'info' ? `Edit general information` :
                                            activeTab === 'billing' ? `Manage billing settings` :
                                                activeTab === 'mapping' ? `Configure column and category mapping` :
                                                    ''}
                                </p>
                            </div>
                        </div>


                        <div className="ml-auto flex items-center gap-2">
                            <Button
                                type="button"
                                variant={activeTab === 'info' ? 'default' : 'outline'}
                                onClick={() => setActiveTab('info')}
                            >
                                <InfoIcon size={32} className="mr-2" />
                                {t('Info')}
                            </Button>
                            <Button
                                type="button"
                                variant={activeTab === 'billing' ? 'default' : 'outline'}
                                onClick={() => setActiveTab('billing')}
                            >
                                <ShellIcon size={32} className="mr-2" />
                                {t('Billing')}
                            </Button>
                            <Button
                                type="button"
                                variant={activeTab === 'mapping' ? 'default' : 'outline'}
                                onClick={() => setActiveTab('mapping')}
                            >
                                <RowsIcon size={32} className="mr-2" />
                                {t('Mapping')}
                            </Button>
                            <Button type="submit" disabled={processing}>
                                <SaveIcon size={32} className="mr-2" />
                                {isCreate ? t('Create') : t('Save')}
                            </Button>
                        </div>
                    </StickyBar>

                    {/* Infos générales */}
                    {activeTab === 'info' && (
                        <div className="flex-1 w-full max-w-[1200px] mx-auto">


                            <Card className="p-6 space-y-4">
                                {/* <h2 className="text-base font-semibold">{t('General information')}</h2>
                        <Separator /> */}

                                <FormField label={t('Name')} htmlFor="db-name">
                                    <Input
                                        id="db-name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                    />
                                    <InputError message={errors.name} />
                                </FormField>

                                <FormField label={t('Description')} htmlFor="db-description">
                                    <Input
                                        id="db-description"
                                        value={data.description}
                                        onChange={(e) => setData('description', e.target.value)}
                                    />
                                    <InputError message={errors.description} />
                                </FormField>

                                {isDev(effectiveUser) && (
                                    <FormField label={t('Treatment file')} htmlFor="db-traitement">
                                        <Input
                                            id="db-traitement"
                                            placeholder="peplant"
                                            value={data.traitement}
                                            onChange={(e) => setData('traitement', e.target.value)}
                                        />
                                        <InputError message={errors.traitement} />
                                    </FormField>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField label={t('Country')} htmlFor="db-country">
                                        <Input
                                            id="db-country"
                                            maxLength={2}
                                            placeholder="fr"
                                            value={data.country}
                                            onChange={(e) => setData('country', e.target.value.toLowerCase())}
                                        />
                                        <InputError message={errors.country} />
                                    </FormField>

                                    <FormField label={t('Delivery mode')} htmlFor="db-mod-liv">
                                        <Input
                                            id="db-mod-liv"
                                            value={data.mod_liv}
                                            onChange={(e) => setData('mod_liv', e.target.value)}
                                        />
                                        <InputError message={errorBag['mod_liv']} />
                                    </FormField>

                                    <FormField label={t('Minimum rolls')} htmlFor="db-mini">
                                        <Input
                                            id="db-mini"
                                            type="number"
                                            min={0}
                                            value={data.mini}
                                            onChange={(e) => setData('mini', e.target.value)}
                                        />
                                        <InputError message={errors.mini} />
                                    </FormField>
                                </div>

                            </Card>
                        </div>
                    )}

                    {/* Billing */}
                    {activeTab === 'billing' && (
                        <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
                            <Card className="p-6 space-y-4">
                                <FormField label={t('Billing users')}>
                                    <SearchSelect
                                        value={billableUsersSearch}
                                        onChange={setBillableUsersSearch}
                                        onSubmit={(value) => {
                                            const ids = value
                                                .split(/\s+/)
                                                .map((token) => Number(token))
                                                .filter((id) => Number.isInteger(id) && id > 0);

                                            if (ids.length === 0) {
                                                return;
                                            }

                                            setData('billable_user_ids', Array.from(new Set([
                                                ...(data.billable_user_ids ?? []).map((id) => Number(id)),
                                                ...ids,
                                            ])));
                                            setBillableUsersSearch('');
                                        }}
                                        propositions={availableEligibleUserOptions}
                                        selection={[]}
                                        loading={false}
                                        minQueryLength={0}
                                    />
                                    <InputError message={errorBag['billable_user_ids']} />
                                </FormField>

                                <div className="space-y-2 max-h-[420px] overflow-y-auto">
                                    {(data.billable_user_ids ?? []).map((id) => {
                                        const userId = Number(id);
                                        const option = eligibleUserOptionById.get(userId);

                                        if (!option) {
                                            return null;
                                        }

                                        return (
                                            <div key={userId} className="flex items-center justify-between gap-2">
                                                <button
                                                    type="button"
                                                    className={`text-left rounded-md px-3 py-2 w-full border ${activeBillableUserId === userId ? 'bg-muted border-primary' : 'border-border'}`}
                                                    onClick={() => setActiveBillableUserId(userId)}
                                                >
                                                    <span className="font-medium">{option.label}</span>
                                                </button>

                                                <Button
                                                    type="button"
                                                    variant="destructive-outline"
                                                    size="icon"
                                                    onClick={() => setData('billable_user_ids', (data.billable_user_ids ?? []).filter((currentId) => Number(currentId) !== userId))}
                                                    aria-label={t('Delete')}
                                                >
                                                    <TrashIcon className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>


                            </Card>

                            <Card className='p-6 xl:col-span-2 space-y-4'>
                                {activeBillableUser ? (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className='text-lg'>
                                                {t('Billing user')}: {activeBillableUser.label}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <FormField label={t('Default marges')}>
                                                <Button title={t('Add')} size={'icon'} variant={'outline'} className="text-green-500 hover:text-green-500 hover:bg-green-500/30 border-green-500">
                                                    <CirclePlusIcon />
                                                </Button>
                                                {/* Section Marges */}
                                                <div className="space-y-6 ">
                                                    <h3 className="text-md font-semibold">{t('Margin')}</h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <FormField label={t('General margin (%)')}>
                                                            <Input
                                                                // id={`m-${dbId}`}
                                                                type="number"
                                                                step="0.01"
                                                            // value={attrs.m}
                                                            // onChange={(e) => updateAttribute(dbId, 'm', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </FormField>

                                                        <FormField label={t('Minimum margin per roll (€)')}>
                                                            <Input
                                                                // id={`mm-${dbId}`}
                                                                type="number"
                                                                step="0.01"
                                                            // value={attrs.mm}
                                                            // onChange={(e) => updateAttribute(dbId, 'mm', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </FormField>

                                                        <FormField label={t('Ponderation coefficient (%)')}>
                                                            <Input
                                                                // id={`pd-${dbId}`}
                                                                type="number"
                                                                step="0.01"
                                                            // value={attrs.pd}
                                                            // onChange={(e) => updateAttribute(dbId, 'pd', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </FormField>

                                                        {/* </div> */}
                                                        {/* <div className='grid grid-cols-1 md:grid-cols-3 gap-4 w-full'> */}
                                                        <FormField label={t('Margin per carton (%)')}>
                                                            <Input
                                                                // id={`mc-${dbId}`}
                                                                type="number"
                                                                step="0.01"
                                                            // value={attrs.mc}
                                                            // onChange={(e) => updateAttribute(dbId, 'mc', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </FormField>

                                                        <FormField label={t('Margin per level (%)')}>
                                                            <Input
                                                                // id={`me-${dbId}`}
                                                                type="number"
                                                                step="0.01"
                                                            // value={attrs.me}
                                                            // onChange={(e) => updateAttribute(dbId, 'me', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </FormField>

                                                        <FormField label={t('Margin per roll (%)')}>
                                                            <Input
                                                                // id={`mr-${dbId}`}
                                                                type="number"
                                                                step="0.01"
                                                            // value={attrs.mr}
                                                            // onChange={(e) => updateAttribute(dbId, 'mr', parseFloat(e.target.value) || 0)}
                                                            />
                                                        </FormField>
                                                    </div>

                                                </div>
                                            </FormField>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <div className='text-sm text-muted-foreground'>
                                        {t('Select a billing user from the list.')}
                                    </div>
                                )}
                            </Card>
                        </div>
                    )}

                    {/* mapping Champs */}
                    {activeTab === 'mapping' && (
                        <div className="flex-1 w-full max-w-[1200px] mx-auto space-y-6">
                            <Card className="p-6 space-y-4">

                                <h2 className="text-base font-semibold">{t('Column mapping (champs)')}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {t('Map CSV column headers to internal product fields.')}
                                </p>

                                {isCreate ? (
                                    <div className="rounded border p-4 space-y-3">
                                        <div>
                                            <h3 className="text-sm font-semibold">{t('Supplier import format')}</h3>
                                            <p className="text-sm text-muted-foreground">
                                                {t('Create the supplier first, then upload a sample file to configure its import format.')}
                                            </p>
                                        </div>

                                        <Button type="button" variant="outline" className="w-full" disabled>
                                            {t('Upload sample file')}
                                        </Button>
                                    </div>
                                ) : (
                                    <ProductImportConfigPanel
                                        dbProductId={dbProduct.id as number}
                                        headerRowIndex={dbProduct.header_row_index}
                                        sourceDelimiter={dbProduct.source_delimiter}
                                    />
                                )}



                                <Separator />
                                <KVEditor
                                    pairs={data.champs}
                                    onChange={updateChamps}
                                    keyPlaceholder={t('CSV column')}
                                    valuePlaceholder={t('Product field')}
                                    error={errorBag['champs']}
                                />
                            </Card>

                            <Card className="p-6 space-y-4">
                                <h2 className="text-base font-semibold">{t('Category mapping (categories)')}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {t('Map category slugs from the supplier to internal category IDs.')}
                                </p>
                                <Separator />
                                <KVEditor
                                    pairs={data.categories}
                                    onChange={updateCategories}
                                    keyPlaceholder={t('Supplier slug')}
                                    valuePlaceholder={t('Category ID')}
                                    error={errorBag['categories']}
                                    unknownValueLabel={t('Unknown category')}
                                    valueOptions={categoryValueOptions}
                                />
                            </Card>
                        </div>
                    )}

                </form >
            </div >
        </>
    );
});
