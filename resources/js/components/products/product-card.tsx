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
import { cn } from "@/lib/utils";

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
    const handleAddToCart = (id: number, quantity: number) => {
        addToCart(product, quantity);
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
            <Card className={`relative flex flex-col p-4 gap-3 h-full ${className ?? ""}`}>
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

                <CardTitle>
                    <span className="text-lg font-semibold  whitespace-nowrap overflow-hidden text-ellipsis group-hover:underline underline-offset-3 transition-all duration-300">
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                    </span>
                    <p>
                        {product?.category ? (
                            <span className="text-sm font-light italic ">
                                {product.category.name.charAt(0).toUpperCase() + product.category.name.slice(1)}
                            </span>
                        ) : null}
                    </p>

                    <p>
                        {product?.ref ? (
                            <span className="text-xs font-medium italic text-gray-500">
                                {t('Ref')}: {String(product.ref)}
                            </span>
                        ) : null}
                    </p>
                </CardTitle>

                <CardContent className="p-0 flex flex-col justify-between gap-5 flex-1">
                    <p className="font-light text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                        {description.charAt(0).toUpperCase() + description.slice(1)}
                    </p>

                    <div className="flex items-center">
                        <div className="flex items-center text-xs font-light italic w-full">
                            {product?.pot ? (
                                <p className=" flex gap-1" title={t('Diameter of the pot')}>
                                    <span><CircleSlash2 className="size-3" /></span>
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
                        {(canEdit || canDelete) && (
                            <div className="w-full flex justify-end gap-2 p-0">
                                {canEdit && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 px-2"
                                        onClick={(e: React.MouseEvent) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleEdit(product.id);
                                        }}
                                    >
                                        <EditIcon size={14} />
                                    </Button>
                                )}
                                {canDelete && (
                                    <Button
                                        size="sm"
                                        variant="destructive-outline"
                                        className="h-8 px-2"
                                        onClick={(e: React.MouseEvent) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDelete(product.id);
                                        }}
                                    >
                                        <TrashIcon size={14} />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>


                    {/* <div className="flex-1" /> */}


                    <div className="w-full h-1 bg-black/10 dark:bg-accent rounded" />
                </CardContent>

                {isAuthenticated && (
                    <CardFooter className="flex flex-col md:flex-row md:justify-around p-0 gap-2 w-full">
                        {product?.price && (
                            <button
                                className={cn(
                                    "w-full md:w-1/3 md:h-18 gap-2 flex flex-col items-center justify-center rounded-xl",
                                    "bg-[#3b6cc9] hover:bg-[#3b6cc9]/90 text-white",
                                    "dark:bg-[#00b07d] dark:hover:bg-[#00b07d]/90 dark:text-black",
                                )}
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddToCart(product.id, Number(product.cond))
                                }}
                                title={t('Add a tray')}
                            >
                                <span className="font-semibold">{product.price} €</span>
                                <div className="flex items-center">
                                    <span className="w-6 h-6">
                                        <div dangerouslySetInnerHTML={{ __html: addCartonIcon }} />
                                    </span>
                                    <span className="text-xs font-light">X {String(product.cond)}</span>
                                </div>
                            </button>
                        )}
                        {product?.price_floor ? (
                            <button
                                className={cn(
                                    "w-full md:w-1/3 md:h-18 gap-2 flex flex-col items-center justify-center rounded-xl",
                                    "bg-[#84439f] hover:bg-[#84439f]/90 text-white",
                                    "dark:bg-[#5cce55] dark:hover:bg-[#5cce55]/90 dark:text-black",
                                )}
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddToCart(product.id, (Number(product.cond) * Number(product.floor)))
                                }}
                                title={t('Add a floor')}
                            >
                                <span className="font-semibold">{String(product.price_floor)} €</span>
                                <div className="flex items-center">
                                    <span className="w-6 h-6">
                                        <div dangerouslySetInnerHTML={{ __html: addEtageIcon }} />
                                    </span>
                                    <span className="text-xs font-light">X {Number(product.cond) * Number(product.floor)}</span>
                                </div>
                            </button>
                        ) : null}
                        {product?.price_roll ? (
                            <button
                                className={cn(
                                    "w-full md:w-1/3 md:h-18 gap-2 flex flex-col items-center justify-center rounded-xl",
                                    "bg-main-purple hover:bg-main-purple-hover text-white",
                                    "dark:bg-main-green dark:text-black dark:hover:bg-main-green-hover",
                                )}
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleAddToCart(product.id, (Number(product.cond) * Number(product.floor) * Number(product.roll)))
                                }}
                                title={t('Add a roll')}
                            >

                                {product?.price_promo ? (
                                    <div className="flex items-center">
                                        <span className="font-semibold line-through opacity-75 text-xs">{String(product.price_roll)} €</span>
                                        <span className="font-bold text-red-300 dark:text-red-500">{String(product.price_promo)} €</span>
                                    </div>
                                ) : (
                                    <span className="font-semibold">{String(product.price_roll)} €</span>
                                )}
                                <div className="flex items-center">
                                    <span className="w-6 h-6">
                                        <div dangerouslySetInnerHTML={{ __html: addRollIcon }} />
                                    </span>
                                    <span className="text-xs font-light">X {Number(product.cond) * Number(product.floor) * Number(product.roll)}</span>
                                </div>
                            </button>
                        ) : null}
                    </CardFooter>

                    // <CardFooter className="flex flex-col p-0 gap-2 w-full flex-1">
                    //     {product?.price && (
                    //         <button
                    //             className={cn(
                    //                 "w-full h-10 gap-2 flex items-center justify-center rounded-md",
                    //                 "bg-[#3b6cc9] hover:bg-[#3b6cc9]/90 text-white",
                    //                 "dark:bg-[#00b07d] dark:hover:bg-[#00b07d]/90 dark:text-black",
                    //             )}
                    //             onClick={(e: React.MouseEvent) => {
                    //                 e.preventDefault();
                    //                 e.stopPropagation();
                    //                 handleAddToCart(product.id, Number(product.cond) || 1)
                    //             }}
                    //             title={t('Add a tray')}
                    //         >
                    //             <span className="w-6 h-6">
                    //                 <div dangerouslySetInnerHTML={{ __html: addCartonIcon }} />
                    //             </span>
                    //             <span className="font-semibold">{product.price} €</span>
                    //             <span className="text-xs font-light">X {String(product.cond)}</span>
                    //         </button>
                    //     )}
                    //     {product?.price_floor ? (
                    //         <button
                    //             className={cn(
                    //                 "w-full h-10 gap-2 flex items-center justify-center rounded-md",
                    //                 "bg-[#84439f] hover:bg-[#84439f]/90 text-white",
                    //                 "dark:bg-[#5cce55] dark:hover:bg-[#5cce55]/90 dark:text-black",
                    //             )}
                    //             onClick={(e: React.MouseEvent) => {
                    //                 e.preventDefault();
                    //                 e.stopPropagation();
                    //                 handleAddToCart(product.id, (Number(product.cond) * Number(product.floor)))
                    //             }}
                    //             title={t('Add a floor')}
                    //         >
                    //             <span className="w-6 h-6">
                    //                 <div dangerouslySetInnerHTML={{ __html: addEtageIcon }} />
                    //             </span>
                    //             <span className="font-semibold">{String(product.price_floor)} €</span>

                    //             <span className="text-xs font-light">X {Number(product.cond) * Number(product.floor)}</span>
                    //         </button>
                    //     ) : <div className="h-10" />}
                    //     {product?.price_roll ? (
                    //         <button
                    //             className={cn(
                    //                 "w-full h-10 gap-2 flex items-center justify-center rounded-md",
                    //                 "bg-main-purple hover:bg-main-purple-hover text-white",
                    //                 "dark:bg-main-green dark:text-black dark:hover:bg-main-green-hover",
                    //             )}
                    //             onClick={(e: React.MouseEvent) => {
                    //                 e.preventDefault();
                    //                 e.stopPropagation();
                    //                 handleAddToCart(product.id, (Number(product.cond) * Number(product.floor) * Number(product.roll)))
                    //             }}
                    //             title={t('Add a roll')}
                    //         >
                    //             <span className="w-6 h-6">
                    //                 <div dangerouslySetInnerHTML={{ __html: addRollIcon }} />
                    //             </span>

                    //             {product?.price_promo ? (
                    //                 <>
                    //                     <span className="font-semibold line-through opacity-75 text-xs">{String(product.price_roll)} €</span>
                    //                     <span className="font-bold text-red-300 dark:text-red-600">{String(product.price_promo)} €</span>
                    //                 </>
                    //             ) : (
                    //                 <span className="font-semibold">{String(product.price_roll)} €</span>
                    //             )}

                    //             <span className="text-xs font-light">X {Number(product.cond) * Number(product.floor) * Number(product.roll)}</span>

                    //         </button>
                    //     ) : <div className="h-10" />}
                    // </CardFooter>
                )}
            </Card>
        </Link>
    );
}