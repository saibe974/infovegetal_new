import { withAppLayout } from '@/layouts/app-layout';
import { Head, Link, useForm } from '@inertiajs/react';
import { type BreadcrumbItem } from '@/types';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { StickyBar } from '@/components/ui/sticky-bar';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';
import products from '@/routes/products';
import dbProducts from '@/routes/db-products';
import { ArrowLeftCircle, PlusIcon, SaveIcon, TrashIcon } from 'lucide-react';
import { FormEvent, useCallback, useMemo } from 'react';
import type { dbProduct } from '@/types';

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
};

type KVPair = { key: string; value: string };

const objectToKV = (obj: Record<string, any> | null | undefined): KVPair[] => {
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
    valueMetaByValue?: Record<string, string>;
    unknownValueLabel?: string;
    valueOptions?: { value: string; label: string }[];
}

function KVEditor({ pairs, onChange, keyPlaceholder = 'Clé', valuePlaceholder = 'Valeur', error, valueMetaByValue, unknownValueLabel = 'Unknown', valueOptions }: KVEditorProps) {
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

export default withAppLayout<Props>(breadcrumbs, false, ({ dbProduct, categoryOptions }) => {
    const { t } = useI18n();
    const categoriesById = useMemo<Record<string, string>>(
        () => Object.fromEntries(categoryOptions.map((category) => [String(category.id), category.name])),
        [categoryOptions],
    );
    const categoryValueOptions = useMemo(
        () => categoryOptions.map((category) => ({ value: String(category.id), label: `${category.id} - ${category.name}` })),
        [categoryOptions],
    );

    const { data, setData, put, processing, errors, transform } = useForm({
        name: dbProduct.name ?? '',
        description: dbProduct.description ?? '',
        champs: objectToKV(dbProduct.champs),
        categories: objectToKV(dbProduct.categories),
        country: dbProduct.country ?? '',
        mod_liv: dbProduct.mod_liv ?? '',
        mini: dbProduct.mini !== null && dbProduct.mini !== undefined ? String(dbProduct.mini) : '',
    });

    const errorBag = errors as Record<string, string>;

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        transform((d) => ({
            ...d,
            champs: kvToObject(d.champs),
            categories: kvToObject(d.categories),
            mini: d.mini === '' ? null : Number(d.mini),
        }));
        put(dbProducts.update(dbProduct.id).url, {
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

    return (
        <>
            <Head title={`${t('Edit')} — ${dbProduct.name}`} />

            <form onSubmit={handleSubmit}>
                <StickyBar className="mb-4">
                    <Button asChild variant="ghost" size="sm">
                        <Link href={dbProducts.index().url}>
                            <ArrowLeftCircle size={16} className="mr-2" />
                            {t('Back')}
                        </Link>
                    </Button>

                    <div className="ml-auto flex items-center gap-2">
                        <Button type="submit" size="sm" disabled={processing}>
                            <SaveIcon size={16} className="mr-2" />
                            {t('Save')}
                        </Button>
                    </div>
                </StickyBar>

                <div className="space-y-6 max-w-4xl mx-auto px-4">

                    {/* Infos générales */}
                    <Card className="p-6 space-y-4">
                        <h2 className="text-base font-semibold">{t('General information')}</h2>
                        <Separator />

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
                    </Card>

                    {/* Livraison */}
                    <Card className="p-6 space-y-4">
                        <h2 className="text-base font-semibold">{t('Shipping')}</h2>
                        <Separator />

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

                    {/* Champs */}
                    <Card className="p-6 space-y-4">
                        <h2 className="text-base font-semibold">{t('Column mapping (champs)')}</h2>
                        <p className="text-sm text-muted-foreground">
                            {t('Map CSV column headers to internal product fields.')}
                        </p>
                        <Separator />
                        <KVEditor
                            pairs={data.champs}
                            onChange={updateChamps}
                            keyPlaceholder={t('CSV column')}
                            valuePlaceholder={t('Product field')}
                            error={errorBag['champs']}
                        />
                    </Card>

                    {/* Categories */}
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
                            valueMetaByValue={categoriesById}
                            unknownValueLabel={t('Unknown category')}
                            valueOptions={categoryValueOptions}
                        />
                    </Card>
                </div>
            </form>
        </>
    );
});
