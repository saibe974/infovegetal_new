import NavFooterExtended, { NavFooter } from '@/components/ui/nav-footer';
import NavMain, { NavMainExtended } from '@/components/ui/nav-main';
import { NavUser } from '@/components/users/nav-user';
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
import { List as ListIcon, BookOpen, Flower2Icon, FlowerIcon, Folder, FolderTreeIcon, LayoutGrid, MailIcon, ServerIcon, TagIcon, User2Icon, Info, BadgeEuro, GlobeLock, BookCheck, TruckIcon, ImageIcon } from 'lucide-react';
import AppLogo from './app-logo';
import products from '@/routes/products';
import categoryProducts from '@/routes/category-products';
import dbProducts from '@/routes/db-products';
import tagsProducts from '@/routes/tags-products';
import carriers from '@/routes/carriers';
import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import { getEffectiveUser, isDev, isAdmin, isClient, hasPermission } from '@/lib/roles';

import users from '@/routes/users';
import legal from '@/routes/legal';

// Items are built inside the component to access the t() helper

export function AppSidebar() {
    const page = usePage();
    // console.log(page.props);
    const { t } = useI18n();

    const { auth, locale } = usePage<SharedData>().props;
    const user = auth?.user;
    const effectiveUser = getEffectiveUser(auth);
    const isImpersonating = !!auth?.impersonate_from;
    const impersonationLinkClass = isImpersonating
        ? 'text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200'
        : undefined;
    const isAuthenticated = !!user;
    const canEditProducts = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'edit products');
    const canDeleteProducts = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'delete products');
    const canImportExportProducts = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'import products') || hasPermission(effectiveUser, 'export products');
    const canManageUsers = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'manage users');
    const canPreview = isDev(effectiveUser) || hasPermission(effectiveUser, 'preview');
    const canManageCategories = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'manage categories');
    const canManageCarriers = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'manage carriers');
    const canManageMedia = isAdmin(effectiveUser);

    // derive active state from current url/path
    const currentPath = page.props?.url ?? page.props?.current ?? '';
    const isProductsRoute = typeof currentPath === 'string' && currentPath.includes('/products');
    const [productsOpen, setProductsOpen] = useState<boolean>(isProductsRoute);

    let title: string = '';
    let mainNavItems: NavItemExtended[] = [];
    let footerNavItems: NavItemExtended[] = [];

    const legalRoutes = {
        title: t('Infos'),
        href: '',
        icon: Info,
        subItems: [
            {
                title: t('Mentions legales'),
                href: legal.notices(),
                icon: BookCheck,
                target: '_self',
            },
            {
                title: t('Conditions de vente'),
                href: legal.sale_conditions(),
                icon: BadgeEuro,
                target: '_self',
            },
            {
                title: t('Notre politique'),
                href: legal.our_policy(),
                icon: GlobeLock,
                target: '_self',
            },
        ],
    }

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
                subItems: []
            },
        ];

        if (canManageCategories) {
            //@ts-ignore
            mainNavItems[1].subItems.push({
                title: t('Categories'),
                href: categoryProducts.index(),
                icon: FolderTreeIcon,
            });
        }

        if (canPreview) {
            //@ts-ignore
            mainNavItems[1].subItems.push({
                title: t('Tags'),
                href: tagsProducts.index(),
                icon: TagIcon,
            });
            //@ts-ignore
            mainNavItems[1].subItems.push({
                title: t('Database'),
                href: dbProducts.index().url,
                icon: ServerIcon,
            });
        }

        if (canManageMedia) {
            //@ts-ignore
            mainNavItems[1].subItems.push({
                title: t('Media library'),
                href: '/admin/media-manager',
                icon: ImageIcon,
                target: '_self',
            });
        }

        if (canManageUsers) {
            mainNavItems.push({
                title: t('Users'),
                href: users.index(),
                icon: User2Icon,
            });
        }

        if (canManageCarriers) {
            mainNavItems.push({
                title: t('Carriers'),
                href: carriers.index(),
                icon: TruckIcon,
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
                target: '_self',
            },
            {
                title: t('Repository'),
                href: 'https://github.com/saibe974/infovegetal_new',
                icon: Folder,
                target: '_blank',
            },
            legalRoutes,
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
            legalRoutes,
        ];
    }


    useEffect(() => {
        if (isProductsRoute) setProductsOpen(true);
    }, [isProductsRoute]);


    return (
        <Sidebar collapsible="icon" variant="inset" id='main'>
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/" prefetch className='no-underline'>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMainExtended title={title} items={mainNavItems} menuButtonClassName={impersonationLinkClass} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooterExtended items={footerNavItems} className="mt-auto" menuButtonClassName={impersonationLinkClass} />
            </SidebarFooter>
        </Sidebar>
    );
}
