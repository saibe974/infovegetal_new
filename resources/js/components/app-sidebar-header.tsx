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
import { ChevronDownIcon, EllipsisVertical, Settings2Icon, SettingsIcon, ShoppingBasket, ShoppingCart, UserIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuLink, NavigationMenuList, NavigationMenuTrigger } from './ui/navigation-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu';
import BasicSticky from 'react-sticky-el';


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

    // console.log(auth)


    return (
        <>
            {/* @ts-ignore */}
            < BasicSticky stickyClassName="bg-background" className="relative z-20" >
                < header className="z-20 flex justify-between h-16 shrink-0 items-center gap-2 border-b border-sidebar-border/50 px-2 lg:px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4 sticky top-0 w-full" >

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
                                            className="inline-block rounded-sm border border-transparent px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#19140035] dark:text-[#EDEDEC] dark:hover:border-[#3E3E3A]"
                                        >
                                            {t('Log in')}
                                        </Link>
                                        <div className='w-full h-0.5 bg-black/10 dark:bg-accent' />
                                        <Link
                                            href={register()}
                                            className="inline-block rounded-sm border border-[#19140035] px-5 py-1.5 text-sm leading-normal text-[#1b1b18] hover:border-[#1915014a] dark:border-[#3E3E3A] dark:text-[#EDEDEC] dark:hover:border-[#62605b]"
                                        >
                                            {t('Register')}
                                        </Link>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                            <div>
                                <div className={''}>
                                    <Link href="/#"><ShoppingCart size={21} /></Link>
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


                            <div className='hidden lg:flex'>
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
            </BasicSticky >
        </>
    );
}
