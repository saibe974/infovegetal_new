import { withAppLayout } from '@/layouts/app-layout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { type BreadcrumbItem, type SharedData, type dbProduct } from '@/types';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import SearchSelect from '@/components/app/search-select';
import ProductImportConfigPanel from '@/components/products/import-config-panel';
import { useI18n } from '@/lib/i18n';
import products from '@/routes/products';
import dbProducts from '@/routes/db-products';
import { ArrowLeftCircle, InfoIcon, RowsIcon, SaveIcon, ShellIcon } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type Props = {
    dbProduct: dbProduct;
    categoryOptions: { id: number; name: string }[];
};

type KVPair = { key: string; value: string };
type EditTab = 'info' | 'mapping';

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

export default withAppLayout<Props>(breadcrumbs, true, ({ dbProduct, categoryOptions }) => {
    const { t } = useI18n();
    const page = usePage<SharedData>();
    const isCreate = dbProduct.id == null;

    const isDev = useMemo(() => {
        const roles = page.props.auth?.user?.roles ?? [];
        return roles.some((role) => role.name === 'dev');
    }, [page.props.auth?.user?.roles]);

    const [activeTab, setActiveTab] = useState<EditTab>('info');

    const { data, setData, post, put, processing, errors, transform } = useForm({
        name: dbProduct.name ?? '',
        description: dbProduct.description ?? '',
        champs: objectToKV(dbProduct.champs),
        categories: objectToKV(dbProduct.categories),
        traitement: dbProduct.traitement ?? '',
        country: dbProduct.country ?? '',
        mod_liv: dbProduct.mod_liv ?? '',
        mini: dbProduct.mini !== null && dbProduct.mini !== undefined ? String(dbProduct.mini) : '',
    });

    const errorBag = errors as Record<string, string>;

    const categoryValueOptions = useMemo(
        () => categoryOptions.map((category) => ({ value: String(category.id), label: `${category.id} - ${category.name}` })),
        [categoryOptions],
    );

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();

        transform((d) => ({
            ...d,
            champs: kvToObject(d.champs),
            categories: kvToObject(d.categories),
            mini: d.mini === '' ? null : Number(d.mini),
            traitement: isDev ? d.traitement : null,
        }));

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
                            {!isCreate && (dbProduct.abilities?.billing ?? false) ? (
                                <Button type="button" variant="outline" asChild>
                                    <Link href={dbProducts.billing(dbProduct.id as number).url}>
                                        <ShellIcon size={20} className="mr-2" />
                                        {t('Billing')}
                                    </Link>
                                </Button>
                            ) : null}
                            <Button type="button" variant={activeTab === 'info' ? 'default' : 'outline'} onClick={() => setActiveTab('info')}>
                                <InfoIcon size={20} className="mr-2" />
                                {t('Info')}
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

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                                    {isDev ? (
                                        <FormField label={t('Traitement')} htmlFor="db-traitement">
                                            <Input id="db-traitement" value={data.traitement} onChange={(e) => setData('traitement', e.target.value)} />
                                            <InputError message={errors.traitement} />
                                        </FormField>
                                    ) : null}
                                </div>
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
