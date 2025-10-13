import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { ReactNode } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead,TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Form, Link, InfiniteScroll } from '@inertiajs/react';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EditIcon, TrashIcon } from 'lucide-react';
import Sticky from 'react-sticky-el';
import BasicSticky from 'react-sticky-el';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

type Props = {
    collection: PaginatedCollection<Product>;
    q: string | null;
};

export default withAppLayout(breadcrumbs, ({collection, q }: Props) => {
    // console.log(collection)
    return (
        <div>
            <BasicSticky stickyClassName='z-100 bg-background'>
                <div className="flex items-center py-2 p-relative w-full">
                <Form href={products.index().url} className="flex gap-1 items-center">
                    <Input autoFocus placeholder='Rechercher un produit' name='q' defaultValue={q ?? ''}/>
                    <Button>Rechercher</Button>
                </Form>

                <div className="mx-4 opacity-50">
                    {collection.meta.total > 1 ? collection.meta.total + " occurences" : 
                        collection.meta.total == 0 ? "aucun résultat" : ""}
                </div>
                </div>
            </BasicSticky>

            <InfiniteScroll data="collection">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableTableHead field="id">ID</SortableTableHead>
                            <TableHead></TableHead>
                            <SortableTableHead field="name">Name</SortableTableHead>
                            <TableHead>Price</TableHead>
                            <TableHead className='text-end'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {collection.data.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>
                                    {item.img_link &&
                                        <img src={item.img_link} className="w-20"/>
                                    }
                                </TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.price}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2 justify-end">
                                        <Button asChild size="icon" variant="outline">
                                            <Link href={products.edit(item.id)}>
                                                <EditIcon size={16} />
                                            </Link>
                                        </Button>
                                        <Button asChild size="icon" variant="destructive-outline">
                                            <Link href={products.destroy(item.id)}
                                                onBefore={() => confirm('Are you sure?')}>
                                                <TrashIcon size={16} />
                                            </Link>
                                        </Button>
                                    </div>

                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>

                </Table>
            </InfiniteScroll>
        </div>
        
    )
})

