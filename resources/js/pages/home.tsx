import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Loader2, DownloadIcon } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import SearchSoham from '@/components/ui/searchSoham';
import { Badge } from '@/components/ui/badge';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Home', href: '/' },
];

type Props = {
    collection: PaginatedCollection<Product>;
    q: string | null;
};

export default withAppLayout(breadcrumbs, ({ collection, q }: Props) => {
    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const handleSearch = (s: string) => {
        setSearch(s);
        clearTimeout(timerRef.current as any);
        router.cancelAll();
        if (s.length < 2) return;
        setFetching(true);
        timerRef.current = setTimeout(() => {
            router.reload({
                only: ['searchPropositions'],
                data: { q: s },
                onSuccess: () => setFetching(false),
            })
        }, 300)
    }

    const onSelect = (mysearch: string, options?: { force?: boolean }) => {
        const trimmed = (mysearch ?? '').trim();
        if (options?.force && trimmed.length === 0) {
            const url = new URL(window.location.href);
            url.searchParams.delete('q');
            router.visit(url.toString(), { replace: true });
            setSearch('');
            return;
        }
        if (trimmed.length === 0) return;
        setSearch('');
        router.reload({ data: { q: trimmed } })
    };

    return (
        <div>
            {/* @ts-ignore react-sticky-el types don't include className in our setup */}
            <BasicSticky stickyClassName="bg-background relative z-20" className="relative z-20">
                <div className="flex items-center py-2 relative w-full">
                    <div className="w-200 left-0 top-1 mr-2" >
                        <SearchSoham
                            value={search}
                            onChange={handleSearch}
                            onSubmit={onSelect}
                            propositions={searchPropositions}
                            loading={fetching}
                            count={collection.meta.total}
                            query={q ?? ''}
                        />
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
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Price</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {collection.data.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>
                                    {item.img_link && (
                                        <img src={item.img_link} className="w-20 object-cover" />
                                    )}
                                </TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.category ? item.category.name : ''}</TableCell>
                                <TableCell>
                                    <div className="space-y-2">
                                        <div>{item.description}</div>
                                        {Array.isArray(item.tags) && item.tags.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {item.tags.map((tag: { id: number; name: string; slug: string }) => (
                                                    <Badge key={tag.id} variant="secondary">{tag.name}</Badge>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </TableCell>
                                <TableCell>{item.price}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </InfiniteScroll>
        </div>
    );
})
