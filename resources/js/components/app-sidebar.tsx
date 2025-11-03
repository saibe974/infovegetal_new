import { NavFooter } from '@/components/nav-footer';
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
import { dashboard } from '@/routes';
import { NavItemExtended, type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { BookOpen, Flower2Icon, FlowerIcon, Folder, FolderTreeIcon, LayoutGrid, TagIcon } from 'lucide-react';
import AppLogo from './app-logo';
import products from '@/routes/products';
import productCategories from '@/routes/products-categories';
import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

import { PlusCircle, List as ListIcon } from 'lucide-react';

// Items are built inside the component to access the t() helper

export function AppSidebar() {
    const page = usePage();
    const { t } = useI18n();
    // derive active state from current url/path
    const currentPath = page.props?.url ?? page.props?.current ?? '';
    const isProductsRoute = typeof currentPath === 'string' && currentPath.includes('/products');
    const [productsOpen, setProductsOpen] = useState<boolean>(isProductsRoute);
    const mainNavItems: NavItemExtended[] = [
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
                {
                    title: t('Tags'),
                    href: '#',
                    icon: TagIcon,
                },
            ],
        },
    ];

    const footerNavItems: NavItem[] = [
        {
            title: t('Repository'),
            href: 'https://github.com/saibe974/infovegetal_new',
            icon: Folder,
        },
        {
            title: t('Documentation'),
            href: 'https://laravel.com/docs/starter-kits#react',
            icon: BookOpen,
        },
    ];

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
                <NavMainExtended title={t('Administration')} items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
            </SidebarFooter>
        </Sidebar>
    );
}
