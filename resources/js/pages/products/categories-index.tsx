import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import categoryProducts from '@/routes/category-products';
import { useEffect, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection, ProductCategory } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
import { EditIcon, Loader2Icon, TrashIcon } from 'lucide-react';
import { StickyBar } from '@/components/ui/sticky-bar';
import SearchSelect from '@/components/app/search-select';
import { useI18n } from '@/lib/i18n';
import { DraggableCategoriesTable } from '@/components/categories/draggable-categories-table';

type Props = {
    collection: PaginatedCollection<ProductCategory>;
    q: string | null;
    children?: ProductCategory[];
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
                title: t('Categories'),
                href: categoryProducts.index().url,
            },
        ];
    },
    true,
    ({ collection, q, children }: Props) => {
        const page = usePage<{ searchPropositions?: string[] }>();
        const searchPropositions = page.props.searchPropositions ?? [];
        // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
        const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const [fetching, setFetching] = useState(false);
        const [search, setSearch] = useState('');
        const [searchPropositionsState, setSearchPropositions] = useState<string[]>(searchPropositions ?? []);

        const handleSearch = (s: string) => {
            setSearch(s);
            // @ts-ignore
            clearTimeout(timerRef.current);
            router.cancelAll();
            if (s.length < 2) {
                return;
            }
            setFetching(true);
            timerRef.current = setTimeout(async () => {
                try {
                    const res = await fetch(`/search-propositions?context=categories&q=${encodeURIComponent(s)}&limit=10`);
                    const json = await res.json();
                    setSearchPropositions((json.propositions || []) as string[]);
                } finally {
                    setFetching(false);
                }
            }, 300);
        };

        // @ts-ignore
        const onSelect = (mysearch: string, options?: { force?: boolean }) => {
            const trimmed = (mysearch ?? '').trim();
            // If explicit clear requested, remove q from URL instead of setting q=""
            if (options?.force && trimmed.length === 0) {
                const url = new URL(window.location.href);
                url.searchParams.delete('q');
                router.visit(url.toString(), { replace: true });
                setSearch('');
                return;
            }

            // Otherwise ignore empty submissions
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

            // console.log("selected:", trimmed);
        };

        return (
            <div>
                {/* @ts-ignore */}
                <StickyBar
                    className='mb-4'
                >
                    <div className="flex items-center py-2 relative w-full">

                        <div className="w-200 left-0 top-1 z-100 mr-2" >
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


                        {/* <div className="ml-auto flex items-center gap-2">
                        <DownloadCsvButton />
                        <UploadCsvButton />
                    </div> */}
                    </div>
                </StickyBar>

                {q ? (
                    // Mode recherche : affichage classique avec InfiniteScroll
                    <>
                        <InfiniteScroll data="collection">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableTableHead field="id">ID</SortableTableHead>
                                        <SortableTableHead field="name">Name</SortableTableHead>
                                        <TableHead className='text-end'>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Array.from(new Map(collection.data.map((item) => [item.id, item])).values()).map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.id}</TableCell>
                                            <TableCell>
                                                <Link href={categoryProducts.edit(item.id)} className="hover:underline flex items-center gap-2">
                                                    <span style={{ marginLeft: `${(item.depth || 0) * 24}px` }} className="flex items-center gap-2">
                                                        {item.depth && item.depth > 0 && (
                                                            <span className="text-muted-foreground">↳</span>
                                                        )}
                                                        {item.name}
                                                    </span>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2 justify-end">
                                                    <Button asChild size="icon" variant="outline">
                                                        <Link href={categoryProducts.edit(item.id)}>
                                                            <EditIcon size={16} />
                                                        </Link>
                                                    </Button>
                                                    <Button asChild size="icon" variant="destructive-outline">
                                                        <Link href={categoryProducts.destroy(item.id)}
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

                        {collection.meta.current_page < collection.meta.last_page &&
                            <div className='w-full h-50 flex items-center justify-center mt-4'>
                                <Loader2Icon size={50} className='animate-spin text-main-purple dark:text-main-green' />
                            </div>
                        }
                    </>
                ) : (
                    // Mode normal : table drag & drop pour réorganiser
                    <DraggableCategoriesTable collection={collection} children={children} />
                )}
            </div>

        )
    })

