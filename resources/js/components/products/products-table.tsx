import React from "react";
import { Table, TableBody, TableHeader, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Link } from '@inertiajs/react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditIcon, TrashIcon } from 'lucide-react';
import { type Product, PaginatedCollection } from '@/types';

type Props = {
    collection: PaginatedCollection<Product>;
    canEdit?: boolean;
    canDelete?: boolean;
};

export default function ProductsTable({ collection, canEdit = false, canDelete = false }: Props) {

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

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <SortableTableHead field='id'>ID</SortableTableHead>
                    <TableHead></TableHead>
                    <SortableTableHead field='name'>Name</SortableTableHead>
                    <SortableTableHead field='category_products_id'>Category</SortableTableHead>
                    <TableHead>Description</TableHead>
                    <SortableTableHead field='price'>Price</SortableTableHead>
                    {(canEdit || canDelete) && <TableHead className="text-end">Actions</TableHead>}
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