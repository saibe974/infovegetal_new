import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import productCategories from '@/routes/products-categories';
import { useEffect, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection, ProductCategory } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EditIcon, TrashIcon } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
import SearchSoham from '@/components/app/search-select';
import { useSidebar } from '@/components/ui/sidebar';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

type Props = {
    collection: PaginatedCollection<ProductCategory>;
    q: string | null;
};

export default withAppLayout(breadcrumbs, true, ({ collection, q }: Props) => {
    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const { isOpenId } = useSidebar();
    const rightSidebarOpen = isOpenId('right');
    const mainSidebarOpen = isOpenId('main');

    const [topOffset, setTopOffset] = useState<number>(0);
    const [width, setWidth] = useState<number>(0);
    const [stickyKey, setStickyKey] = useState<number>(0);

    useEffect(() => {
        const selector = '.top-sticky';
        const getHeight = () => {
            const el = document.querySelector(selector) as HTMLElement | null;
            return el ? Math.ceil(el.getBoundingClientRect().height) : 0;
        };

        const getWidth = () => {
            const el = document.querySelector('main') as HTMLElement | null;
            if (!el) return 0;
            const computedStyle = window.getComputedStyle(el);
            const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
            const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
            return Math.ceil(el.clientWidth - paddingLeft - paddingRight - 30);
        }

        const update = () => {
            setTopOffset(getHeight());
            setWidth(getWidth());
            setStickyKey(prev => prev + 1);
        };

        update();
        window.addEventListener('resize', update);

        // Observer l'élément <main> pour détecter les changements de largeur 
        let mainRo: ResizeObserver | null = null;
        const mainEl = document.querySelector('main') as HTMLElement | null;
        if (mainEl && typeof ResizeObserver !== 'undefined') {
            mainRo = new ResizeObserver(update);
            mainRo.observe(mainEl);
        }

        return () => {
            window.removeEventListener('resize', update);
            if (mainRo) mainRo.disconnect();
        };
    }, [rightSidebarOpen, mainSidebarOpen]);

    const handleSearch = (s: string) => {
        setSearch(s);
        // @ts-ignore
        clearTimeout(timerRef.current);
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
                // preserveState: true,
            })
        }, 300)
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
        router.reload({
            data: { q: trimmed },
        })

        console.log("selected:", trimmed);
    };

    return (
        <div>
            {/* @ts-ignore */}
            <BasicSticky
                key={stickyKey}
                stickyClassName='z-25 bg-background'
                wrapperClassName='relative z-25'
                stickyStyle={{ top: topOffset, width: width }}
            >
                <div className="flex items-center py-2 relative w-full">

                    <div className="w-200 left-0 top-1 z-100 mr-2" >
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


                    {/* <div className="ml-auto flex items-center gap-2">
                        <DownloadCsvButton />
                        <UploadCsvButton />
                    </div> */}
                </div>
            </BasicSticky>

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
                        {collection.data.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>
                                    <Link href={productCategories.edit(item.id)} className="hover:underline">
                                        {item.name}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <div className="flex gap-2 justify-end">
                                        <Button asChild size="icon" variant="outline">
                                            <Link href={productCategories.edit(item.id)}>
                                                <EditIcon size={16} />
                                            </Link>
                                        </Button>
                                        <Button asChild size="icon" variant="destructive-outline">
                                            <Link href={productCategories.destroy(item.id)}
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

