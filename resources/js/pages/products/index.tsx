import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { useEffect, useRef, useState } from 'react';
import { SharedData, type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router, Head } from '@inertiajs/react';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UploadIcon, EditIcon, TrashIcon, LoaderIcon, Loader2Icon } from 'lucide-react';
import SearchSelect from '@/components/app/search-select';
import { CsvUploadFilePond } from '@/components/csv-upload-filepond';
import { isAdmin, isClient, hasPermission } from '@/lib/roles';
import ProductsTable from '@/components/products/products-table';
import { ProductsCardsList } from '@/components/products/products-cards-list';
import { useSidebar } from '@/components/ui/sidebar';
import ProductsImportTreatment from '@/components/products/import';
import { useI18n } from '@/lib/i18n';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';

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


export default withAppLayout(breadcrumbs, (props: any) => {
    const uniqueCount = Array.from(new Set(props.collection.data.map((p: Product) => p.id))).length;
    return uniqueCount < props.collection.meta.total;
}, ({ collection, q }: Props) => {
    console.log(collection)
    const { t } = useI18n();
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

    const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
        if (typeof window === 'undefined') return 'table';
        const views = JSON.parse(localStorage.getItem('views') || '{}');
        return views.products === 'grid' ? 'grid' : 'table';
    });

    // Contrôle "voir plus": devient false en bas de page ou si dernière page
    const [seeMore, setSeeMore] = useState(true);
    useEffect(() => {
        const onScroll = () => {
            const threshold = 200;
            const scrolled = window.scrollY + window.innerHeight;
            const total = document.documentElement.scrollHeight;
            const isNearBottom = scrolled >= total - threshold;
            if (isNearBottom || collection.meta.current_page >= collection.meta.last_page) {
                setSeeMore(false);
            }
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [collection.meta.current_page, collection.meta.last_page]);


    // Local state for client-fetched propositions to avoid Inertia refresh
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
                const res = await fetch(`/search-propositions?context=products&q=${encodeURIComponent(s)}&limit=10`);
                const json = await res.json();
                setSearchPropositions((json.propositions || []) as string[]);
            } finally {
                setFetching(false);
            }
        }, 300);
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
        // Validation: navigation complète pour réactualiser la page
        router.get(window.location.pathname, { q: trimmed }, {
            preserveState: false,
            replace: true,
            preserveScroll: false,
        });

        // console.log("selected:", trimmed);
    };

    // console.log(collection);
    const uniqueCount = Array.from(new Set(collection.data.map((p: Product) => p.id))).length;

    return (
        <>
            <Head title="Products" />
            <StickyBar
                className='header-search z-25 mb-4'
            >
                <ViewModeToggle
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    pageKey="products"
                />
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
                            postTreatmentComponent={ProductsImportTreatment}
                            successRedirectUrl={products.index().url}
                            buttonLabel=''
                        />
                        <DownloadCsvButton />
                    </div>
                )}
            </StickyBar>

            {collection.data.length === 0 ? (
                <div className='w-full flex flex-col items-center justify-center gap-4'>
                    {q ? (
                        <>
                            <p className='text-lg'>{t('Aucun produit ne correspond à votre recherche.')}</p>
                            <Button
                                variant='secondary'
                                onClick={() => router.visit(products.index().url)}
                            >
                                {t('Réinitialiser la recherche')}
                            </Button>
                        </>
                    ) : (
                        <p className='text-lg'>{t('Aucun produit disponible.')}</p>
                    )}
                </div>
            ) :
                <InfiniteScroll data="collection" className=''>
                    {viewMode === 'table' ? (
                        <ProductsTable
                            collection={{
                                ...collection,
                                data: Array.from(new Map(collection.data.map((p) => [p.id, p])).values()),
                            }}
                            canEdit={canEdit}
                            canDelete={canDelete}
                        />
                    ) : (
                        <ProductsCardsList
                            products={Array.from(new Map(collection.data.map((p) => [p.id, p])).values())}
                            canEdit={canEdit}
                            canDelete={canDelete}
                        />
                    )}
                </InfiniteScroll>
            }

            {uniqueCount < collection.meta.total &&
                <div className='w-full h-50 flex items-center justify-center mt-4'>
                    <Loader2Icon size={50} className='animate-spin text-main-purple dark:text-main-green' />
                </div>
            }
        </>

    )
})

function DownloadCsvButton() {
    return (
        <a href="/admin/products/export" className="clickable inline-flex items-center border px-3 py-1 rounded text-sm" title='Export CSV'>
            <UploadIcon />
        </a>
    );
}

