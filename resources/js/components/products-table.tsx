import React, { useEffect, useState } from "react";
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link } from '@inertiajs/react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditIcon, TrashIcon } from 'lucide-react';
import { type Product, PaginatedCollection } from '@/types';
import BasicSticky from "react-sticky-el";

type Props = {
    collection: PaginatedCollection<Product>;
    canEdit?: boolean;
    canDelete?: boolean;
};

export default function ProductsTable({ collection, canEdit = false, canDelete = false }: Props) {
    const [topOffset, setTopOffset] = useState<number>(0);
    const [width, setWidth] = useState<number>(0);

    useEffect(() => {
        const selector = '.search-sticky'; // classe à ajouter sur le sticky du dessus
        const selector2 = '.top-sticky'; // classe à ajouter sur le sticky du dessus
        const getHeight = () => {
            const el = document.querySelector(selector) as HTMLElement | null;
            // const el2 = document.querySelector(selector2) as HTMLElement | null;
            // console.log('heights:', el?.getBoundingClientRect().height, el2?.getBoundingClientRect().height);
            // return el && el2 ? Math.ceil(el.getBoundingClientRect().height + el2.getBoundingClientRect().height) : 0;
            return el ? Math.ceil(el.getBoundingClientRect().height) : 0;
        };

        const getWidth = () => {
            const el = document.querySelector(selector) as HTMLElement | null;
            return el ? Math.ceil(el.getBoundingClientRect().width - 12) : 0;
        }

        const update = () => { setTopOffset(getHeight()), setWidth(getWidth()) };
        update();
        // console.log(topOffset)
        window.addEventListener('resize', update);

        // ResizeObserver pour réagir aux changements de layout (sidebar resize)
        let ro: ResizeObserver | null = null;
        const headerEl = document.querySelector(selector) as HTMLElement | null;
        if (headerEl && typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(update);
            ro.observe(headerEl);
        }

        // MutationObserver pour changements structurels (optionnel)
        // const obs = new MutationObserver(update);
        // const parent = document.body;
        // obs.observe(parent, { childList: true, subtree: true });

        return () => {
            window.removeEventListener('resize', update);
            // obs.disconnect();
            if (ro) ro.disconnect();
        };
    }, []);

    return (
        <Table
        // style={{ position: 'relative' }}
        // className="sticky top-0"
        >
            {/* <BasicSticky
                topOffset={topOffset}
                stickyStyle={{ top: topOffset, width: '100%' }}
                stickyClassName="bg-background"
                wrapperClassName="w-full"
            > */}

            {/* <colgroup>
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '20%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: (canEdit || canDelete) ? '25%' : '40%' }} />
                <col style={{ width: (canEdit || canDelete) ? '10%' : '20%' }} />
                <col style={{ width: 'auto' }} />
            </colgroup> */}

            <TableHeader
            // style={{ position: 'sticky', top: topOffset, }}
            // className="sticky"
            >
                <TableRow
                    className="w-full "
                >

                    <TableHead className="">ID</TableHead>
                    <TableHead className=""></TableHead>
                    <TableHead className="">Name</TableHead>
                    <TableHead className="">Category</TableHead>
                    <TableHead className="">Description</TableHead>
                    <TableHead className={``}>Price (€)</TableHead>
                    {(canEdit || canDelete) && <TableHead className="text-end ">Actions</TableHead>}

                </TableRow>
            </TableHeader>
            {/* </BasicSticky> */}
            <TableBody className="">
                {collection.data.map((item) => (
                    <TableRow key={item.id} className="">
                        <TableCell>{item.id}</TableCell>
                        <TableCell>
                            {item.img_link ? <img src={item.img_link} className="w-20 object-cover" alt={item.name} /> : <img src="/placeholder.png" className="w-20 object-cover" alt="Placeholder" />}
                        </TableCell>
                        <TableCell>
                            <Link
                                href={canEdit ? `/admin/products/${item.id}/edit` : `/products/${item.id}`}
                                className="hover:underline"
                            >
                                {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
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
                        <TableCell>{item.price} €</TableCell>
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