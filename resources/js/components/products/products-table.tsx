import React, { useContext } from "react";
import { Table, TableBody, TableHeader, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Link, router, usePage } from '@inertiajs/react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CirclePlus, EditIcon, TrashIcon } from 'lucide-react';
import { type Product, PaginatedCollection, SharedData } from '@/types';
import { useI18n } from "@/lib/i18n";
import { CartContext } from "../cart/cart.context";

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
        canEdit ? window.location.href = `/admin/products/${id}/edit` :
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

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <SortableTableHead field='id'>ID</SortableTableHead>
                    <TableHead></TableHead>
                    <SortableTableHead field='name'>{t('Name')}</SortableTableHead>
                    <SortableTableHead field='category_products_id'>{t('Category')}</SortableTableHead>
                    <TableHead>{t('Description')}</TableHead>
                    <SortableTableHead field='price'>{t('Price')}</SortableTableHead>
                    <TableHead className="text-end">{t('Add to cart')}</TableHead>
                    {(canEdit || canDelete) && <TableHead className="text-end">{t('Actions')}</TableHead>}

                </TableRow>
            </TableHeader>
            <TableBody className="">
                {collection.data.map((item) => (
                    <TableRow key={item.id} className="group hover:cursor-pointer" onClick={() => goToProductPage(item.id)}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>
                            {item.img_link ? <img src={item.img_link} className="w-20 object-cover" alt={item.name} /> : <img src="/placeholder.png" className="w-20 object-cover" alt="Placeholder" />}
                        </TableCell>
                        <TableCell className='group group-hover:underline underline-offset-2'>
                            {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
                        </TableCell>
                        <TableCell>{item.category ? item.category.name : ''}</TableCell>
                        <TableCell>
                            <div className="space-y-2">
                                <div>{item.description}</div>
                                {item.tags && item.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {item.tags.map((tag: any) => (
                                            <Badge key={tag.id} variant="secondary">
                                                {tag.name}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>{item.price} €</TableCell>
                        {/* {isAuthenticated && ( */}
                        <TableCell className="text-end">
                            <Button
                                title={t('Add to cart')}
                                variant={'outline'}
                                size={'icon'}
                                className="text-green-700 hover:text-green-700 hover:bg-green-700/30 border-green-700 dark:text-green-500 dark:hover:text-green-500 dark:hover:bg-green-500/30 dark:border-green-500"
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    if (isAuthenticated) {
                                        addToCart(item, 1);
                                    } else {
                                        // Stocker l'intention d'ajout au panier avant redirection
                                        sessionStorage.setItem('pendingCartAdd', JSON.stringify({ productId: item.id, quantity: 1 }));
                                        router.visit('/login');
                                    }
                                }}
                            >
                                <CirclePlus />
                            </Button>
                        </TableCell>
                        {/* )} */}
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