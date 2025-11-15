import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { type Product } from '@/types';
import { Link, router } from "@inertiajs/react";
import { CameraIcon, Check, CircleCheckBig, CircleOff, CircleX, EditIcon, TrashIcon, X } from "lucide-react";
import storage from "@/routes/storage";

type Props = {
    limit?: number | null; // undefined/null = afficher tout
    products: Product[];
    canEdit?: boolean;
    canDelete?: boolean;
};

export function ProductsCardsList({ limit = null, products, canEdit = false, canDelete = false }: Props) {
    const { t } = useI18n();

    const productsToShow = limit ? products.slice(0, limit) : products;

    const editProduct = (productId: number) => {
        router.visit(`/admin/products/${productId}/edit`);
    }

    const deleteProduct = (productId: number) => {
        if (confirm(t('Êtes-vous sûr de vouloir supprimer ce produit ?'))) {
            router.visit(`/admin/products/${productId}/destroy`, {
                method: 'delete',
            });
        }
    }

    return (
        <div className="flex gap-10 flex-wrap items-center justify-center max-w-full">
            {productsToShow.map((product: any) => {
                const name = String(product?.name ?? '');
                const description = String(product?.description ?? '');
                const img = product?.img_link ?? '/placeholder.png';

                return (
                    <Link
                        key={product.id}
                        href={'/products/' + product.id}
                        className="no-underline group hover:scale-102 transition-transform duration-300"
                        aria-label={`Voir ${name}`}
                    >
                        <Card className="relative h-4xl w-80 flex flex-col p-4 gap-4">

                            <div className="absolute top-3 left-3">
                                <span
                                    className={
                                        "inline-flex items-center gap-2 px-2 py-1 text-xs font-semibold rounded-full shadow-sm " +
                                        (product?.active ? "bg-green-600 text-white" : "bg-red-600 text-white")
                                    }
                                    aria-hidden="true"
                                >
                                    {product?.active ? <CircleCheckBig className="w-4 h-4" /> : <CircleOff className="w-4 h-4" />}
                                    {product?.active ? "En stock" : "Rupture"}
                                </span>
                            </div>

                            <CardHeader className="p-0">
                                <img src={img} alt={name} className="w-full h-70 object-cover rounded bg-background" />
                            </CardHeader>

                            <CardTitle className="text-lg font-semibold group-hover:underline underline-offset-3 transition-all duration-300">
                                {name.charAt(0).toUpperCase() + name.slice(1)}
                            </CardTitle>

                            <CardContent className="p-0 max-w-[16rem]">
                                <p className="font-light text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                                    {description.charAt(0).toUpperCase() + description.slice(1)}
                                </p>
                            </CardContent>

                            <div className="w-full h-1 bg-black/10 dark:bg-accent rounded" />

                            <p className="font-bold text-md">{product?.price ?? '—'} €</p>

                            <CardFooter className="w-full flex justify-between p-0">
                                <div className="flex gap-2">
                                    {canEdit && (
                                        <Button asChild size="icon" variant="outline"
                                            onClick={(e: React.MouseEvent) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                editProduct(product.id)
                                            }}
                                        >
                                            {/* <Link href={`/admin/products/${product.id}/edit`}> */}
                                            <span><EditIcon size={16} /></span>

                                            {/* </Link> */}
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button asChild size="icon" variant="destructive-outline"
                                            onClick={(e: React.MouseEvent) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                deleteProduct(product.id)
                                            }}
                                        >
                                            {/* <Link href={`/admin/products/${product.id}/destroy`} onBefore={() => confirm('Are you sure?')}> */}
                                            <span><TrashIcon size={16} /></span>

                                            {/* </Link> */}
                                        </Button>
                                    )}
                                </div>

                                <Button
                                    onClick={(e: React.MouseEvent) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        // TODO: action d'ajout au panier
                                    }}
                                    className="bg-main-purple hover:bg-main-purple-hover dark:bg-main-green dark:hover:bg-main-green-hover hover:scale-105 transition-transform duration-300"
                                >
                                    {t('Ajouter au panier')}
                                </Button>
                            </CardFooter>
                        </Card>
                    </Link>
                );
            })}
        </div>
    );
}