import NavFooterExtended, { NavFooter } from '@/components/nav-footer';
import NavMain, { NavMainExtended } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarGroup,
    SidebarGroupLabel
} from '@/components/ui/sidebar';
import { contact, dashboard, documentation } from '@/routes';
import { SharedData, NavItemExtended, type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { List as ListIcon, BookOpen, Flower2Icon, FlowerIcon, Folder, FolderTreeIcon, LayoutGrid, MailIcon, ServerIcon, TagIcon, User2Icon, Info, BadgeEuro, GlobeLock, BookCheck } from 'lucide-react';
import AppLogo from './app-logo';
import products from '@/routes/products';
import productCategories from '@/routes/products-categories';
import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import { isDev, isAdmin, isClient, hasPermission } from '@/lib/roles';

import users from '@/routes/users';
import legal from '@/routes/legal';

// Items are built inside the component to access the t() helper

export function AppSidebar() {
    const page = usePage();
    // console.log(page.props);
    const { t } = useI18n();

    const { auth, locale } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;
    const canEditProducts = isAdmin(user) || hasPermission(user, 'edit products');
    const canDeleteProducts = isAdmin(user) || hasPermission(user, 'delete products');
    const canImportExportProducts = isAdmin(user) || hasPermission(user, 'import products') || hasPermission(user, 'export products');
    const canManageUsers = isAdmin(user) || hasPermission(user, 'manage users');
    const canPreview = isDev(user) || hasPermission(user, 'preview');

    // derive active state from current url/path
    const currentPath = page.props?.url ?? page.props?.current ?? '';
    const isProductsRoute = typeof currentPath === 'string' && currentPath.includes('/products');
    const [productsOpen, setProductsOpen] = useState<boolean>(isProductsRoute);

    let title: string = '';
    let mainNavItems: NavItemExtended[] = [];
    let footerNavItems: NavItemExtended[] = [];

    if (isAuthenticated) {
        // title = t('Administration');
        mainNavItems = [
            {
                title: t('Dashboard'),
                href: dashboard(),
                icon: LayoutGrid,
            },
            {
                title: t('Products'),
                href: products.index(),
                icon: Flower2Icon,
                subItems: [
                    {
                        title: t('All products'),
                        href: products.index(),
                        icon: ListIcon,
                    },
                    {
                        title: t('Categories'),
                        href: productCategories.index(),
                        icon: FolderTreeIcon,
                    },
                ],
            },
        ];

        if (canPreview) {
            //@ts-ignore
            mainNavItems[1].subItems.push({
                title: t('Tags'),
                href: '#',
                icon: TagIcon,
            });
            //@ts-ignore
            mainNavItems[1].subItems.push({
                title: t('Database'),
                href: '#',
                icon: ServerIcon,
            });
        }

        if (canManageUsers) {
            mainNavItems.push({
                title: t('Users'),
                href: users.index(),
                icon: User2Icon,
            });
        }


        footerNavItems = [
            {
                title: t('Contact'),
                href: contact(),
                icon: MailIcon,
            },
            {
                title: t('Documentation'),
                href: documentation(),
                icon: BookOpen,
                target: '_blank',
            },
            {
                title: t('Repository'),
                href: 'https://github.com/saibe974/infovegetal_new',
                icon: Folder,
                target: '_blank',
            },
            {
                title: t('Infos'),
                href: '',
                icon: Info,
                subItems: [
                    {
                        title: t('Mentions legales'),
                        href: legal.notices(),
                        icon: BookCheck,
                        target: '_blank',
                    },
                    {
                        title: t('Conditions de vente'),
                        href: legal.sale_conditions(),
                        icon: BadgeEuro,
                        target: '_blank',
                    },
                    {
                        title: t('Notre politique'),
                        href: legal.our_policy(),
                        icon: GlobeLock,
                        target: '_blank',
                    },
                ],
            }
        ];
    } else {
        mainNavItems = [
            {
                title: t('Products'),
                href: products.index(),
                icon: FlowerIcon,
            },
            {
                title: t('Contact'),
                href: contact(),
                icon: MailIcon,
            }
        ];

        footerNavItems = [
            {
                title: t('Documentation'),
                href: documentation(),
                icon: BookOpen,
            },
            {
                title: t('Infos'),
                href: '',
                icon: Info,
                subItems: [
                    {
                        title: t('Mentions legales'),
                        href: legal.notices(),
                        icon: BookCheck,
                        target: '_blank',
                    },
                    {
                        title: t('Conditions de vente'),
                        href: legal.sale_conditions(),
                        icon: BadgeEuro,
                        target: '_blank',
                    },
                    {
                        title: t('Notre politique'),
                        href: legal.our_policy(),
                        icon: GlobeLock,
                        target: '_blank',
                    },
                ],
            }
        ];
    }


    useEffect(() => {
        if (isProductsRoute) setProductsOpen(true);
    }, [isProductsRoute]);


    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMainExtended title={title} items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooterExtended items={footerNavItems} className="mt-auto" />
            </SidebarFooter>
        </Sidebar>
    );
}
