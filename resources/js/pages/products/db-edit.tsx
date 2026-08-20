import { DatabaseStickyBar } from '@/components/products/database-sticky-bar';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { SelectLang } from '@/components/ui/selectLang';
import { withAppLayout } from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import dbProducts from '@/routes/db-products';
import products from '@/routes/products';
import { type BreadcrumbItem, type SharedData, type dbProduct } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { FormEvent, useMemo, useRef } from 'react';

type Props = { dbProduct: dbProduct };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Products', href: products.index().url },
    { title: 'Database', href: dbProducts.index().url },
    { title: 'Info', href: '#' },
];

export default withAppLayout<Props>(breadcrumbs, true, ({ dbProduct }) => {
    const { t } = useI18n();
    const page = usePage<SharedData>();
    const formRef = useRef<HTMLFormElement>(null);
    const isCreate = dbProduct.id == null;
    const isDev = useMemo(
        () =>
            (page.props.auth?.user?.roles ?? []).some(
                (role) => role.name === 'dev',
            ),
        [page.props.auth?.user?.roles],
    );
    const { data, setData, post, put, processing, errors, transform } = useForm(
        {
            name: dbProduct.name ?? '',
            description: dbProduct.description ?? '',
            traitement: dbProduct.traitement ?? '',
            country: dbProduct.country ?? '',
            mod_liv: dbProduct.mod_liv ?? '',
            mini: dbProduct.mini == null ? '' : String(dbProduct.mini),
            ...(isCreate
                ? {
                      champs: {},
                      update_fields: [],
                      categories: {},
                      category_mode: 'column',
                      category_block_prefix: null,
                      category_block_column: null,
                  }
                : {}),
        },
    );

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        transform((payload) => ({
            ...payload,
            mini: payload.mini === '' ? null : Number(payload.mini),
            traitement: isDev ? payload.traitement : dbProduct.traitement,
        }));
        const submit = isCreate ? post : put;
        submit(
            isCreate
                ? dbProducts.store().url
                : dbProducts.update(dbProduct.id as number).url,
            { onFinish: () => transform((payload) => payload) },
        );
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
            <form ref={formRef} onSubmit={handleSubmit}>
                <DatabaseStickyBar
                    dbProductId={dbProduct.id}
                    country={data.country}
                    title={data.name || t('New database')}
                    activeSection="info"
                    canAccessBilling={
                        !isCreate && (dbProduct.abilities?.billing ?? false)
                    }
                    onSave={() => formRef.current?.requestSubmit()}
                    saving={processing}
                />
                <div className="mx-auto w-full max-w-[1200px]">
                    <Card className="space-y-4 p-6">
                        <FormField label={t('Name')} htmlFor="db-name">
                            <Input
                                id="db-name"
                                value={data.name}
                                onChange={(event) =>
                                    setData('name', event.target.value)
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
                                onChange={(event) =>
                                    setData('description', event.target.value)
                                }
                            />
                            <InputError message={errors.description} />
                        </FormField>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                            <FormField
                                label={t('Country')}
                                htmlFor="db-country"
                            >
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
                            </FormField>
                            <FormField
                                label={t('Delivery mode')}
                                htmlFor="db-mod-liv"
                            >
                                <Input
                                    id="db-mod-liv"
                                    value={data.mod_liv}
                                    onChange={(event) =>
                                        setData('mod_liv', event.target.value)
                                    }
                                />
                                <InputError message={errors.mod_liv} />
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
                                    onChange={(event) =>
                                        setData('mini', event.target.value)
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
                                        onChange={(event) =>
                                            setData(
                                                'traitement',
                                                event.target.value,
                                            )
                                        }
                                    />
                                    <InputError message={errors.traitement} />
                                </FormField>
                            ) : null}
                        </div>
                    </Card>
                </div>
            </form>
        </>
    );
});
