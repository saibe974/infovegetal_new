import SearchSelect from '@/components/app/search-select';
import { DatabaseStickyBar } from '@/components/products/database-sticky-bar';
import ProductImportConfigPanel from '@/components/products/import-config-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SelectLang } from '@/components/ui/selectLang';
import { Separator } from '@/components/ui/separator';
import { withAppLayout } from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import dbProducts from '@/routes/db-products';
import products from '@/routes/products';
import { type BreadcrumbItem, type SharedData, type dbProduct } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useMemo, useRef, useState } from 'react';

type Props = {
    dbProduct: dbProduct;
    categoryOptions: { id: number; name: string }[];
};

type KVPair = { key: string; value: string };
type MappingPair = KVPair & { updateExisting: boolean };
type EditTab = 'info' | 'mapping';

const PRODUCT_FIELD_OPTIONS = [
    { value: 'sku', label: 'SKU import (sku)' },
    { value: 'ref', label: 'Reference (ref)' },
    { value: 'ean13', label: 'EAN13 (ean13)' },
    { value: 'name', label: 'Name (name)' },
    { value: 'description', label: 'Description (description)' },
    { value: 'img_link', label: 'Image URL (img_link)' },
    { value: 'price', label: 'Price (price)' },
    { value: 'price_floor', label: 'Floor price (price_floor)' },
    { value: 'price_roll', label: 'Roll price (price_roll)' },
    { value: 'price_promo', label: 'Promotional price (price_promo)' },
    {
        value: 'category_products_id',
        label: 'Category ID (category_products_id)',
    },
    {
        value: 'category_products_name',
        label: 'Category name (category_products_name)',
    },
    { value: 'pot', label: 'Pot (pot)' },
    { value: 'height', label: 'Height (height)' },
    { value: 'cond', label: 'Packaging (cond)' },
    { value: 'floor', label: 'Floor quantity (floor)' },
    { value: 'roll', label: 'Roll quantity (roll)' },
    { value: 'unite', label: 'Minimum unit (unite)' },
    { value: 'producer_id', label: 'Producer ID (producer_id)' },
    { value: 'producteur_name', label: 'Producer name (producteur_name)' },
    { value: 'producteur_code', label: 'Producer code (producteur_code)' },
    { value: 'tva_id', label: 'VAT ID (tva_id)' },
    { value: 'active', label: 'Active (active)' },
    { value: 'db_products_id', label: 'Database ID (db_products_id)' },
    { value: 'prix_etage', label: 'Peplant floor price (prix_etage)' },
    { value: 'prix_roll', label: 'Peplant roll price (prix_roll)' },
    { value: 'prix_promo', label: 'Peplant promo price (prix_promo)' },
    { value: 'haut', label: 'Peplant height (haut)' },
    { value: 'stock', label: 'Stock (stock)' },
    { value: 'tags', label: 'Tags (tags)' },
    { value: 'diameter', label: 'Diameter (diameter)' },
    {
        value: 'contrainte_producteur',
        label: 'Producer constraint (contrainte_producteur)',
    },
    {
        value: 'leverancier_peplant',
        label: 'Peplant supplier (leverancier_peplant)',
    },
] as const;

const objectToKV = (
    obj: Record<string, unknown> | null | undefined,
): KVPair[] => {
    if (!obj) return [];
    return Object.entries(obj).map(([key, value]) => ({
        key,
        value: String(value ?? ''),
    }));
};

const mappingToKV = (
    obj: Record<string, unknown> | null | undefined,
    updateFields: string[] | null | undefined,
): MappingPair[] => {
    if (!obj) return [];

    return Object.entries(obj).map(([key, value]) => {
        const target = String(value ?? '');

        return {
            key,
            value: target,
            // null means a legacy configuration: preserve the previous "update all" behavior.
            updateExisting:
                updateFields === null ||
                updateFields === undefined ||
                updateFields.includes(target),
        };
    });
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

export default withAppLayout<Props>(
    breadcrumbs,
    true,
    ({ dbProduct, categoryOptions }) => {
        const { t } = useI18n();
        const page = usePage<SharedData>();
        const isCreate = dbProduct.id == null;

        const isDev = useMemo(() => {
            const roles = page.props.auth?.user?.roles ?? [];
            return roles.some((role) => role.name === 'dev');
        }, [page.props.auth?.user?.roles]);

        const [activeTab] = useState<EditTab>('mapping');
        const formRef = useRef<HTMLFormElement>(null);
        const [categoryQueries, setCategoryQueries] = useState<
            Record<number, string>
        >({});

        const { data, setData, post, put, processing, errors, transform } =
            useForm({
                name: dbProduct.name ?? '',
                description: dbProduct.description ?? '',
                champs: mappingToKV(dbProduct.champs, dbProduct.update_fields),
                categories: objectToKV(dbProduct.categories),
                traitement: dbProduct.traitement ?? '',
                category_mode: dbProduct.category_mode ?? 'column',
                category_block_prefix: dbProduct.category_block_prefix ?? '',
                category_block_column:
                    dbProduct.category_block_column !== null &&
                    dbProduct.category_block_column !== undefined
                        ? String(dbProduct.category_block_column)
                        : '',
                category_block_update_existing:
                    dbProduct.update_fields === null ||
                    dbProduct.update_fields === undefined ||
                    dbProduct.update_fields.includes('category_products_id') ||
                    dbProduct.update_fields.includes('category_products_name'),
                country: dbProduct.country ?? '',
                mod_liv: dbProduct.mod_liv ?? '',
                mini:
                    dbProduct.mini !== null && dbProduct.mini !== undefined
                        ? String(dbProduct.mini)
                        : '',
            });

        const errorBag = errors as Record<string, string>;

        const categoryValueOptions = useMemo(
            () =>
                categoryOptions.map((category) => ({
                    value: String(category.id),
                    label: `${category.id} - ${category.name}`,
                })),
            [categoryOptions],
        );

        const handleSubmit = (e: FormEvent) => {
            e.preventDefault();

            transform((d) => ({
                ...d,
                champs: kvToObject(d.champs),
                update_fields: [
                    ...new Set([
                        ...d.champs
                            .filter(
                                (pair) =>
                                    pair.updateExisting &&
                                    pair.value.trim() !== '',
                            )
                            .map((pair) => pair.value.trim()),
                        ...(d.category_mode === 'block' &&
                        d.category_block_update_existing
                            ? ['category_products_id']
                            : []),
                    ]),
                ],
                categories: kvToObject(d.categories),
                mini: d.mini === '' ? null : Number(d.mini),
                category_block_column:
                    d.category_mode === 'block' &&
                    d.category_block_column !== ''
                        ? Number(d.category_block_column)
                        : null,
                category_block_prefix:
                    d.category_mode === 'block' &&
                    d.category_block_prefix.trim() !== ''
                        ? d.category_block_prefix.trim()
                        : null,
                traitement: isDev
                    ? d.traitement
                    : (dbProduct.traitement ?? null),
            }));

            const submit = isCreate ? post : put;
            const url = isCreate
                ? dbProducts.store().url
                : dbProducts.updateMapping(dbProduct.id as number).url;

            submit(url, {
                onFinish: () => transform((d) => d),
            });
        };

        return (
            <>
                <Head
                    title={
                        isCreate
                            ? t('Add Database')
                            : `${t('Edit')} - ${dbProduct.name}`
                    }
                />

                <div className="space-y-6">
                    <form ref={formRef} onSubmit={handleSubmit}>
                        <DatabaseStickyBar
                            dbProductId={dbProduct.id}
                            country={dbProduct.country}
                            title={dbProduct.name || t('New database')}
                            activeSection={activeTab}
                            canAccessBilling={
                                !isCreate &&
                                (dbProduct.abilities?.billing ?? false)
                            }
                            onSave={() => formRef.current?.requestSubmit()}
                            saving={processing}
                        />

                        {activeTab === 'info' && (
                            <div className="mx-auto w-full max-w-[1200px] flex-1">
                                <Card className="space-y-4 p-6">
                                    <FormField
                                        label={t('Name')}
                                        htmlFor="db-name"
                                    >
                                        <Input
                                            id="db-name"
                                            value={data.name}
                                            onChange={(e) =>
                                                setData('name', e.target.value)
                                            }
                                        />
                                        <InputError message={errors.name} />
                                    </FormField>

                                    <FormField
                                        label={t('Description')}
                                        htmlFor="db-description"
                                    >
                                        <Input
                                            id="db-description"
                                            value={data.description}
                                            onChange={(e) =>
                                                setData(
                                                    'description',
                                                    e.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errors.description}
                                        />
                                    </FormField>

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                                        <FormField
                                            label={t('Country')}
                                            htmlFor="db-country"
                                        >
                                            {/* <Input id="db-country" maxLength={2} placeholder="fr" value={data.country} onChange={(e) => setData('country', e.target.value.toLowerCase())} /> */}
                                            <SelectLang
                                                mode="country"
                                                id="db-country"
                                                name="country"
                                                value={data.country}
                                                onValueChange={(country) =>
                                                    setData('country', country)
                                                }
                                                className="w-full"
                                                aria-invalid={!!errors.country}
                                            />
                                            {/* <InputError message={errors.country} /> */}
                                        </FormField>

                                        <FormField
                                            label={t('Delivery mode')}
                                            htmlFor="db-mod-liv"
                                        >
                                            <Input
                                                id="db-mod-liv"
                                                value={data.mod_liv}
                                                onChange={(e) =>
                                                    setData(
                                                        'mod_liv',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={errorBag.mod_liv}
                                            />
                                        </FormField>

                                        <FormField
                                            label={t('Minimum rolls')}
                                            htmlFor="db-mini"
                                        >
                                            <Input
                                                id="db-mini"
                                                type="number"
                                                min={0}
                                                value={data.mini}
                                                onChange={(e) =>
                                                    setData(
                                                        'mini',
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                            <InputError message={errors.mini} />
                                        </FormField>

                                        {isDev ? (
                                            <FormField
                                                label={t('Traitement')}
                                                htmlFor="db-traitement"
                                            >
                                                <Input
                                                    id="db-traitement"
                                                    value={data.traitement}
                                                    onChange={(e) =>
                                                        setData(
                                                            'traitement',
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <InputError
                                                    message={errors.traitement}
                                                />
                                            </FormField>
                                        ) : null}
                                    </div>
                                </Card>
                            </div>
                        )}

                        {activeTab === 'mapping' && (
                            <div className="mx-auto w-full max-w-[1200px] flex-1 space-y-6">
                                <Card className="space-y-4 p-6">
                                    <h2 className="text-base font-semibold">
                                        {t('Column mapping (champs)')}
                                    </h2>
                                    {!isCreate ? (
                                        <ProductImportConfigPanel
                                            dbProductId={dbProduct.id as number}
                                            headerRowIndex={
                                                dbProduct.header_row_index
                                            }
                                            sourceDelimiter={
                                                dbProduct.source_delimiter
                                            }
                                        />
                                    ) : null}
                                    <Separator />
                                    <div className="space-y-2">
                                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem] items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
                                            <span>{t('CSV column')}</span>
                                            <span>{t('Product field')}</span>
                                            <span className="text-center">
                                                {t('Update if exists')}
                                            </span>
                                        </div>
                                        {data.champs.map((pair, i) => (
                                            <div
                                                key={i}
                                                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem] items-center gap-2"
                                            >
                                                <Input
                                                    className="font-mono text-sm"
                                                    placeholder={t(
                                                        'CSV column',
                                                    )}
                                                    value={pair.key}
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...data.champs,
                                                        ];
                                                        next[i] = {
                                                            ...next[i],
                                                            key: e.target.value,
                                                        };
                                                        setData('champs', next);
                                                    }}
                                                />
                                                <Select
                                                    value={
                                                        pair.value || undefined
                                                    }
                                                    onValueChange={(value) => {
                                                        const next = [
                                                            ...data.champs,
                                                        ];
                                                        next[i] = {
                                                            ...next[i],
                                                            value,
                                                        };
                                                        setData('champs', next);
                                                    }}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue
                                                            placeholder={t(
                                                                'Product field',
                                                            )}
                                                        />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {pair.value &&
                                                        !PRODUCT_FIELD_OPTIONS.some(
                                                            (option) =>
                                                                option.value ===
                                                                pair.value,
                                                        ) ? (
                                                            <SelectItem
                                                                value={
                                                                    pair.value
                                                                }
                                                            >
                                                                {pair.value}
                                                            </SelectItem>
                                                        ) : null}
                                                        {PRODUCT_FIELD_OPTIONS.map(
                                                            (option) => (
                                                                <SelectItem
                                                                    key={
                                                                        option.value
                                                                    }
                                                                    value={
                                                                        option.value
                                                                    }
                                                                >
                                                                    {t(
                                                                        option.label,
                                                                    )}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                                <div className="flex justify-center">
                                                    <Checkbox
                                                        aria-label={t(
                                                            'Update if exists',
                                                        )}
                                                        checked={
                                                            pair.updateExisting
                                                        }
                                                        onCheckedChange={(
                                                            checked,
                                                        ) => {
                                                            const next = [
                                                                ...data.champs,
                                                            ];
                                                            next[i] = {
                                                                ...next[i],
                                                                updateExisting:
                                                                    checked ===
                                                                    true,
                                                            };
                                                            setData(
                                                                'champs',
                                                                next,
                                                            );
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                setData('champs', [
                                                    ...data.champs,
                                                    {
                                                        key: '',
                                                        value: '',
                                                        updateExisting: true,
                                                    },
                                                ])
                                            }
                                        >
                                            + {t('Add')}
                                        </Button>
                                    </div>
                                </Card>

                                <Card className="space-y-4 p-6">
                                    <h2 className="text-base font-semibold">
                                        {t('Category mapping (categories)')}
                                    </h2>
                                    <div className="space-y-4">
                                        <div className="flex items-start gap-3">
                                            <Checkbox
                                                id="db-categories-by-block"
                                                checked={
                                                    data.category_mode ===
                                                    'block'
                                                }
                                                onCheckedChange={(checked) =>
                                                    setData(
                                                        'category_mode',
                                                        checked === true
                                                            ? 'block'
                                                            : 'column',
                                                    )
                                                }
                                            />
                                            <label
                                                htmlFor="db-categories-by-block"
                                                className="space-y-1 text-sm"
                                            >
                                                <span className="block font-medium">
                                                    {t(
                                                        'Categories are defined by block rows',
                                                    )}
                                                </span>
                                                <span className="block text-muted-foreground">
                                                    {t(
                                                        'A row without a valid EAN13 changes the category for the following products.',
                                                    )}
                                                </span>
                                            </label>
                                        </div>

                                        {data.category_mode === 'block' ? (
                                            <div className="rounded-md border p-4">
                                                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
                                                    <FormField
                                                        label={t(
                                                            'Category row prefix',
                                                        )}
                                                        htmlFor="db-category-block-prefix"
                                                    >
                                                        <Input
                                                            id="db-category-block-prefix"
                                                            placeholder="Famille d'articles:"
                                                            value={
                                                                data.category_block_prefix
                                                            }
                                                            disabled={
                                                                data.category_block_column !==
                                                                ''
                                                            }
                                                            onChange={(e) => {
                                                                setData(
                                                                    'category_block_prefix',
                                                                    e.target
                                                                        .value,
                                                                );
                                                                if (
                                                                    e.target
                                                                        .value !==
                                                                    ''
                                                                ) {
                                                                    setData(
                                                                        'category_block_column',
                                                                        '',
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                        <InputError
                                                            message={
                                                                errors.category_block_prefix
                                                            }
                                                        />
                                                    </FormField>

                                                    <FormField
                                                        label={t(
                                                            'Category column number (starting at 1)',
                                                        )}
                                                        htmlFor="db-category-block-column"
                                                    >
                                                        <Input
                                                            id="db-category-block-column"
                                                            type="number"
                                                            min={1}
                                                            max={1000}
                                                            value={
                                                                data.category_block_column
                                                            }
                                                            disabled={
                                                                data.category_block_prefix !==
                                                                ''
                                                            }
                                                            onChange={(e) => {
                                                                setData(
                                                                    'category_block_column',
                                                                    e.target
                                                                        .value,
                                                                );
                                                                if (
                                                                    e.target
                                                                        .value !==
                                                                    ''
                                                                ) {
                                                                    setData(
                                                                        'category_block_prefix',
                                                                        '',
                                                                    );
                                                                }
                                                            }}
                                                        />
                                                        <InputError
                                                            message={
                                                                errors.category_block_column
                                                            }
                                                        />
                                                    </FormField>

                                                    <div className="space-y-2">
                                                        <label
                                                            htmlFor="db-category-block-update-existing"
                                                            className="block text-center text-sm font-medium"
                                                        >
                                                            {t(
                                                                'Update if exists',
                                                            )}
                                                        </label>
                                                        <div className="flex h-9 items-center justify-center">
                                                            <Checkbox
                                                                id="db-category-block-update-existing"
                                                                checked={
                                                                    data.category_block_update_existing
                                                                }
                                                                onCheckedChange={(
                                                                    checked,
                                                                ) =>
                                                                    setData(
                                                                        'category_block_update_existing',
                                                                        checked ===
                                                                            true,
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                    <Separator />
                                    <div className="space-y-2">
                                        {data.categories.map((pair, i) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2"
                                            >
                                                <Input
                                                    className="w-1/2 min-w-0 font-mono text-sm"
                                                    placeholder={t(
                                                        'Supplier slug',
                                                    )}
                                                    value={pair.key}
                                                    onChange={(e) => {
                                                        const next = [
                                                            ...data.categories,
                                                        ];
                                                        next[i] = {
                                                            ...next[i],
                                                            key: e.target.value,
                                                        };
                                                        setData(
                                                            'categories',
                                                            next,
                                                        );
                                                    }}
                                                />
                                                <SearchSelect
                                                    className="w-1/2 min-w-0"
                                                    value={
                                                        categoryQueries[i] ?? ''
                                                    }
                                                    onChange={(value) =>
                                                        setCategoryQueries(
                                                            (current) => ({
                                                                ...current,
                                                                [i]: value,
                                                            }),
                                                        )
                                                    }
                                                    onSubmit={(v) => {
                                                        const next = [
                                                            ...data.categories,
                                                        ];
                                                        next[i] = {
                                                            ...next[i],
                                                            value:
                                                                v
                                                                    .trim()
                                                                    .split(
                                                                        /\s+/,
                                                                    )
                                                                    .pop() ??
                                                                '',
                                                        };
                                                        setData(
                                                            'categories',
                                                            next,
                                                        );
                                                        setCategoryQueries(
                                                            (current) => ({
                                                                ...current,
                                                                [i]: '',
                                                            }),
                                                        );
                                                    }}
                                                    propositions={
                                                        categoryValueOptions
                                                    }
                                                    selection={categoryValueOptions.filter(
                                                        (option) =>
                                                            option.value ===
                                                            pair.value,
                                                    )}
                                                    multiple={false}
                                                    loading={false}
                                                    minQueryLength={0}
                                                />
                                            </div>
                                        ))}
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() =>
                                                setData('categories', [
                                                    ...data.categories,
                                                    { key: '', value: '' },
                                                ])
                                            }
                                        >
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
    },
);
