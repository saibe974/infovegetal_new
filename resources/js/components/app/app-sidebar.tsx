import NavFooterExtended from '@/components/ui/nav-footer';
import { NavMainExtended } from '@/components/ui/nav-main';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { contact, dashboard, documentation } from '@/routes';
import { SharedData, NavItemExtended } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { BookOpen, Files, FlowerIcon, Folder, FolderTreeIcon, ImageOff, LayoutGrid, MailIcon, TagIcon, User2Icon, Info, BadgeEuro, GlobeLock, BookCheck, TruckIcon, ShieldCheck, Megaphone } from 'lucide-react';
import { DatabaseAccessIcon } from '@/lib/icons';
import AppLogo from './app-logo';
import products from '@/routes/products';
import categoryProducts from '@/routes/category-products';
import dbProducts from '@/routes/db-products';
import tagsProducts from '@/routes/tags-products';
import carriers from '@/routes/carriers';
import { useI18n } from '@/lib/i18n';
import { canAccessUsers, getEffectiveUser, isDev, isAdmin, hasPermission, hasAnyPermission } from '@/lib/roles';

import users from '@/routes/users';
import legal from '@/routes/legal';

// Items are built inside the component to access the t() helper

export function AppSidebar() {
    const { t } = useI18n();

    const { auth } = usePage<SharedData>().props;
    const user = auth?.user;
    const effectiveUser = getEffectiveUser(auth);
    const isImpersonating = !!auth?.impersonate_from;
    const impersonationLinkClass = isImpersonating
        ? 'text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200'
        : undefined;
    const isAuthenticated = !!user;
    const canManageUsers = canAccessUsers(effectiveUser);
    const canPreview = isDev(effectiveUser) || hasPermission(effectiveUser, 'preview');
    const canManageCategories = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'products.categories.manage');
    const canManageCarriers = isAdmin(effectiveUser) || hasAnyPermission(effectiveUser, [
        'carriers.view',
        'carriers.create',
        'carriers.update',
        'carriers.delete',
        'manage carriers',
    ]);
    const canManageMedia = isAdmin(effectiveUser);
    const canManageDbProducts = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'users.db_products.manage.all') || hasPermission(effectiveUser, 'users.db_products.manage.his');
    const canViewMissingImages = isDev(effectiveUser) || canManageDbProducts;
    const canManagePromotions = auth?.can_manage_promotions ?? false;

    const title: string = '';
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
                icon: FlowerIcon,
                subItems: []
            },
        ];

        const productsMenu = mainNavItems[1];

        if (canManageCategories && productsMenu?.subItems) {
            productsMenu.subItems.push({
                title: t('Categories'),
                href: categoryProducts.index(),
                icon: FolderTreeIcon,
            });
        }

        if (canPreview && productsMenu?.subItems) {
            productsMenu.subItems.push({
                title: t('Tags'),
                href: tagsProducts.index(),
                icon: TagIcon,
            });
        }

        if (canManageDbProducts && productsMenu?.subItems) {
            productsMenu.subItems.push({
                title: t('Database'),
                href: dbProducts.index().url,
                icon: DatabaseAccessIcon,
            });
        }

        if (canViewMissingImages && productsMenu?.subItems) {
            productsMenu.subItems.push({
                title: t('Missing images'),
                href: '/products/images',
                icon: ImageOff,
            });
        }

        if (canManageUsers) {
            const userMenu: NavItemExtended = {
                title: t('Users'),
                href: users.index(),
                icon: User2Icon,
            };

            if (isAdmin(effectiveUser) || isDev(effectiveUser)) {
                userMenu.subItems = [
                    {
                        title: t('Roles & permissions'),
                        href: '/admin/users/roles-permissions',
                        icon: ShieldCheck,
                        target: '_self',
                    },
                ];
            }

            mainNavItems.push(userMenu);
        }

        if (canManagePromotions) {
            mainNavItems.push({
                title: t('Promotions'),
                href: '/promotions',
                icon: Megaphone,
            });
        }

        if (canManageCarriers) {
            mainNavItems.push({
                title: t('Carriers'),
                href: carriers.index(),
                icon: TruckIcon,
            });
        }

        if (canManageMedia) {
            mainNavItems.push({
                title: t('Media library'),
                href: '/admin/media-manager',
                icon: Files,
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
    mainNavItems.push({ title: 'Offres et sélections', href: '/offres', icon: Megaphone });

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
