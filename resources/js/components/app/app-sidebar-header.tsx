import { Breadcrumbs } from '@/components/app/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SharedData, type BreadcrumbItem as BreadcrumbItemType } from '@/types';
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



export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const page = usePage<SharedData & { searchPropositions?: string[]; collection?: { meta?: { total?: number } } }>();
    const { auth } = page.props;
    const { t } = useI18n();
    const { isOpenId } = useSidebar(); // récupère l'état du sidebar

    const isMobile = useIsMobile();
    const searchPropositions = page.props.searchPropositions ?? [];
    const collection = page.props.collection ?? { meta: { total: 0 } };
    const timerRef = useRef<number | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const isHomePage = page.component === 'home';

    const { items } = useContext(CartContext);

    // calcul dynamique de la largeur du header en fonction de l'état du sidebar "main"
    const mainOpen = isOpenId('main');
    const headerWidth = !isMobile && mainOpen
        ? 'calc(100% - var(--sidebar-width))'
        : !isMobile
            ? 'calc(100% - var(--sidebar-width-icon))'
            : '100%';

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

        timerRef.current = window.setTimeout(() => {
            router.reload({
                only: ['searchPropositions'],
                data: { q: s },
                onSuccess: () => setFetching(false),
            });
        }, 300);
    };

    const onSelect = (mysearch: string) => {
        const trimmed = (mysearch ?? '').trim();

        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        router.cancelAll();

        // if (options?.force && trimmed.length === 0) {
        //     setSearch('');
        //     setFetching(false);
        //     router.visit(products.index().url, {
        //         method: 'get',
        //         replace: true,
        //         preserveScroll: false,
        //     });
        //     return;
        // }

        if (trimmed.length === 0) {
            return;
        }

        setFetching(false);
        router.visit(products.index().url, {
            method: 'get',
            data: { q: trimmed },
            preserveScroll: false,
        });

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
                            propositions={searchPropositions}
                            loading={fetching}
                            count={collection?.meta?.total ?? 0}
                            query={''}
                            search={true}
                        // filters={(
                        //     <ProductsFilters
                        //         categories={[]}
                        //         active={'all'}
                        //         categoryId={1}
                        //         onApply={() => { }}
                        //     />
                        // )}
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
