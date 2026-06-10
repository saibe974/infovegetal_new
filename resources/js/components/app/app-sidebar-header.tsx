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
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useSidebar } from '@/components/ui/sidebar';
import { CartContext } from '../cart/cart.context';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ProductsFilters } from '@/components/products/products-filters';
import { type Option as SearchOption } from '@/components/app/search-select';


type FilterActive = 'all' | 'active' | 'inactive';

type FiltersState = {
    active: FilterActive;
    category: number | null;
    country: string | null;
    pot: string | null;
    height: string | null;
};

type HomeFilterProps = {
    active: boolean | null;
    category: number | null;
    country?: string | null;
    pot?: string | null;
    height?: string | null;
};

const normalizeFilters = (raw?: HomeFilterProps): FiltersState => ({
    active: raw?.active === true ? 'active' : raw?.active === false ? 'inactive' : 'all',
    category: raw?.category ?? null,
    country: raw?.country ?? null,
    pot: raw?.pot ?? null,
    height: raw?.height ?? null,
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

    const removeFilter = (key: 'active' | 'category' | 'country' | 'pot' | 'height') => {
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
        }

        applyFiltersAndNavigate(nextFilters);
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
            <header
                className={
                    "top-sticky z-30 flex justify-between h-16 shrink-0 items-center gap-2 " +
                    "border-b border-sidebar-border/50 px-2 lg:px-6 transition-[width,left] ease-linear md:px-4 fixed top-0 bg-sidebar"
                }
                style={headerStyle}
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
                                    onChange={setFiltersState}
                                    onApply={applyFiltersAndNavigate}
                                    autoApply={false}
                                />
                            )}
                            filtersActive={filtersActive}
                            removeFilter={(key: string) => removeFilter(key as 'active' | 'category' | 'country' | 'pot' | 'height')}
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
                                <SidebarTrigger className="" targetId='right' icon={ShoppingCart} />
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
            </header >
            {/* </div > */}
            {/* </BasicSticky > */}
        </>
    );
}
