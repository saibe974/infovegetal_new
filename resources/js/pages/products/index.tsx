import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { useEffect, useRef, useState } from 'react';
import { SharedData, type BreadcrumbItem, Product, PaginatedCollection, type ProductCategory } from '@/types';
import { InfiniteScroll, usePage, router, Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Loader2Icon } from 'lucide-react';
import SearchSelect, { type Option as SearchOption } from '@/components/app/search-select';
import { DialogUpload } from '@/components/dialog-upload';
import { getEffectiveUser, isAdmin, hasPermission } from '@/lib/roles';
import ProductsTable from '@/components/products/products-table';
import { ProductsCardsList } from '@/components/products/products-cards-list';
import { ProductsSmallCardsList } from '@/components/products/products-small-cards-list';
import ProductsImportTreatment from '@/components/products/import';
import { useI18n } from '@/lib/i18n';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ViewModeToggle, type ViewMode } from '@/components/ui/view-mode-toggle';
import { ProductsFilters } from '@/components/products/products-filters';
import ProductDetails from '@/components/products/product-details';
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
    country: string[];
    pot: string[];
    height: string[];
    image: 'all' | 'with' | 'without';
    promo: boolean;
};

type RawFilters = {
    active: boolean | null;
    category: number | null;
    country?: string[] | string | null;
    pot?: string[] | string | null;
    height?: string[] | string | null;
    image?: string | null;
    promo?: boolean | null;
};

type CartFilter = { cart?: string };

import { dbProduct } from '@/types';

type Props = {
    collection: PaginatedCollection<Product>;
    q: string | null;
    filters?: RawFilters;
    categories?: ProductCategory[];
    dbProducts?: dbProduct[];
    categoryOptions?: number[];
    countryOptions?: string[];
    potOptions?: string[];
    heightOptions?: string[];
};

const normalizeMultiFilter = (value?: string[] | string | null): string[] => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
};

const normalizeFilters = (raw?: RawFilters, cartFilter?: CartFilter): FiltersState & CartFilter => ({
    active: raw?.active === true ? 'active' : raw?.active === false ? 'inactive' : 'all',
    category: raw?.category ?? null,
    country: normalizeMultiFilter(raw?.country),
    pot: normalizeMultiFilter(raw?.pot),
    height: normalizeMultiFilter(raw?.height),
    image: raw?.image === 'with' || raw?.image === 'without' ? raw.image : 'all',
    promo: raw?.promo === true,
    cart: cartFilter?.cart,
});


export default withAppLayout(breadcrumbs, (props: Props) => {
    const uniqueCount = Array.from(new Set(props.collection.data.map((p: Product) => p.id))).length;
    return uniqueCount < props.collection.meta.total;
}, ({ collection, q, filters: incomingFilters, categories = [], categoryOptions = [], countryOptions = [], potOptions = [], heightOptions = [] }: Props) => {
    // console.log(collection)
    const { t } = useI18n();
    const { auth, locale } = usePage<SharedData>().props;
    const effectiveUser = getEffectiveUser(auth);
    const canEdit = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'edit products');
    const canDelete = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'delete products');
    const canImportExport = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'import products') || hasPermission(effectiveUser, 'export products');

    const page = usePage<{ searchPropositions?: Array<string | SearchOption> }>();
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
    const { items: cartItems } = useCart();

    useEffect(() => {
        setFiltersState(normalizeFilters(incomingFilters, { cart: cartParam ? '1' : undefined }));
    }, [incomingFilters, cartParam]);

    const getCategoryName = (categoryId: number | null) => {
        const category = categories.find((cat) => cat.id === categoryId);
        return category ? category.name : null;
    }

    const normalizeCountry = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return null;
        return trimmed.length === 2 ? trimmed.toUpperCase() : trimmed;
    };

    const getCountryLabel = (value: string) => {
        const normalized = normalizeCountry(value) ?? value;
        if (normalized.length === 2 && typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined') {
            const displayNames = new Intl.DisplayNames([locale ?? 'fr'], { type: 'region' });
            return displayNames.of(normalized) ?? normalized;
        }
        return normalized;
    };

    const categoryChoices = categoryOptions.length > 0
        ? categories.filter((category) => categoryOptions.includes(category.id))
        : categories;
    const countries = Array.from(
        new Set(
            countryOptions
                .map((value) => normalizeCountry(value))
                .filter((value): value is string => Boolean(value))
        )
    ).sort((a, b) => a.localeCompare(b));
    const singleCategory = categoryChoices.length === 1 ? categoryChoices[0] : null;
    const singleCountry = countries.length === 1 ? countries[0] : null;
    const singlePot = potOptions.length === 1 ? potOptions[0] : null;
    const singleHeight = heightOptions.length === 1 ? heightOptions[0] : null;
    const singleFilters = [
        singleCategory && filtersState.category === null
            ? { name: 'category', label: singleCategory.name }
            : null,
        singleCountry && filtersState.country.length === 0
            ? { name: 'country', label: getCountryLabel(singleCountry), country: singleCountry }
            : null,
        singlePot && filtersState.pot.length === 0
            ? { name: 'pot', label: String(singlePot), title: `${t('Pot diameter')}: ${singlePot}` }
            : null,
        singleHeight && filtersState.height.length === 0
            ? { name: 'height', label: String(singleHeight), title: `${t('Height')}: ${singleHeight}` }
            : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    const filtersActive = [
        filtersState.image !== 'all'
            ? {
                name: 'image',
                label: t(filtersState.image === 'with' ? 'With image' : 'Without image'),
                value: filtersState.image,
            }
            : null,
        filtersState.promo
            ? { name: 'promo', label: t('PROMO') }
            : null,
        filtersState.active === 'inactive' ? { name: 'active', label: filtersState.active } : null,
        filtersState.category !== null ? { name: 'category', label: getCategoryName(filtersState.category) || '' } : null,
        filtersState.country.length > 0
            ? {
                name: 'country',
                label: filtersState.country.map(getCountryLabel).join(', '),
                values: filtersState.country.map((value) => normalizeCountry(value) ?? value),
            }
            : null,
        filtersState.pot.length > 0
            ? { name: 'pot', label: `${t('Pot diameter')}: ${filtersState.pot.join(', ')}`, values: filtersState.pot }
            : null,
        filtersState.height.length > 0
            ? { name: 'height', label: `${t('Height')}: ${filtersState.height.join(', ')}`, values: filtersState.height }
            : null,
        filtersState.cart ? { name: 'cart', label: `Panier (${cartItems.length})` } : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item?.label));

    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window === 'undefined') return 'table';
        const views = JSON.parse(localStorage.getItem('views') || '{}');
        return (views.products || 'table') as ViewMode;
    });

    const buildQueryParams = (nextFilters: FiltersState & CartFilter, searchOverride: string | null = q ?? '') => {
        const params: Record<string, string | number | string[]> = {};
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

        if (nextFilters.country.length > 0) {
            params.country = nextFilters.country;
        }

        if (nextFilters.pot.length > 0) {
            params.pot = nextFilters.pot;
        }

        if (nextFilters.height.length > 0) {
            params.height = nextFilters.height;
        }

        if (nextFilters.image !== 'all') {
            params.image = nextFilters.image;
        }

        if (nextFilters.promo) {
            params.promo = 1;
        }

        if (nextFilters.cart) {
            params.cart = 1;
        }

        return params;
    };

    const applyFilters = (next: FiltersState & CartFilter) => {
        const mergedFilters = {
            ...next,
            cart: Object.prototype.hasOwnProperty.call(next, 'cart') ? next.cart : filtersState.cart,
        };

        setFiltersState(mergedFilters);
        router.get(window.location.pathname, buildQueryParams(mergedFilters), {
            preserveState: false,
            replace: true,
            preserveScroll: false,
        });
    };

    const removeFilter = (key: 'active' | 'category' | 'country' | 'pot' | 'height' | 'image' | 'promo' | 'cart') => {
        const nextFilters = { ...filtersState };
        if (key === 'active') {
            nextFilters.active = 'all';
        } else if (key === 'category') {
            nextFilters.category = null;
        } else if (key === 'country') {
            nextFilters.country = [];
        } else if (key === 'pot') {
            nextFilters.pot = [];
        } else if (key === 'height') {
            nextFilters.height = [];
        } else if (key === 'image') {
            nextFilters.image = 'all';
        } else if (key === 'promo') {
            nextFilters.promo = false;
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
        const nextFilters: FiltersState & CartFilter = {
            active: 'all',
            category: null,
            country: [],
            pot: [],
            height: [],
            image: 'all',
            promo: false,
            cart: undefined,
        };

        setSearch('');
        setFiltersState(nextFilters);

        if (filtersState.cart) {
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

        router.get(window.location.pathname, buildQueryParams(nextFilters, null), {
            preserveState: false,
            replace: true,
            preserveScroll: false,
        });
    };

    // Local state for client-fetched propositions to avoid Inertia refresh
    const [searchPropositionsState, setSearchPropositions] = useState<Array<string | SearchOption>>(searchPropositions ?? []);

    const handleSearch = (s: string) => {
        setSearch(s);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        if (s.length < 2) {
            return;
        }
        router.cancelAll();
        setFetching(true);
        timerRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/search-propositions?context=products&q=${encodeURIComponent(s)}&limit=10`);
                const json = await res.json();
                setSearchPropositions((json.propositions || []) as Array<string | SearchOption>);
            } finally {
                setFetching(false);
            }
        }, 300);
    }

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

    const handleSelectOption = (option: SearchOption) => {
        if (option.kind !== 'category' || typeof option.id !== 'number') {
            return false;
        }

        setSearch('');
        applyFilters({
            ...filtersState,
            category: option.id,
        });

        return true;
    };

    const uniqueCount = Array.from(new Set(collection.data.map((p: Product) => p.id))).length;

    // console.log('Debug filters:', { 
    //     filtersState, 
    //     dbProducts, 
    //     incomingFilters,
    //     filtersActive 
    // })

    const uniqueProducts = Array.from(new Map(collection.data.map((p) => [p.id, p])).values());
    const singleProduct = uniqueProducts.length === 1 ? uniqueProducts[0] : null;

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
                    modes={['table', 'list', 'grid']}
                    mobileMenuModes={['list', 'grid']}
                />
                {/* <div className="w-200 flex-1"> */}
                <SearchSelect
                    className='w-auto flex-1'
                    value={search}
                    onChange={handleSearch}
                    onSubmit={onSelect}
                    onSelectOption={handleSelectOption}
                    propositions={searchPropositionsState}
                    loading={fetching}
                    count={collection.meta.total}
                    compactMobile
                    query={q ?? ''}
                    fixedFilters={singleFilters}
                    filters={(
                        <ProductsFilters
                            categories={categories}
                            categoryOptions={categoryOptions}
                            countryOptions={countryOptions}
                            potOptions={potOptions}
                            heightOptions={heightOptions}
                            active={filtersState.active}
                            categoryId={filtersState.category}
                            country={filtersState.country}
                            pot={filtersState.pot}
                            height={filtersState.height}
                            image={filtersState.image}
                            promo={filtersState.promo}
                            onApply={applyFilters}
                        />
                    )}
                    filtersActive={filtersActive}
                    removeFilter={(key: string) => removeFilter(key as 'active' | 'category' | 'country' | 'pot' | 'height' | 'image' | 'promo' | 'cart')}
                    clearAll={clearAllFilters}
                />
                {/* </div> */}

                {canImportExport && (
                    <ButtonsActions
                        className='hidden md:flex'
                        import={
                            <DialogUpload
                                title='Upload'
                                description='Uploadez un fichier'
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
            ) : singleProduct ? (
                <ProductDetails product={singleProduct} showBackLink={false} />
            ) :
                <InfiniteScroll data="collection" buffer={600} className=''>
                    {viewMode === 'table' ? (
                        <ProductsTable
                            collection={{
                                ...collection,
                                data: uniqueProducts,
                            }}
                            canEdit={canEdit}
                            canDelete={canDelete}
                        />
                    ) : viewMode === 'list' ? (
                        <ProductsSmallCardsList
                            products={uniqueProducts}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            showStatusBadge={filtersState.active !== 'active'}
                        />
                    ) : (
                        <ProductsCardsList
                            products={uniqueProducts}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            showStatusBadge={filtersState.active !== 'active'}
                        />
                    )}
                </InfiniteScroll>
            }

            {singleProduct === null && uniqueCount < collection.meta.total &&
                <div className='w-full h-50 flex items-center justify-center mt-4'>
                    <Loader2Icon size={50} className='animate-spin text-brand-main' />
                </div>
            }
        </>

    )
})
