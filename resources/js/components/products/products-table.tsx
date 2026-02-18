import React, { useContext } from "react";
import { Table, TableBody, TableHeader, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Link, router, usePage } from '@inertiajs/react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BadgeEuro, Box, CirclePlus, CircleSlash2, Container, EditIcon, Layers, MoveVertical, TrashIcon } from 'lucide-react';
import { type Product, PaginatedCollection, SharedData } from '@/types';
import { useI18n } from "@/lib/i18n";
import { CartContext } from "../cart/cart.context";
import { addCartonIcon, addEtageIcon, addRollIcon } from "@/lib/icon";
import { useSidebar } from "../ui/sidebar";

const formatCurrency = (value: number): string =>
    value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

const toNumber = (value: unknown): number | null => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

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

    const { addToCart, items } = useContext(CartContext);
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
                        </>
                    )}

                    {(canEdit || canDelete) && <TableHead className="text-end">{t('Actions')}</TableHead>}

                </TableRow>
            </TableHeader>


            <TableBody className="">
                {collection.data.map((item) => {
                    const isInCart = items.some((cartItem) => cartItem.product.id === item.id);
                    const price = toNumber(item.price);
                    const priceFloor = toNumber(item.price_floor);
                    const priceRoll = toNumber(item.price_roll);
                    const pricePromo = toNumber(item.price_promo);
                    return (
                        <TableRow
                            key={item.id}
                            className={`group hover:cursor-pointer ${isInCart ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''}`}
                            onClick={() => goToProductPage(item.id)}
                        >
                            <TableCell>{String(item.ref)}</TableCell>
                            <TableCell className="relative">
                                {item.img_link ? (
                                    <img src={item.img_link} className="w-20 object-cover" alt={item.name} />
                                ) : (
                                    <img src="/placeholder.png" className="w-20 object-cover" alt="Placeholder" />
                                )
                                }
                                {item?.price_promo && Number(item.price_promo) > 0 ? (
                                    <span className="absolute left-2 top-0 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold">
                                        <BadgeEuro className="w-5 h-5" />
                                    </span>
                                ) : null}
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
                                    <TableCell className="text-end">
                                        <div className="flex gap-1">
                                            {price !== null && (
                                                <button
                                                    className="w-full text-sm flex items-center border dark:border-accent rounded-md py-1 bg-brand-tertiary hover:bg-brand-tertiary/90 text-white dark:text-black"
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        addToCart(item, Number(item.cond));
                                                        !isOpenId('right') && toggleSidebar('right');
                                                    }}
                                                    title={t('Add a tray')}
                                                >
                                                    <div className="w-1/3 flex justify-center">
                                                        <span className="w-6 h-6 mx-1 text-main-purple dark:text-main-green">
                                                            <div dangerouslySetInnerHTML={{ __html: addCartonIcon }} />
                                                        </span>
                                                    </div>
                                                    <div className="w-1/2 flex flex-col items-center">
                                                        <span className="font-semibold">{formatCurrency(price)}</span>
                                                        <span className="text-xs font-light mr-1">X {Number(item.cond)}</span>
                                                    </div>
                                                </button>
                                            )}
                                            {priceFloor !== null ? (
                                                <button
                                                    className="w-full text-sm flex items-center border dark:border-accent rounded-md py-1 bg-brand-secondary hover:bg-brand-secondary/90 text-white dark:text-black"
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        addToCart(item, Number(item.cond) * Number(item.floor));
                                                        !isOpenId('right') && toggleSidebar('right');
                                                    }}
                                                    title={t('Add a floor')}
                                                >
                                                    <div className="w-1/3 flex justify-center">
                                                        <span className="w-6 h-6 mx-1 text-main-purple dark:text-main-green">
                                                            <div dangerouslySetInnerHTML={{ __html: addEtageIcon }} />
                                                        </span>
                                                    </div>
                                                    <div className="w-1/2 flex flex-col items-center">
                                                        <span className="font-semibold">{formatCurrency(priceFloor)}</span>
                                                        <span className="text-xs font-light mr-1">X {Number(item.cond) * Number(item.floor)}</span>
                                                    </div>
                                                </button>
                                            ) : null}
                                            {priceRoll !== null ? (
                                                <button
                                                    className="w-full text-sm flex items-center border dark:border-accent rounded-md py-1 bg-brand-main hover:bg-brand-main-hover text-white dark:text-black"
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        addToCart(item, Number(item.cond) * Number(item.floor) * Number(item.roll));
                                                        !isOpenId('right') && toggleSidebar('right');
                                                    }}
                                                    title={t('Add a roll')}
                                                >
                                                    <div className="w-1/3 flex justify-center">
                                                        <span className="w-6 h-6 mx-1 text-main-purple dark:text-main-green">
                                                            <div dangerouslySetInnerHTML={{ __html: addRollIcon }} />
                                                        </span>
                                                    </div>
                                                    <div className="w-1/2 flex flex-col items-center">
                                                        {pricePromo !== null ? (
                                                            <>
                                                                {/* <span className="font-thin line-through opacity-75 text-[10px]">{String(item.price_roll)} €</span> */}
                                                                <span className="font-bold text-red-300 dark:text-red-600">{formatCurrency(pricePromo)}</span>
                                                                <span className="text-xs font-light mr-1">X {Number(item.cond) * Number(item.floor) * Number(item.roll)}</span>
                                                            </>

                                                        ) : (
                                                            <>
                                                                <span className="font-semibold">{formatCurrency(priceRoll)}</span>
                                                                <span className="text-xs font-light mr-1">X {Number(item.cond) * Number(item.floor) * Number(item.roll)}</span>
                                                            </>
                                                        )}

                                                    </div>
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
                    );
                })
                }
            </TableBody >
        </Table >
    );
}