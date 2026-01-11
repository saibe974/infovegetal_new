// import { IngredientsField } from '@/components/forms/ingredients-field';
// import { TopActions } from '@/components/top-actions';
import { Button } from '@/components/ui/button';
// import { Card, CardContent } from '@/components/ui/card';
import Heading from '@/components/heading';
import { FormField } from '@/components/ui/form-field';
// import { ImageInput } from '@/components/ui/image-input';
import { Input } from '@/components/ui/input';
// import {
//     type SelectOption,
//     SelectWithItems,
// } from '@/components/ui/select-with-items';
// import { Textarea } from '@/components/ui/textarea';
import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import type { BreadcrumbItem, ProductDetailed } from '@/types';
import { Form, Head, Link } from '@inertiajs/react';
import { ArrowLeftCircle, SaveIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import SearchSelect from '@/components/app/search-select';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { StickyBar } from '@/components/ui/sticky-bar';
// import { StepsField } from '@/components/forms/steps-field';
// import { useState } from 'react';

type Props = {
    product: ProductDetailed;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
    {
        title: 'Editer',
        href: '#',
    },
];


export default withAppLayout<Props>(breadcrumbs, false, ({ product }) => {
    const { t } = useI18n();
    const [tag, setTag] = useState('')
    const [tags, setTags] = useState((product as any).tags.map((t: any) => t.name) || [])

    const writeTags = (t: string) => {
        setTag(t)
    }

    const action = product.id
        ? products.admin.update.form({ product: product.id })
        : products.admin.store.form();

    // console.log(product)

    return (
        <Form {...action} className="space-y-6 p-0 m-0">
            {({ errors, processing }) => (
                <>
                    <StickyBar className="w-full" borderBottom={false}>
                        <div className='flex items-center justify-between w-full py-2'>
                            <div className="flex items-center gap-2">
                                <Link href="#"
                                    onClick={(e) => { e.preventDefault(); window.history.back(); }}
                                    className='hover:text-gray-500 transition-colors duration-200'
                                >
                                    <ArrowLeftCircle size={35} />
                                </Link>
                                <h2 className="text-xl font-semibold">{t('Edit a product')}</h2>
                            </div>
                            <Button disabled={processing}>
                                <SaveIcon className="mr-2 h-4 w-4" /> {t('Save')}
                            </Button>
                        </div>
                    </StickyBar>

                    <div className="grid items-start gap-8 xl:grid-cols-[2fr_1fr]">
                        <main className="space-y-6">
                            <Card className="p-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormField label={t('Name')} htmlFor="name" error={errors['name']}>
                                        <Input
                                            id="name"
                                            name="name"
                                            defaultValue={product.name}
                                            aria-invalid={!!errors['name']}
                                        />
                                    </FormField>

                                    <FormField label={t('SKU')} htmlFor="sku" error={errors['sku']}>
                                        <Input
                                            id="sku"
                                            name="sku"
                                            defaultValue={String(product.sku ?? '')}
                                            aria-invalid={!!errors['sku']}
                                        />
                                    </FormField>

                                    <FormField label={t('Reference')} htmlFor="ref" error={errors['ref']}>
                                        <Input
                                            id="ref"
                                            name="ref"
                                            defaultValue={String(product.ref ?? '')}
                                            aria-invalid={!!errors['ref']}
                                        />
                                    </FormField>

                                    <FormField label={t('EAN13 Code')} htmlFor="ean13" error={errors['ean13']}>
                                        <Input
                                            id="ean13"
                                            name="ean13"
                                            defaultValue={String(product.ean13 ?? '')}
                                            aria-invalid={!!errors['ean13']}
                                        />
                                    </FormField>
                                </div>

                                <FormField label={t('Description')} htmlFor="description" error={errors['description']}>
                                    <textarea
                                        id="description"
                                        name="description"
                                        rows={3}
                                        defaultValue={product.description || ''}
                                        aria-invalid={!!errors['description']}
                                        placeholder="Décrivez brièvement le produit"
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    />
                                </FormField>

                                <FormField label={t('Tags')} error={errors['tags']}>
                                    <SearchSelect
                                        value={tag}
                                        onChange={writeTags}
                                        onSubmit={() => { }}
                                        placeholder=''
                                        selection={tags}
                                        filters={false}
                                        search={false}
                                    />
                                </FormField>
                            </Card>

                            <Card className="p-4 space-y-4">
                                <h3 className="text-sm font-semibold text-muted-foreground">{t('Dimensions & packaging')}</h3>
                                <div className="grid gap-4 md:grid-cols-3">
                                    <FormField label={t('Pot (cm)')} htmlFor="pot" error={errors['pot']}>
                                        <Input id="pot" name="pot" defaultValue={String(product.pot ?? '')} aria-invalid={!!errors['pot']} />
                                    </FormField>
                                    <FormField label={t('Height (cm)')} htmlFor="height" error={errors['height']}>
                                        <Input id="height" name="height" defaultValue={String(product.height ?? '')} aria-invalid={!!errors['height']} />
                                    </FormField>
                                    <FormField label={t('Packaging')} htmlFor="cond" error={errors['cond']}>
                                        <Input id="cond" name="cond" defaultValue={String(product.cond ?? '')} aria-invalid={!!errors['cond']} />
                                    </FormField>
                                    <FormField label={t('Units per pallet')} htmlFor="floor" error={errors['floor']}>
                                        <Input id="floor" name="floor" defaultValue={String(product.floor ?? '')} aria-invalid={!!errors['floor']} />
                                    </FormField>
                                    <FormField label={t('Units per roll')} htmlFor="roll" error={errors['roll']}>
                                        <Input id="roll" name="roll" defaultValue={String(product.roll ?? '')} aria-invalid={!!errors['roll']} />
                                    </FormField>
                                </div>
                            </Card>

                            <Card className="p-4 space-y-4">
                                <h3 className="text-sm font-semibold text-muted-foreground">{t('Pricing')}</h3>
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                    <FormField label={t('Price')} htmlFor="price" error={errors['price']}>
                                        <Input id="price" name="price" defaultValue={String(product.price ?? '')} aria-invalid={!!errors['price']} />
                                    </FormField>
                                    <FormField label={t('Floor price')} htmlFor="price_floor" error={errors['price_floor']}>
                                        <Input id="price_floor" name="price_floor" defaultValue={String(product.price_floor ?? '')} aria-invalid={!!errors['price_floor']} />
                                    </FormField>
                                    <FormField label={t('Promo price')} htmlFor="price_promo" error={errors['price_promo']}>
                                        <Input id="price_promo" name="price_promo" defaultValue={String(product.price_promo ?? '')} aria-invalid={!!errors['price_promo']} />
                                    </FormField>
                                    <FormField label={t('Roll price')} htmlFor="price_roll" error={errors['price_roll']}>
                                        <Input id="price_roll" name="price_roll" defaultValue={String(product.price_roll ?? '')} aria-invalid={!!errors['price_roll']} />
                                    </FormField>
                                </div>
                            </Card>
                        </main>

                        <aside className="space-y-4">
                            <Card className="overflow-hidden">
                                <div className="aspect-[4/3] bg-muted flex items-center justify-center">
                                    <img src={product.img_link} alt={product.name} className="h-full w-full object-contain" />
                                </div>
                                <div className="p-4 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">{t('Status')}</span>
                                        <Badge variant={product.active ? 'default' : 'destructive'}>
                                            {product.active ? t('Active') : t('Inactive')}
                                        </Badge>
                                    </div>
                                    <div className="text-sm text-muted-foreground">{t('Category ID')} : {String(product.category_products_id ?? t('N/A'))}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Created at')} {product.created_at}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {t('Updated at')} {product.updated_at}
                                    </div>
                                </div>
                            </Card>
                        </aside>
                    </div>
                </>
            )}
        </Form>
    );
});

// export default withAppLayout<Props>(breadcrumbs, ({ recipe, levels }) => {
//     const action = recipe.id
//         ? recipes.update.form({ recipe: recipe.id })
//         : recipes.store.form();
//     const [ingredients, setIngredients] = useState(recipe.ingredients);

//     return (
//         <>
//             <Head title="Editer une recette" />
//             <Form {...action} className="space-y-4">
//                 {({ errors, processing, progress }) => (
//                     <div className="grid items-start gap-8 md:grid-cols-[1fr_350px]">
//                         <main className="space-y-4">
//                             <FormField
//                                 label="Nom"
//                                 htmlFor="name"
//                                 error={errors['name']}
//                             >
//                                 <Input
//                                     id="name"
//                                     name="name"
//                                     defaultValue={recipe.name}
//                                     aria-invalid={!!errors['name']}
//                                 />
//                             </FormField>
//                             <FormField
//                                 label="Description"
//                                 htmlFor="description"
//                                 error={errors['description']}
//                             >
//                                 <Textarea
//                                     id="description"
//                                     name="description"
//                                     rows={4}
//                                     defaultValue={recipe.description}
//                                     aria-invalid={!!errors['description']}
//                                 />
//                             </FormField>
//                             <StepsField ingredients={ingredients} steps={recipe.steps} errors={errors}/>
//                         </main>
//                         <Card>
//                             <ImageInput
//                                 id="image"
//                                 progress={progress?.progress}
//                                 className="aspect-video"
//                                 name="image"
//                                 aria-invalid={!!errors['image']}
//                                 defaultValue={recipe.image}
//                             />
//                             <CardContent className="space-y-4 px-4 pb-6">
//                                 <FormField
//                                     label="Nombre de personnes"
//                                     htmlFor="persons"
//                                     error={errors['persons']}
//                                 >
//                                     <Input
//                                         id="persons"
//                                         name="persons"
//                                         type="number"
//                                         min="1"
//                                         defaultValue={recipe.persons}
//                                         aria-invalid={!!errors['persons']}
//                                     />
//                                 </FormField>
//                                 <FormField
//                                     label="Durée (en minutes)"
//                                     htmlFor="duration"
//                                     error={errors['duration']}
//                                 >
//                                     <Input
//                                         id="duration"
//                                         name="duration"
//                                         type="number"
//                                         min="1"
//                                         defaultValue={recipe.duration}
//                                         aria-invalid={!!errors['duration']}
//                                     />
//                                 </FormField>
//                                 <FormField
//                                     label="Niveau de difficulté"
//                                     htmlFor="level"
//                                     error={errors['level']}
//                                 >
//                                     <SelectWithItems
//                                         items={levels}
//                                         id="level"
//                                         name="level"
//                                         defaultValue={recipe.level}
//                                         aria-invalid={!!errors['level']}
//                                     />
//                                 </FormField>
//                                 <IngredientsField
//                                     ingredients={ingredients}
//                                     onValueChange={setIngredients}
//                                     errors={errors}
//                                 />
//                             </CardContent>
//                         </Card>

//                         <TopActions>
//                             <Button disabled={processing}>
//                                 <SaveIcon /> Enregistrer
//                             </Button>
//                         </TopActions>
//                     </div>
//                 )}
//             </Form>
//         </>
//     );
// });
