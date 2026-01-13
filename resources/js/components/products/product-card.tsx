import React, { useContext } from "react";
import { Link, router, usePage } from "@inertiajs/react";
import { useI18n } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit as EditIcon, Trash as TrashIcon, Check as CheckIcon, X as XIcon, MoveVertical, CircleSlash2, Box, Layers, Container } from "lucide-react";
import { type Product, SharedData } from "@/types";
import { CartContext } from "@/components/cart/cart.context";
import { addCartonIcon, addEtageIcon, addRollIcon } from "@/lib/icon";
import { useSidebar } from "../ui/sidebar";

type Props = {
    product: Product;
    canEdit?: boolean;
    canDelete?: boolean;
    editProduct?: (productId: number) => void;
    deleteProduct?: (productId: number) => void;
    className?: string;
};

export function ProductCard({ product, canEdit = false, canDelete = false, editProduct, deleteProduct, className }: Props) {
    const { t } = useI18n();

    const { toggleSidebar, isOpenId } = useSidebar()

    const { auth } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;

    const name = String(product?.name ?? "");
    const description = String(product?.description ?? "");
    const img = product?.img_link ?? "/placeholder.png";

    const handleEdit = (id: number) => {
        if (editProduct) return editProduct(id);
        router.visit(`/admin/products/${id}/edit`);
    };

    const handleDelete = (id: number) => {
        if (deleteProduct) return deleteProduct(id);
        if (confirm(t('Êtes-vous sûr de vouloir supprimer ce produit ?'))) {
            router.visit(`/admin/products/${id}/destroy`, {
                method: 'delete',
            });
        }
    };

    const { addToCart } = useContext(CartContext);
    const handleAddToCart = (id: number) => {
        addToCart(product, 1);
        !isOpenId('right') && toggleSidebar('right');
    };

    // console.log(product)

    return (
        <Link
            key={product.id}
            href={'/products/' + product.id}
            className="no-underline group hover:no-underline hover:scale-102 transition-transform duration-300"
            aria-label={`Voir ${name}`}
        >
            <Card className={`relative flex flex-col p-4 gap-4 ${className ?? ""}`}>
                <div className="absolute top-3 left-3">
                    <span
                        className={
                            "inline-flex items-center gap-2 px-2 py-1 text-xs font-semibold rounded-full shadow-sm " +
                            (product?.active ? "bg-green-600 text-white" : "bg-red-600 text-white")
                        }
                        aria-hidden="true"
                    >
                        {product?.active ? <CheckIcon className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                        {product?.active ? "En stock" : "Rupture"}
                    </span>
                </div>

                <CardHeader className="p-0 self-center">
                    <img src={img} alt={name} className="w-full max-w-100 h-80 object-cover rounded" />
                </CardHeader>

                <CardTitle className="">
                    <span className="text-lg font-semibold  whitespace-nowrap overflow-hidden text-ellipsis group-hover:underline underline-offset-3 transition-all duration-300">
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                    </span>
                    <p>
                        {product?.category ? (
                            <span className="text-xs font-medium italic text-gray-500">
                                {product.category.name.charAt(0).toUpperCase() + product.category.name.slice(1)}
                            </span>
                        ) : null}
                    </p>
                </CardTitle>

                <CardContent className="p-0 max-w-[16rem] flex flex-col gap-5 ">
                    <p className="font-light text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                        {description.charAt(0).toUpperCase() + description.slice(1)}
                    </p>

                    <div className="flex items-center text-xs font-light italic">
                        {product?.pot ? (
                            <p className=" flex gap-1" title={t('Diameter of the pot')}>
                                <span><CircleSlash2 className="size-4" /></span>
                                <span>{String(product.pot)} cm</span>
                            </p>
                        ) : null}

                        {product?.height && product?.pot ? (
                            <span className="mx-2">-</span>
                        ) : null}

                        {product?.height ? (
                            <p className="flex" title={t('Height')}>
                                <span><MoveVertical className="size-4" /></span>
                                <span>{String(product.height)} cm</span>
                            </p>
                        ) : null}
                    </div>

                </CardContent>

                <div className="w-full h-1 bg-black/10 dark:bg-accent rounded" />

                {isAuthenticated &&
                    <div className="flex flex-col gap-2">
                        {product?.price && (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-main-purple dark:text-main-green w-6 h-7">
                                    <div dangerouslySetInnerHTML={{ __html: addCartonIcon }} />
                                </span>
                                <span className="font-semibold">{product.price} €</span>
                                <span className="text-xs text-gray-500">{t('(par carton)')}</span>
                            </div>
                        )}
                        {product?.price_floor ? (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-main-purple dark:text-main-green w-6 h-7">
                                    <div dangerouslySetInnerHTML={{ __html: addEtageIcon }} />
                                </span>
                                <span className="font-semibold">{String(product.price_floor)} €</span>
                                <span className="text-xs text-gray-500">{t('(par étage)')}</span>
                            </div>
                        ) : null}
                        {product?.price_roll ? (
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-main-purple dark:text-main-green w-6 h-7">
                                    <div dangerouslySetInnerHTML={{ __html: addRollIcon }} />
                                </span>
                                {product?.price_promo ? (
                                    <>
                                        <span className="font-semibold line-through text-gray-400">{String(product.price_roll)} €</span>
                                        <span className="font-bold text-red-600">{String(product.price_promo)} €</span>
                                    </>
                                ) : (
                                    <span className="font-semibold">{String(product.price_roll)} €</span>
                                )}
                                <span className="text-xs text-gray-500">{t('(par roll)')}</span>
                            </div>
                        ) : null}
                    </div>
                }

                <CardFooter className="w-full flex justify-between p-0">
                    <div className="flex gap-2">
                        {canEdit && (
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEdit(product.id);
                                }}
                            >
                                <EditIcon size={16} />
                            </Button>
                        )}
                        {canDelete && (
                            <Button
                                size="icon"
                                variant="destructive-outline"
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDelete(product.id);
                                }}
                            >
                                <TrashIcon size={16} />
                            </Button>
                        )}
                    </div>

                    {isAuthenticated &&
                        <Button
                            onClick={(e: React.MouseEvent) => {
                                e.preventDefault();
                                e.stopPropagation();

                                handleAddToCart(product.id);

                            }}
                            className="bg-main-purple hover:bg-main-purple-hover dark:bg-main-green dark:hover:bg-main-green-hover hover:scale-105 transition-transform duration-300"
                        >
                            {t('Add to Cart')}
                        </Button>
                    }

                </CardFooter>
            </Card>
        </Link>
    );
}