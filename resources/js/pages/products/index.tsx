import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { useEffect, useRef, useState } from 'react';
import { SharedData, type BreadcrumbItem, Product, PaginatedCollection, type ProductCategory } from '@/types';
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
import { ViewModeToggle, type ViewMode } from '@/components/ui/view-mode-toggle';
import { ProductsFilters } from '@/components/products/products-filters';
import { ButtonsActions } from '@/components/buttons-actions';
import { useCart } from '@/components/cart/use-cart';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

type FiltersState = {
    active: 'all' | 'active' | 'inactive';
    category: number | null;
    dbProductId: number | null;
};

type RawFilters = {
    active: boolean | null;
    category: number | null;
    dbProductId?: number | null;
};

type CartFilter = { cart?: string };

import { dbProduct } from '@/types';

type Props = {
    collection: PaginatedCollection<Product>;
    q: string | null;
    filters?: RawFilters;
    categories?: ProductCategory[];
    dbProducts?: dbProduct[];
};

const normalizeFilters = (raw?: RawFilters, cartFilter?: CartFilter): FiltersState & CartFilter => ({
    active: raw?.active === true ? 'active' : raw?.active === false ? 'inactive' : 'all',
    category: raw?.category ?? null,
    dbProductId: raw?.dbProductId ?? null,
    cart: cartFilter?.cart,
});


export default withAppLayout(breadcrumbs, (props: any) => {
    const uniqueCount = Array.from(new Set(props.collection.data.map((p: Product) => p.id))).length;
    return uniqueCount < props.collection.meta.total;
}, ({ collection, q, filters: incomingFilters, categories = [], dbProducts = [] }: Props) => {
    // console.log(collection)
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

    // Le panier est maintenant géré via la session côté serveur
    const location = typeof window !== 'undefined' ? window.location : { search: '' };
    const urlParams = new URLSearchParams(location.search);
    const cartParam = urlParams.get('cart') === '1';

    const [filtersState, setFiltersState] = useState<FiltersState & CartFilter>(() => normalizeFilters(incomingFilters, { cart: cartParam ? '1' : undefined }));

    // Récupérer le contexte du panier pour afficher le badge
    const { items: cartItems, clearCart } = useCart();

    useEffect(() => {
        setFiltersState(normalizeFilters(incomingFilters, { cart: cartParam ? '1' : undefined }));
    }, [incomingFilters?.active, incomingFilters?.category, incomingFilters?.dbProductId, cartParam]);

    const getCategoryName = (categoryId: number | null) => {
        const category = categories.find((cat) => cat.id === categoryId);
        return category ? category.name : null;
    }

    const filtersActive = [
        filtersState.active !== 'all' ? { name: 'active', label: filtersState.active } : null,
        filtersState.category !== null ? { name: 'category', label: getCategoryName(filtersState.category) || '' } : null,
        filtersState.dbProductId !== null ? { name: 'dbProductId', label: dbProducts.find(db => db.id === filtersState.dbProductId)?.name || '' } : null,
        filtersState.cart ? { name: 'cart', label: `Panier (${cartItems.length})` } : null,
    ].filter((item): item is { name: string; label: string } => Boolean(item && item.label));

    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window === 'undefined') return 'table';
        const views = JSON.parse(localStorage.getItem('views') || '{}');
        return (views.products || 'table') as ViewMode;
    });

    const buildQueryParams = (nextFilters: FiltersState & CartFilter, searchOverride: string | null = q ?? '') => {
        const params: Record<string, any> = {};
        const qValue = (searchOverride ?? '').trim();

        if (qValue.length > 0) {
            params.q = qValue;
        }

        if (nextFilters.active === 'active') {
            params.active = 1;
        } else if (nextFilters.active === 'inactive') {
            params.active = 0;
        }

        if (nextFilters.category) {
            params.category = nextFilters.category;
        }

        if (nextFilters.dbProductId) {
            params.dbProductId = nextFilters.dbProductId;
        }

        if (nextFilters.cart) {
            params.cart = 1;
        }

        return params;
    };

    const applyFilters = (next: FiltersState) => {
        setFiltersState(next);
        router.get(window.location.pathname, buildQueryParams(next), {
            preserveState: false,
            replace: true,
            preserveScroll: false,
        });
    };

    const removeFilter = (key: 'active' | 'category' | 'dbProductId' | 'cart') => {
        const nextFilters = { ...filtersState };
        if (key === 'active') {
            nextFilters.active = 'all';
        } else if (key === 'category') {
            nextFilters.category = null;
        } else if (key === 'dbProductId') {
            nextFilters.dbProductId = null;
        } else if (key === 'cart') {
            nextFilters.cart = undefined;
            // Seulement effacer le filtre session, pas le panier lui-même
            fetch('/products/save-cart-filter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ cart_ids: [] }),
            }).catch(err => console.error('Erreur clear cart:', err));
        }
        applyFilters(nextFilters);
    }

    const clearAllFilters = () => {
        // Effacer aussi le panier de la session et côté client
        clearCart();
        fetch('/products/save-cart-filter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({ cart_ids: [] }),
        }).catch(err => console.error('Erreur clear cart:', err));
        applyFilters({
            active: 'all',
            category: null,
            dbProductId: null,
        });
    }

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
            setSearch('');
            router.get(window.location.pathname, buildQueryParams(filtersState, null), {
                preserveState: false,
                replace: true,
                preserveScroll: false,
            });
            return;
        }

        // Otherwise ignore empty submissions
        if (trimmed.length === 0) {
            return;
        }

        setSearch('');
        // Validation: navigation complète pour réactualiser la page
        router.get(window.location.pathname, buildQueryParams(filtersState, trimmed), {
            preserveState: false,
            replace: true,
            preserveScroll: false,
        });

        // console.log("selected:", trimmed);
    };

    const uniqueCount = Array.from(new Set(collection.data.map((p: Product) => p.id))).length;

    // console.log('Debug filters:', { 
    //     filtersState, 
    //     dbProducts, 
    //     incomingFilters,
    //     filtersActive 
    // })

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
                    modes={['table', 'grid']}
                />
                {/* <div className="w-200 flex-1"> */}
                <SearchSelect
                    value={search}
                    onChange={handleSearch}
                    onSubmit={onSelect}
                    propositions={searchPropositionsState}
                    loading={fetching}
                    count={collection.meta.total}
                    query={q ?? ''}
                    filters={(
                        <ProductsFilters
                            categories={categories}
                            dbProducts={dbProducts}
                            active={filtersState.active}
                            categoryId={filtersState.category}
                            dbProductId={filtersState.dbProductId}
                            onApply={applyFilters}
                        />
                    )}
                    filtersActive={filtersActive}
                    removeFilter={(key: string) => removeFilter(key as 'active' | 'category' | 'dbProductId')}
                // clearAllFilters={clearAllFilters}
                />
                {/* </div> */}

                {canImportExport && (
                    <ButtonsActions
                        className='hidden md:flex'
                        import={
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
                        }
                        export={'/admin/products/export'}
                        add={() => { }}
                    />
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

