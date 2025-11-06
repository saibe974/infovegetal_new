import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { SharedData, type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { NavUser } from './nav-user';
import { Link, router, usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import { dashboard, login, register } from '@/routes';
import SearchSoham from './ui/searchSoham';
import { useRef, useState } from 'react';
import { SelectWithItems } from './ui/select-with-items';
import { SelectLang } from './ui/selectLang';
import AppearanceToggleDropdown from './appearance-dropdown';
import { SettingsIcon, ShoppingBasket, ShoppingCart, UserIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from './ui/navigation-menu';


export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { auth, locale } = usePage<SharedData>().props;
    const { t } = useI18n();

    const isMobile = useIsMobile()

    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

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

    console.log(auth)

    return (
        <header className="z-20 flex justify-between h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/50 px-2 lg:px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4 sticky top-0 w-full">

            <div className='flex items-center gap-2'>
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>


            <div className='hidden md:block md:w-3xl'>
                <SearchSoham
                    value={search}
                    onChange={handleSearch}
                    onSubmit={onSelect}
                    propositions={searchPropositions}
                    loading={fetching}
                    count={100}
                    query={''}
                />
            </div>
            <NavigationMenu viewport={isMobile} className=''>
                <NavigationMenuList className="w-full flex items-center justify-between gap-2">
                    {/* <div className='flex items-center gap-2'> */}
                    {auth.user ? (
                        <NavigationMenuItem className=''>
                            <NavUser />
                        </NavigationMenuItem>
                    ) : (
                        <NavigationMenuItem className=''>
                            <NavigationMenuTrigger className=''><UserIcon /></NavigationMenuTrigger>
                            <NavigationMenuContent className=''>
                                <Link
                                    href={login()}
                                    className="inline-block rounded-sm border border-transparent px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#19140035] dark:text-[#EDEDEC] dark:hover:border-[#3E3E3A]"
                                >
                                    {t('Log in')}
                                </Link>
                                <Link
                                    href={register()}
                                    className="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                                >
                                    {t('Register')}
                                </Link>
                            </NavigationMenuContent>
                        </NavigationMenuItem>
                    )}
                    <NavigationMenuItem>
                        <NavigationMenuLink asChild className={''}>
                            <Link href="/#"><ShoppingCart size={19} /></Link>
                        </NavigationMenuLink>
                    </NavigationMenuItem>

                    <NavigationMenuItem className='md:hidden'>
                        <NavigationMenuTrigger><SettingsIcon /></NavigationMenuTrigger>
                        <NavigationMenuContent className=''>
                            <SelectLang />
                            <AppearanceToggleDropdown />
                        </NavigationMenuContent>
                    </NavigationMenuItem>

                    <NavigationMenuItem className='hidden md:flex'>
                        {/* <NavigationMenuTrigger><SettingsIcon /></NavigationMenuTrigger> */}
                        {/* <NavigationMenuContent className=''> */}
                        <SelectLang />
                        <AppearanceToggleDropdown />
                        {/* </NavigationMenuContent> */}
                    </NavigationMenuItem>

                    {/* </div> */}
                </NavigationMenuList>
            </NavigationMenu>
        </header>
    );
}
