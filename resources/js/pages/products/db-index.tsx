import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { useEffect, useRef, useState } from 'react';
import { type BreadcrumbItem, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router, Head } from '@inertiajs/react';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
import { EditIcon, TrashIcon, PlusIcon } from 'lucide-react';
import { StickyBar } from '@/components/ui/sticky-bar';
import SearchSelect from '@/components/app/search-select';
import dbProducts from '@/routes/db-products';
import { useI18n } from '@/lib/i18n';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
    {
        title: 'Database',
        href: dbProducts.index().url,
    },
];

type DbProduct = {
    id: number;
    name: string;
    description: string | null;
    champs: Record<string, any> | null;
    categories: Record<string, any> | null;
    traitement: string | null;
    created_at: string;
    updated_at: string;
};

type Props = {
    collection: PaginatedCollection<DbProduct>;
    q?: string | null;
};

export default withAppLayout(breadcrumbs, true, ({ collection, q }: Props) => {
    const { t } = useI18n();
    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const handleSearch = (s: string) => {
        setSearch(s);
        clearTimeout(timerRef.current!);
        router.cancelAll();
        if (s.length < 2) {
            return;
        }
        setFetching(true);
        timerRef.current = setTimeout(() => {
            router.reload({
                only: ['searchPropositions'],
                data: { q: s },
                onSuccess: () => setFetching(false),
            })
        }, 300)
    };

    const onSelect = (mysearch: string, options?: { force?: boolean }) => {
        const trimmed = (mysearch ?? '').trim();
        if (options?.force && trimmed.length === 0) {
            const url = new URL(window.location.href);
            url.searchParams.delete('q');
            router.visit(url.toString(), { replace: true });
            setSearch('');
            return;
        }

        if (trimmed.length === 0) {
            return;
        }

        setSearch('');
        router.reload({
            data: { q: trimmed },
        })
    };

    return (
        <>
            <Head title={t('Database')} />
            <StickyBar className='mb-4'>
                <div className="w-200 flex-1">
                    <SearchSelect
                        value={search}
                        onChange={handleSearch}
                        onSubmit={onSelect}
                        propositions={searchPropositions}
                        loading={fetching}
                        count={collection.meta.total}
                        query={q ?? ''}
                    />
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button asChild size="sm">
                        <Link href={dbProducts.create().url}>
                            <PlusIcon size={16} className="mr-2" />
                            {t('Add Database')}
                        </Link>
                    </Button>
                </div>
            </StickyBar>

            <InfiniteScroll data="collection">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableTableHead field="id">ID</SortableTableHead>
                            <SortableTableHead field="name">{t('Name')}</SortableTableHead>
                            <TableHead>{t('Description')}</TableHead>
                            <TableHead>{t('Treatment')}</TableHead>
                            <TableHead className='text-end'>{t('Actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {collection.data.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>
                                    <Link href={dbProducts.edit(item.id).url} className="hover:underline font-medium">
                                        {item.name}
                                    </Link>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">
                                    {item.description || '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                    {item.traitement || '-'}
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2 justify-end">
                                        <Button asChild size="icon" variant="outline">
                                            <Link href={dbProducts.edit(item.id).url}>
                                                <EditIcon size={16} />
                                            </Link>
                                        </Button>
                                        <Button asChild size="icon" variant="destructive-outline">
                                            <Link
                                                href={dbProducts.destroy(item.id).url}
                                                method="delete"
                                                onBefore={() => confirm(t('Are you sure you want to delete this database?'))}
                                            >
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
        </>
    )
})
