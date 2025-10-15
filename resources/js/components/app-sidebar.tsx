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
import { BookOpen, Flower2Icon, FlowerIcon, Folder, LayoutGrid } from 'lucide-react';
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
                <NavMain items={mainNavItems} />
                {/* Collapsible Products submenu */}

                <NavMainExtended />

                <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>NavMainExtended</SidebarGroupLabel>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton onClick={() => setProductsOpen((s) => !s)}>
                            {/* main label */}
                            <span className="flex items-center gap-2">
                                <Flower2Icon size={16} />
                                <span>Products</span>
                            </span>
                        </SidebarMenuButton>

                        {/* animated submenu */}
                        <div
                            className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out mt-2 ${productsOpen ? 'opacity-100' : 'opacity-0'}`}
                            style={{ maxHeight: productsOpen ? 200 : 0 }}
                        >
                            <SidebarMenuSub>
                                <SidebarMenuSubItem>
                                    <Link href={products.index()} className="flex items-center gap-2 px-2 py-1">
                                        <ListIcon size={16}/>
                                        <span>All products</span>
                                    </Link>
                                </SidebarMenuSubItem>
                                <SidebarMenuSubItem>
                                    <Link href={products.create()} className="flex items-center gap-2 px-2 py-1">
                                        <PlusCircle />
                                        <span>Create product</span>
                                    </Link>
                                </SidebarMenuSubItem>
                            </SidebarMenuSub>
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
            </SidebarFooter>
        </Sidebar>
    );
}
