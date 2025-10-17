import { NavFooter } from '@/components/nav-footer';
import  NavMain, { NavMainExtended }  from '@/components/nav-main';
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
import { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';

import { PlusCircle, List as ListIcon } from 'lucide-react';

const mainNavItems: NavItemExtended[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Products',
        href: products.index(),
        icon: Flower2Icon,
        subItems: [
            {
                title: 'All products',
                href: products.index(),
                icon: ListIcon,
            },
            {
                title: 'Categories',
                href: '#',
                icon: FolderTreeIcon,
            },
            {
                title: 'Tags',
                href: '#',
                icon: TagIcon
            },
            {
                title: 'Create product',
                href: products.create(),
                icon: PlusCircle,
            },
        ]
    },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Repository',
        href: 'https://github.com/saibe974/infovegetal_new',
        icon: Folder,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits#react',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    const page = usePage();
    // derive active state from current url/path
    const currentPath = page.props?.url ?? page.props?.current ?? '';
    const isProductsRoute = typeof currentPath === 'string' && currentPath.includes('/products');
    const [productsOpen, setProductsOpen] = useState<boolean>(isProductsRoute);

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
                {/* <NavMain items={mainNavItems} /> */}

                <NavMainExtended title="Administration" items={mainNavItems}/>
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
            </SidebarFooter>
        </Sidebar>
    );
}
