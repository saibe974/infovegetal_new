import React from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
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
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Price</TableHead>
                    {(canEdit || canDelete) && <TableHead className="text-end">Actions</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {collection.data.map((item) => (
                    <TableRow key={item.id}>
                        <TableCell>{item.id}</TableCell>
                        <TableCell>
                            {item.img_link && <img src={item.img_link} className="w-20 object-cover" alt={item.name} />}
                        </TableCell>
                        <TableCell>
                            <Link
                                href={canEdit ? `/admin/products/${item.id}/edit` : `/products/${item.id}`}
                                className="hover:underline"
                            >
                                {item.name}
                            </Link>
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
                        <TableCell>{item.price}</TableCell>
                        {(canEdit || canDelete) && (
                            <TableCell>
                                <div className="flex gap-2 justify-end">
                                    {canEdit && (
                                        <Button asChild size="icon" variant="outline">
                                            <Link href={`/admin/products/${item.id}/edit`}>
                                                <EditIcon size={16} />
                                            </Link>
                                        </Button>
                                    )}
                                    {canDelete && (
                                        <Button asChild size="icon" variant="destructive-outline">
                                            <Link href={`/admin/products/${item.id}/destroy`} onBefore={() => confirm('Are you sure?')}>
                                                <TrashIcon size={16} />
                                            </Link>
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