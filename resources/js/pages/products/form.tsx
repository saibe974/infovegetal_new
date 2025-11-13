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
import { ArrowLeftCircle, LinkIcon, SaveIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import Select from 'react-select';
import SearchSoham from '@/components/ui/searchSoham';
import { useState } from 'react';
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


export default withAppLayout<Props>(breadcrumbs, ({ product }) => {
    // console.log(product);
    // console.log(Routing);
    
    const [tag, setTag] = useState('')
    const [tags, setTags] = useState((product as any).tags.map((t: any) => t.name) || [])

    const writeTags = (t: string) => {
        setTag(t)
    }


    const action = product.id
        ? products.admin.update.form({ product: product.id })
        : products.admin.store.form();

    console.log(product)

    return (
        <Form {...action} className="space-y-4">
            {({ errors, processing, progress }) => (
                <>

                    <div className="flex items-center py-2 gap-2 justify-between">
                        <div className="flex items-center gap-2">
                            <Link href="#"
                                onClick={(e) => { e.preventDefault(); window.history.back(); }}>
                                <ArrowLeftCircle size={16} />
                            </Link>
                            <h2>
                                Editer un produit
                            </h2>
                        </div>
                        <Button disabled={processing}>
                            <SaveIcon /> Enregistrer
                        </Button>
                    </div>


                    <div className="grid items-start gap-8 md:grid-cols-[1fr_350px]">
                        <main className="space-y-4">
                            <FormField
                                label="Nom"
                                htmlFor="name"
                                error={errors['name']}>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={product.name}
                                    aria-invalid={!!errors['name']} />
                            </FormField>

                            <FormField
                                label="Tags"
                                htmlFor="tags"
                                error={errors['tags']}>
                                {/* <Input
                                    id="tags"
                                    name="tags"
                                    defaultValue={(Array.isArray((product as any).tags) ? (product as any).tags.map((t: any) => t.name).join(', ') : '')}
                                    placeholder="ex: vivace, pot, promotion"
                                /> */}
                                <SearchSoham 
                                    value={tag}
                                    onChange={writeTags}
                                    onSubmit={() => {}}
                                    placeholder=''
                                    selection={tags}
                                />

                            
                            </FormField>
                        </main>
                        <Card>
                            {/* <ImageInput
                                id="img_link"
                                progress={progress?.progress}
                                className="aspect-video"
                                name="img_link"
                                aria-invalid={!!errors['img_link']}
                                defaultValue={product.img_link}
                            /> */}
                            <img src={product.img_link} className="object-cover" />
                        </Card>
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
