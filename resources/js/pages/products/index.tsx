import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { useEffect, useRef, useState } from 'react';
import { SharedData, type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router, Head } from '@inertiajs/react';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UploadIcon, EditIcon, TrashIcon, List, LayoutGrid } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
import SearchSoham from '@/components/ui/searchSoham';
import { CsvUploadFilePond } from '@/components/csv-upload-filepond';
import { isAdmin, isClient, hasPermission } from '@/lib/roles';
import ProductsTable from '@/components/products-table';
import { ProductsCardsList } from '@/components/products-cards-list';
import { useSidebar } from '@/components/ui/sidebar';

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

export default withAppLayout(breadcrumbs, ({ collection, q }: Props) => {
    // console.log(collection)
    const { auth, locale } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;
    const canEdit = isAdmin(user) || hasPermission(user, 'edit products');
    const canDelete = isAdmin(user) || hasPermission(user, 'delete products');
    const canImportExport = isAdmin(user) || hasPermission(user, 'import products') || hasPermission(user, 'export products');

    const { isOpenId } = useSidebar();
    const rightSidebarOpen = isOpenId('right');
    const mainSidebarOpen = isOpenId('main');

    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const [topOffset, setTopOffset] = useState<number>(0);
    const [width, setWidth] = useState<number>(0);
    const [stickyKey, setStickyKey] = useState<number>(0);

    const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
        if (typeof window === 'undefined') return 'table';
        const stored = localStorage.getItem('products_view_mode');
        return stored === 'grid' ? 'grid' : 'table';
    });

    // sauvegarde à chaque changement (safe)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem('products_view_mode', viewMode);
        } catch (e) {
            // ignore (ex: stockage bloqué)
        }
    }, [viewMode]);

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

        // ResizeObserver pour réagir aux changements de layout (sidebar resize)
        let ro: ResizeObserver | null = null;
        const headerEl = document.querySelector(selector) as HTMLElement | null;
        if (headerEl && typeof ResizeObserver !== 'undefined') {
            ro = new ResizeObserver(update);
            ro.observe(headerEl);
        }

        // Observer l'élément <main> pour détecter les changements de largeur 
        // causés par les deux sidebars (gauche et droite)
        let mainRo: ResizeObserver | null = null;
        const mainEl = document.querySelector('main') as HTMLElement | null;
        if (mainEl && typeof ResizeObserver !== 'undefined') {
            mainRo = new ResizeObserver(update);
            mainRo.observe(mainEl);
        }

        return () => {
            window.removeEventListener('resize', update);
            if (ro) ro.disconnect();
            if (mainRo) mainRo.disconnect();
        };
    }, [rightSidebarOpen, mainSidebarOpen]); // Se déclenche uniquement quand les sidebars changent

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
    }

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

        // console.log("selected:", trimmed);
    };

    // console.log(collection);

    return (
        <>
            <Head title="Products" />
            <BasicSticky
                key={stickyKey}
                stickyClassName='z-25 bg-background'
                stickyStyle={{ top: topOffset, width: width }}
            >
                <div className="flex items-center relative w-full gap-2 border-b border-sidebar-border/50 py-2">

                    <div className="flex gap-2">
                        <button
                            type="button"
                            aria-pressed={viewMode === 'table'}
                            onClick={() => setViewMode('table')}
                            className={`
                                p-2 rounded-md transition border ${viewMode === 'table' ?
                                    'bg-accent' :
                                    'hover:bg-accent hover:text-inherit text-black/40 dark:text-white/40 dark:hover:text-inherit'}
                            `}
                            title="Afficher en tableau"
                        >
                            <List />
                        </button>

                        <button
                            type="button"
                            aria-pressed={viewMode === 'grid'}
                            onClick={() => setViewMode('grid')}
                            className={`
                                p-2 rounded-md transition border ${viewMode === 'grid' ?
                                    'bg-accent' :
                                    'hover:bg-accent hover:text-inherit text-black/40 dark:text-white/40 dark:hover:text-inherit'}
                            `}
                            title="Afficher en grille"
                        >
                            <LayoutGrid />
                        </button>
                    </div>

                    <div className="w-200 flex-1">
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

                    {canImportExport && (
                        <div className="ml-auto flex items-center gap-2">
                            <CsvUploadFilePond
                                title='Upload CSV'
                                description='Uploadez un fichier CSV'
                                uploadUrl='/upload'
                                importProcessUrl={products.admin.import.process.url()}
                                importProcessChunkUrl={products.admin.import.process_chunk.url()}
                                importCancelUrl={products.admin.import.cancel.url()}
                                importProgressUrl={(id) => products.admin.import.progress.url({ id })}
                                buttonLabel=''
                            />
                            <DownloadCsvButton />
                        </div>
                    )}
                </div>
            </BasicSticky>

            <InfiniteScroll data="collection" className=''>
                {viewMode === 'table' ? (
                    <ProductsTable collection={collection} canEdit={canEdit} canDelete={canDelete} />
                ) : (
                    <ProductsCardsList products={collection.data} canEdit={canEdit} canDelete={canDelete} />
                )}
            </InfiniteScroll>
        </>

    )
})

function DownloadCsvButton() {
    return (
        <a href="/admin/products/export" className="clickable inline-flex items-center border px-3 py-1 rounded text-sm">
            <UploadIcon />
        </a>
    );
}

