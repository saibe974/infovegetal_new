import { Breadcrumbs } from '@/components/app/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SharedData, type BreadcrumbItem as BreadcrumbItemType, type ProductCategory } from '@/types';
import { NavUser } from '../users/nav-user';
import { Link, router, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import { login, register } from '@/routes';
import products from '@/routes/products';
import SearchSelect from '@/components/app/search-select';
import { type CSSProperties, useContext, useRef, useState } from 'react';
import { SelectLang } from '../ui/selectLang';
import AppearanceToggleDropdown from '../appearance-dropdown';
import { ChevronDownIcon, EllipsisVertical, ShoppingCart, UserIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollHeaderVisibility } from '@/hooks/use-scroll-header-visibility';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { CartContext } from '../cart/cart.context';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ProductsFilters } from '@/components/products/products-filters';
import { type Option as SearchOption } from '@/components/app/search-select';


type FilterActive = 'all' | 'active' | 'inactive';
type ImageFilter = 'all' | 'with' | 'without';

type FiltersState = {
    active: FilterActive;
    category: number | null;
    country: string | null;
    pot: string | null;
    height: string | null;
    image: ImageFilter;
};

type HomeFilterProps = {
    active: boolean | null;
    category: number | null;
    country?: string | null;
    pot?: string | null;
    height?: string | null;
    image?: string | null;
};

const normalizeFilters = (raw?: HomeFilterProps): FiltersState => ({
    active: raw?.active === true ? 'active' : raw?.active === false ? 'inactive' : 'all',
    category: raw?.category ?? null,
    country: raw?.country ?? null,
    pot: raw?.pot ?? null,
    height: raw?.height ?? null,
    image: raw?.image === 'with' || raw?.image === 'without' ? raw.image : 'all',
});

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const page = usePage<SharedData & {
        q?: string | null;
        filters?: HomeFilterProps;
        categories?: ProductCategory[];
        categoryOptions?: number[];
        countryOptions?: string[];
        potOptions?: string[];
        heightOptions?: string[];
        collection?: { meta?: { total?: number } };
    }>();
    const { auth } = page.props;
    const currentQuery = (page.props.q ?? '').trim();
    const { t } = useI18n();
    const { isOpenId } = useSidebar(); // récupère l'état du sidebar

    const isMobile = useIsMobile();
    const isHeaderVisible = useScrollHeaderVisibility();
    const categories = page.props.categories ?? [];
    const categoryOptions = page.props.categoryOptions ?? [];
    const countryOptions = page.props.countryOptions ?? [];
    const potOptions = page.props.potOptions ?? [];
    const heightOptions = page.props.heightOptions ?? [];
    const collection = page.props.collection ?? { meta: { total: 0 } };
    const timerRef = useRef<number | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');
    const [filtersState, setFiltersState] = useState<FiltersState>(() => normalizeFilters(page.props.filters));
    const [searchPropositionsState, setSearchPropositions] = useState<Array<string | SearchOption>>([]);

    const isHomePage = page.component === 'home';
    const isCartCheckoutPage = page.url.split('?')[0] === '/cart/checkout';
    const isRightSidebarOpen = isOpenId('right');

    const { items } = useContext(CartContext);

    // calcul dynamique de la largeur du header en fonction de l'état du sidebar "main"
    const mainOpen = isOpenId('main');
    const headerWidth = !isMobile && mainOpen
        ? 'calc(100% - var(--sidebar-width))'
        : !isMobile
            ? 'calc(100% - var(--sidebar-width-icon))'
            : '100%';

    const getCategoryName = (categoryId: number | null) => {
        const category = categories.find((cat) => cat.id === categoryId);
        return category ? category.name : null;
    };

    const normalizeCountry = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return null;
        return trimmed.length === 2 ? trimmed.toUpperCase() : trimmed;
    };

    const getCountryLabel = (value: string) => {
        const normalized = normalizeCountry(value) ?? value;
        const locale = page.props.locale ?? 'fr';
        if (normalized.length === 2 && typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined') {
            const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
            return displayNames.of(normalized) ?? normalized;
        }
        return normalized;
    };

    const filtersActive = [
        filtersState.active === 'inactive' ? { name: 'active', label: filtersState.active } : null,
        filtersState.category !== null ? { name: 'category', label: getCategoryName(filtersState.category) || '' } : null,
        filtersState.country !== null
            ? {
                name: 'country',
                label: getCountryLabel(filtersState.country) || '',
                value: normalizeCountry(filtersState.country) ?? undefined,
            }
            : null,
        filtersState.pot !== null ? { name: 'pot', label: `${t('Pot')}: ${filtersState.pot}` } : null,
        filtersState.height !== null ? { name: 'height', label: `${t('Height')}: ${filtersState.height}` } : null,
        filtersState.image !== 'all' ? { name: 'image', label: t(filtersState.image === 'with' ? 'With image' : 'Without image') } : null,
    ].filter((item): item is { name: string; label: string; value?: string } => Boolean(item && item.label));

    const buildQueryParams = (nextFilters: FiltersState, searchOverride: string | null = '') => {
        const params: Record<string, string | number> = {};
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

        if (nextFilters.country) {
            params.country = nextFilters.country;
        }

        if (nextFilters.pot) {
            params.pot = nextFilters.pot;
        }

        if (nextFilters.height) {
            params.height = nextFilters.height;
        }

        if (nextFilters.image !== 'all') {
            params.image = nextFilters.image;
        }

        return params;
    };

    const navigateWithFilters = (nextFilters: FiltersState, searchOverride: string | null = currentQuery) => {
        router.visit(products.index().url, {
            method: 'get',
            data: buildQueryParams(nextFilters, searchOverride),
            preserveScroll: false,
        });
    };

    const applyFiltersAndNavigate = (nextFilters: FiltersState) => {
        setFiltersState(nextFilters);
        navigateWithFilters(nextFilters);
    };

    const removeFilter = (key: 'active' | 'category' | 'country' | 'pot' | 'height' | 'image') => {
        const nextFilters = { ...filtersState };

        if (key === 'active') {
            nextFilters.active = 'all';
        } else if (key === 'category') {
            nextFilters.category = null;
        } else if (key === 'country') {
            nextFilters.country = null;
        } else if (key === 'pot') {
            nextFilters.pot = null;
        } else if (key === 'height') {
            nextFilters.height = null;
        } else if (key === 'image') {
            nextFilters.image = 'all';
        }

        applyFiltersAndNavigate(nextFilters);
    };

    const clearAllFilters = () => {
        const nextFilters: FiltersState = {
            active: 'all',
            category: null,
            country: null,
            pot: null,
            height: null,
            image: 'all',
        };

        setSearch('');
        setFiltersState(nextFilters);
        navigateWithFilters(nextFilters, null);
    };

    const handleSearch = (s: string) => {
        setSearch(s);

        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        router.cancelAll();

        if (s.length < 2) {
            setFetching(false);
            return;
        }

        setFetching(true);

        timerRef.current = window.setTimeout(async () => {
            try {
                const res = await fetch(`/search-propositions?context=products&q=${encodeURIComponent(s)}&limit=10`);
                const json = await res.json();
                setSearchPropositions((json.propositions || []) as Array<string | SearchOption>);
            } finally {
                setFetching(false);
            }
        }, 300);
    };

    const onSelect = (mysearch: string, options?: { force?: boolean }) => {
        const trimmed = (mysearch ?? '').trim();

        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        router.cancelAll();

        if (options?.force && trimmed.length === 0) {
            setSearch('');
            setFetching(false);
            navigateWithFilters(filtersState, null);
            return;
        }

        if (trimmed.length === 0) {
            return;
        }

        setFetching(false);
        navigateWithFilters(filtersState, trimmed);

    };

    const headerStyle: CSSProperties & { '--app-header-height': string } = {
        width: headerWidth,
        '--app-header-height': '64px',
    };

    return (
        <>
            <div
                className={cn(
                    'top-sticky fixed top-0 z-30 overflow-visible transition-[width,left,height] duration-200 ease-out motion-reduce:transition-none',
                    isHeaderVisible ? 'h-16' : 'h-0',
                )}
                style={headerStyle}
            >
                <header
                    className={cn(
                        'absolute top-0 left-0 flex h-16 w-full shrink-0 items-center justify-between gap-2 border-b border-sidebar-border/50 bg-sidebar px-2 transition-transform duration-200 ease-out md:px-4 lg:px-6 motion-reduce:transition-none',
                        isHeaderVisible
                            ? 'translate-y-0'
                            : '-translate-y-full',
                    )}
                >

                <div className='flex items-center gap-2'>
                    <SidebarTrigger className="-ml-1" targetId='main' />
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                </div>

                {isHomePage && (
                    <div className='hidden md:block md:w-3xl'>
                        <SearchSelect
                            value={search}
                            onChange={handleSearch}
                            onSubmit={onSelect}
                            propositions={searchPropositionsState}
                            loading={fetching}
                            count={collection?.meta?.total ?? 0}
                            query={''}
                            search={true}
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
                                    onChange={setFiltersState}
                                    onApply={applyFiltersAndNavigate}
                                    autoApply={false}
                                />
                            )}
                            filtersActive={filtersActive}
                            removeFilter={(key: string) => removeFilter(key as 'active' | 'category' | 'country' | 'pot' | 'height' | 'image')}
                            clearAll={clearAllFilters}
                        />
                    </div>
                )}

                <div className=''>
                    <div className="w-full flex items-center justify-between gap-6">
                        {/* <div className='flex items-center gap-2'> */}
                        {auth.user ? (
                            // <NavigationMenuItem className=''>
                            <NavUser />
                            // </NavigationMenuItem>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger className='flex items-center'>
                                    <UserIcon />
                                    <ChevronDownIcon className="size-5 opacity-100 md:hidden" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className='flex flex-col items-start gap-2 p-4'>
                                    <Link
                                        href={login()}
                                        className="inline-block rounded-sm border border-transparent px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#19140035] dark:text-[#EDEDEC] dark:hover:border-[#3E3E3A] w-full text-center"
                                    >
                                        {t('Log in')}
                                    </Link>
                                    <div className='w-full h-0.5 bg-black/10 dark:bg-accent' />
                                    <Link
                                        href={register()}
                                        className="inline-block rounded-sm border border-transparent px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#19140035] dark:text-[#EDEDEC] dark:hover:border-[#3E3E3A] w-full text-center"
                                    >
                                        {t('Register')}
                                    </Link>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        <div>
                            <div className="w-full flex items-center justify-between gap-4 relative">
                                {isCartCheckoutPage ? (
                                    <button
                                        type="button"
                                        aria-disabled="true"
                                        tabIndex={-1}
                                        className="flex items-center justify-center rounded-md p-1.5 bg-accent text-accent-foreground cursor-default"
                                    >
                                        <ShoppingCart className="size-5" />
                                    </button>
                                ) : (
                                    <SidebarTrigger
                                        className={cn(isRightSidebarOpen && 'bg-accent text-accent-foreground')}
                                        targetId='right'
                                        icon={ShoppingCart}
                                    />
                                )}
                                <Badge
                                    // variant={"destructive"}
                                    className={cn(
                                        "absolute -top-1 -right-1 text-xs bg-red-600 text-white font-extralight size-4",
                                        items.length > 9 ? " px-2" : " px-1.5",
                                        items.length === 0 && "hidden"
                                    )}
                                >
                                    {items.length}
                                </Badge>
                            </div>
                        </div>


                        <div className='lg:hidden'>
                            <DropdownMenu>
                                <DropdownMenuTrigger className='flex items-center'>
                                    <EllipsisVertical />
                                    {/* <ChevronDownIcon className="size-5 opacity-100 md:hidden" /> */}
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className='flex flex-col items-center gap-2 p-4'>
                                    <SelectLang />
                                    <div className='w-full h-0.5 bg-black/10 dark:bg-accent' />
                                    <AppearanceToggleDropdown />
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>


                        <div className='hidden lg:flex gap-2 pl-2'>
                            {/* <NavigationMenuTrigger><SettingsIcon /></NavigationMenuTrigger> */}
                            {/* <NavigationMenuContent className=''> */}
                            <SelectLang />
                            <AppearanceToggleDropdown />
                            {/* </NavigationMenuContent> */}
                        </div>

                        {/* </div> */}
                    </div>
                </div>
                </header>
            </div>
            {/* </div > */}
            {/* </BasicSticky > */}
        </>
    );
}
