import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { useEffect, useRef, useState } from 'react';
import { SharedData, type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UploadIcon, EditIcon, TrashIcon, List, LayoutGrid } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
import SearchSoham from '@/components/ui/searchSoham';
import { CsvUploadButton } from '@/components/csv-upload-button';
import { isAdmin, hasPermission } from '@/lib/roles';
import ProductsTable from '@/components/products-table';
import { ProductsCardsList } from '@/components/products-cards-list';

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

    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const [topOffset, setTopOffset] = useState<number>(0);

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
        const selector = '.top-sticky'; // classe à ajouter sur le sticky du dessus
        const getHeight = () => {
            const el = document.querySelector(selector) as HTMLElement | null;
            return el ? Math.ceil(el.getBoundingClientRect().height) : 0;
        };

        const update = () => setTopOffset(getHeight());
        update();
        window.addEventListener('resize', update);
        // si ton layout change dynamiquement (menu mobile), tu peux aussi observer le DOM :
        const obs = new MutationObserver(update);
        const parent = document.body;
        obs.observe(parent, { childList: true, subtree: true });
        return () => {
            window.removeEventListener('resize', update);
            obs.disconnect();
        };
    }, []);

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

        console.log("selected:", trimmed);
    };

    // console.log(collection);

    return (
        <div>
            <BasicSticky
                topOffset={topOffset}
                stickyStyle={{ top: topOffset }}
                stickyClassName="bg-background"
                wrapperClassName="relative z-20"
            >
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

                    <div className="flex gap-2 ml-5">
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

                    {canImportExport && (
                        <div className="ml-auto flex items-center gap-2">
                            <CsvUploadButton config={{
                                type: 'products',
                                title: 'Import CSV',
                                description: 'Importez un fichier CSV pour créer/mettre à jour vos produits (~100/s)',
                                uploadUrl: '/admin/products/import/upload',
                                processUrl: '/admin/products/import/process',
                                cancelUrl: '/admin/products/import/cancel',
                                progressUrl: (id) => `/admin/products/import/progress/${id}`,
                                reportUrl: (id) => `/admin/products/import/report/${id}`,
                                successRedirectUrl: products.index().url,
                                buttonLabel: 'Importer'
                            }} />
                            <DownloadCsvButton />
                        </div>
                    )}
                </div>
            </BasicSticky>

            <InfiniteScroll data="collection">
                {viewMode === 'table' ? (
                    <ProductsTable collection={collection} canEdit={canEdit} canDelete={canDelete} />
                ) : (
                    <ProductsCardsList products={collection.data} canEdit={canEdit} canDelete={canDelete} />
                )}
            </InfiniteScroll>
        </div>

    )
})

function DownloadCsvButton() {
    return (
        <a href="/admin/products/export" className="clickable inline-flex items-center border px-3 py-1 rounded text-sm">
            <UploadIcon />
        </a>
    );
}

