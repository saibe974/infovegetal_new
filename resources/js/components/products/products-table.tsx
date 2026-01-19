import React, { useContext } from "react";
import { Table, TableBody, TableHeader, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Link, router, usePage } from '@inertiajs/react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Box, CirclePlus, CircleSlash2, Container, EditIcon, Layers, MoveVertical, TrashIcon } from 'lucide-react';
import { type Product, PaginatedCollection, SharedData } from '@/types';
import { useI18n } from "@/lib/i18n";
import { CartContext } from "../cart/cart.context";
import { addCartonIcon, addEtageIcon, addRollIcon } from "@/lib/icon";
import { useSidebar } from "../ui/sidebar";

type Props = {
    collection: PaginatedCollection<Product>;
    canEdit?: boolean;
    canDelete?: boolean;
};

export default function ProductsTable({ collection, canEdit = false, canDelete = false }: Props) {
    const { t } = useI18n();
    const { auth } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;

    const goToProductPage = (id: number) => {
        window.location.href = `/products/${id}`;
    }

    const handleEditClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        window.location.href = `/admin/products/${id}/edit`;
    }

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('Are you sure?')) {
            window.location.href = `/admin/products/${id}/destroy`;
        }
    }

    const { addToCart } = useContext(CartContext);
    const { toggleSidebar, isOpenId } = useSidebar()

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <SortableTableHead field='ref'>Ref</SortableTableHead>
                    <TableHead></TableHead>
                    <SortableTableHead field='name'>{t('Name')}</SortableTableHead>
                    <SortableTableHead field='category_products_id'>{t('Category')}</SortableTableHead>
                    <TableHead className="flex items-center">
                        <CircleSlash2 className="size-3 mr-1" />{t('Pot')} / <MoveVertical className="size-3" />{t('Height')}
                    </TableHead>
                    {isAuthenticated && (
                        <>

                            <SortableTableHead field='price'>{t('Price')}</SortableTableHead>
                            <TableHead className="text-center">{t('Add to cart')}</TableHead>
                        </>
                    )}

                    {(canEdit || canDelete) && <TableHead className="text-end">{t('Actions')}</TableHead>}

                </TableRow>
            </TableHeader>
            <TableBody className="">
                {collection.data.map((item) => (
                    <TableRow key={item.id} className="group hover:cursor-pointer" onClick={() => goToProductPage(item.id)}>
                        <TableCell>{String(item.ref)}</TableCell>
                        <TableCell>
                            {item.img_link ? <img src={item.img_link} className="w-20 object-cover" alt={item.name} /> : <img src="/placeholder.png" className="w-20 object-cover" alt="Placeholder" />}
                        </TableCell>
                        <TableCell className=''>
                            <div className="flex flex-col justify-center gap-1">
                                <span className="group group-hover:underline underline-offset-2">
                                    {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
                                </span>
                                <span className="text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
                                    {item.description ? item.description : ''}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell>{item.category ? item.category.name.charAt(0).toUpperCase() + item.category.name.slice(1) : ''}</TableCell>
                        <TableCell>
                            <div className="space-y-2">
                                {item?.pot ? (
                                    <p className=" flex gap-1" title={t('Diameter of the pot')}>
                                        <span><CircleSlash2 className="size-4" /></span>
                                        <span>{String(item.pot)} cm</span>
                                    </p>
                                ) : null}


                                {item?.height ? (
                                    <p className="flex" title={t('Height')}>
                                        <span><MoveVertical className="size-4" /></span>
                                        <span>{String(item.height)} cm</span>
                                    </p>
                                ) : null}
                            </div>
                        </TableCell>
                        {isAuthenticated && (
                            <>
                                <TableCell className="space-y-2">
                                    {item?.price && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-main-purple dark:text-main-green w-6 h-6">
                                                <div dangerouslySetInnerHTML={{ __html: addCartonIcon }} />
                                            </span>
                                            <span className="font-semibold">{item.price} €</span>
                                        </div>
                                    )}
                                    {item?.price_floor ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-main-purple dark:text-main-green w-6 h-6">
                                                <div dangerouslySetInnerHTML={{ __html: addEtageIcon }} />
                                            </span>
                                            <span className="font-semibold">{String(item.price_floor)} €</span>
                                        </div>
                                    ) : null}
                                    {item?.price_roll ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <span className="text-main-purple dark:text-main-green w-6 h-6">
                                                <div dangerouslySetInnerHTML={{ __html: addRollIcon }} />
                                            </span>
                                            {item?.price_promo ? (
                                                <>
                                                    <span className="font-semibold line-through text-gray-400">{String(item.price_roll)} €</span>
                                                    <span className="font-bold text-red-600">{String(item.price_promo)} €</span>
                                                </>
                                            ) : (
                                                <span className="font-semibold">{String(item.price_roll)} €</span>
                                            )}
                                        </div>
                                    ) : null}
                                </TableCell>

                                <TableCell className="text-end">
                                    <div className="flex flex-col gap-1">
                                        {item?.price && (
                                            <button
                                                className="text-sm flex items-center border dark:border-accent rounded-md py-1 hover:bg-main-purple/10 dark:hover:bg-main-green/10 w-2/3 mx-auto"
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    addToCart(item, Number(item.cond));
                                                    !isOpenId('right') && toggleSidebar('right');
                                                }}
                                                title={t('Add a tray')}
                                            >
                                                <span className="w-6 h-6 mx-1 text-main-purple dark:text-main-green">
                                                    <div dangerouslySetInnerHTML={{ __html: addCartonIcon }} />
                                                </span>
                                                <span className=" mr-1">X {Number(item.cond)}</span>
                                            </button>
                                        )}
                                        {item?.price_floor ? (
                                            <button
                                                className="text-sm flex items-center border dark:border-accent rounded-md py-1 hover:bg-main-purple/10 dark:hover:bg-main-green/10 w-2/3 mx-auto"
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    addToCart(item, Number(item.cond) * Number(item.floor));
                                                    !isOpenId('right') && toggleSidebar('right');
                                                }}
                                                title={t('Add a floor')}
                                            >
                                                <span className="w-6 h-6 mx-1 text-main-purple dark:text-main-green">
                                                    <div dangerouslySetInnerHTML={{ __html: addEtageIcon }} />
                                                </span>
                                                <span className=" mr-1">X {Number(item.cond) * Number(item.floor)}</span>
                                            </button>
                                        ) : null}
                                        {item?.price_roll ? (
                                            <button
                                                className="text-sm flex items-center border dark:border-accent rounded-md py-1 hover:bg-main-purple/10 dark:hover:bg-main-green/10 w-2/3 mx-auto"
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    addToCart(item, Number(item.cond) * Number(item.floor) * Number(item.roll));
                                                    !isOpenId('right') && toggleSidebar('right');
                                                }}
                                                title={t('Add a roll')}
                                            >
                                                <span className="w-6 h-6 mx-1 text-main-purple dark:text-main-green">
                                                    <div dangerouslySetInnerHTML={{ __html: addRollIcon }} />
                                                </span>
                                                <span className="mr-1">X {Number(item.cond) * Number(item.floor) * Number(item.roll)}</span>
                                            </button>
                                        ) : null}
                                    </div>
                                </TableCell>
                            </>
                        )}
                        {(canEdit || canDelete) && (
                            <TableCell>
                                <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                                    {canEdit && (
                                        <Button
                                            size="icon"
                                            variant="outline"
                                            onClick={(e) => handleEditClick(e, item.id)}
                                        >
                                            <EditIcon size={16} />
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button
                                            size="icon"
                                            variant="destructive-outline"
                                            onClick={(e) => handleDeleteClick(e, item.id)}
                                        >
                                            <TrashIcon size={16} />
                                        </Button>
                                    )}
                                </div>
                            </TableCell>
                        )}

                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}