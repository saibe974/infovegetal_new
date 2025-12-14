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
import tagsProducts from '@/routes/tags-products';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';

type Tag = {
    id: number;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
};

type Props = {
    collection: PaginatedCollection<Tag>;
    q?: string | null;
};

export default withAppLayout(
    () => {
        const { t } = useI18n();
        return [
            {
                title: t('Products'),
                href: products.index().url,
            },
            {
                title: t('Tags'),
                href: tagsProducts.index().url,
            },
        ];
    },
    true,
    ({ collection, q }: Props) => {
        const { t } = useI18n();
        const page = usePage<{ searchPropositions?: string[] }>();
        const searchPropositions = page.props.searchPropositions ?? [];
        const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const [fetching, setFetching] = useState(false);
        const [search, setSearch] = useState('');
        const [searchPropositionsState, setSearchPropositions] = useState<string[]>(searchPropositions ?? []);

        const handleSearch = (s: string) => {
            setSearch(s);
            clearTimeout(timerRef.current!);
            router.cancelAll();
            if (s.length < 2) {
                return;
            }
            setFetching(true);
            timerRef.current = setTimeout(async () => {
                try {
                    const res = await fetch(`/search-propositions?context=tags&q=${encodeURIComponent(s)}&limit=10`);
                    const json = await res.json();
                    setSearchPropositions((json.propositions || []) as string[]);
                } finally {
                    setFetching(false);
                }
            }, 300);
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
            // Validation: navigation complète pour réactualiser la page
            router.get(window.location.pathname, { q: trimmed }, {
                preserveState: false,
                replace: true,
                preserveScroll: false,
            });
        };

        return (
            <>
                <Head title={t('Tags')} />
                <StickyBar className='mb-4'>
                    <div className="w-200 flex-1">
                        <SearchSelect
                            value={search}
                            onChange={handleSearch}
                            onSubmit={onSelect}
                            propositions={searchPropositionsState}
                            loading={fetching}
                            count={collection.meta.total}
                            query={q ?? ''}
                        />
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <Button asChild size="sm">
                            <Link href={tagsProducts.create().url}>
                                <PlusIcon size={16} className="mr-2" />
                                {t('Add Tag')}
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
                                <SortableTableHead field="slug">{t('Slug')}</SortableTableHead>
                                <TableHead className='text-end'>{t('Actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from(new Map(collection.data.map((item) => [item.id, item])).values()).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.id}</TableCell>
                                    <TableCell>
                                        <Link href={tagsProducts.edit(item.id)} className="hover:underline font-medium">
                                            {item.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-mono text-xs">
                                            {item.slug}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2 justify-end">
                                            <Button asChild size="icon" variant="outline">
                                                <Link href={tagsProducts.edit(item.id)}>
                                                    <EditIcon size={16} />
                                                </Link>
                                            </Button>
                                            <Button asChild size="icon" variant="destructive-outline">
                                                <Link
                                                    href={tagsProducts.destroy(item.id)}
                                                    method="delete"
                                                    onBefore={() => confirm(t('Are you sure you want to delete this tag?'))}
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
