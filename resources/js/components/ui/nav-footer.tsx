import { Icon } from '@/components/icon';
import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    useSidebar,
} from '@/components/ui/sidebar';
import { NavItemExtended, type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react';

export function NavFooter({
    items,
    className,
    ...props
}: ComponentPropsWithoutRef<typeof SidebarGroup> & {
    items: NavItem[];
}) {
    return (
        <SidebarGroup
            {...props}
            className={`group-data-[collapsible=icon]:p-0 ${className || ''}`}
        >
            <SidebarGroupContent>
                <SidebarMenu>
                    {items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                                asChild
                                className="text-neutral-600 hover:text-neutral-800 dark:text-neutral-300 dark:hover:text-neutral-100"
                            >
                                <a
                                    href={
                                        typeof item.href === 'string'
                                            ? item.href
                                            : item.href.url
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {item.icon && (
                                        <Icon
                                            iconNode={item.icon}
                                            className="h-5 w-5"
                                        />
                                    )}
                                    <span>{item.title}</span>
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

export function NavFooterExtended({
    items = [],
    title,
    className,
}: {
    items: NavItemExtended[] | NavItem[];
    title?: string;
    className?: string;
}) {
    const page = usePage();
    const { state, isOpenId } = useSidebar();
    const currentPath = page.props?.url ?? page.props?.current ?? '';

    // initial open map based on current path (similar to NavMainExtended)
    const initialOpenMap = (items as NavItemExtended[]).reduce((acc: Record<string, boolean>, item) => {
        const itemMatch = (href: any) => {
            if (!href) return false;
            const candidate = typeof href === 'string' ? href : href.url ?? '';
            return typeof currentPath === 'string' && candidate && currentPath.startsWith(candidate);
        };
        acc[item.title] = itemMatch((item as NavItemExtended).href) || ((item as NavItemExtended).subItems || []).some((s) => itemMatch(s.href));
        return acc;
    }, {} as Record<string, boolean>);

    const storageKey = 'nav-footer-open-map';
    const getPersisted = () => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    };
    const persisted = getPersisted();
    const mergedInitial = { ...initialOpenMap, ...(persisted ?? {}) };
    const [openMap, setOpenMap] = useState<Record<string, boolean>>(mergedInitial);

    // refs & heights for submenus
    const subRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [heights, setHeights] = useState<Record<string, number>>({});

    useEffect(() => {
        const measure = () => {
            const newHeights: Record<string, number> = {};
            (items as NavItemExtended[]).forEach((item) => {
                const el = subRefs.current[item.title];
                if (el) newHeights[item.title] = el.scrollHeight;
            });
            setHeights(newHeights);
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [items]);

    useEffect(() => {
        // update open state when path changes
        const newMap = { ...openMap };
        (items as NavItemExtended[]).forEach((item) => {
            const itemMatch = (href: any) => {
                if (!href) return false;
                const candidate = typeof href === 'string' ? href : href.url ?? '';
                return typeof currentPath === 'string' && candidate && currentPath.startsWith(candidate);
            };
            if (itemMatch((item as NavItemExtended).href) || ((item as NavItemExtended).subItems || []).some((s) => itemMatch(s.href))) {
                newMap[item.title] = true;
            }
        });
        setOpenMap(newMap);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(openMap));
        } catch {
            // ignore
        }
    }, [openMap]);

    const isExternal = (href: any) => {
        const url = typeof href === 'string' ? href : href?.url ?? '';
        return /^(https?:\/\/|mailto:|tel:)/.test(url);
    };

    const renderLink = (href: any, children: any, itemTarget?: string) => {
        const url = typeof href === 'string' ? href : href?.url ?? '';
        const target = itemTarget ?? (isExternal(href) ? '_blank' : '_self');
        const rel = target === '_blank' ? 'noopener noreferrer' : undefined;

        if (!url) {
            return <span>{children}</span>;
        }

        // internal Inertia Link if path starts with '/'
        // if (!isExternal(href) && url.startsWith('/')) {
        //     return (
        //         <Link href={href} prefetch target={target} rel={rel}>
        //             {children}
        //         </Link>
        //     );
        // }

        return (
            // external anchor
            // eslint-disable-next-line jsx-a11y/anchor-has-content
            <a href={url} target={target} rel={rel}>
                {children}
            </a>
        );
    };

    return (
        <SidebarGroup className={`group-data-[collapsible=icon]:p-0 ${className || ''}`}>
            {title && <SidebarGroupLabel>{title}</SidebarGroupLabel>}
            <SidebarGroupContent>
                <SidebarMenu>
                    {(items as NavItemExtended[]).map((item) => {
                        const hasSub = !!(item as NavItemExtended).subItems && (item as NavItemExtended).subItems!.length > 0;
                        const isOpen = !!openMap[item.title];
                        const iconNode = item.icon;
                        const label = (
                            <>
                                {iconNode && <Icon iconNode={iconNode} className="h-5 w-5" />}
                                <span>{item.title}</span>
                            </>
                        );

                        return (
                            <SidebarMenuItem key={item.title} >
                                {hasSub ? (
                                    <>
                                        <SidebarMenuButton
                                            asChild
                                            onClick={() => setOpenMap((m) => ({ ...m, [item.title]: !m[item.title] }))}
                                            tooltip={!isOpenId('main') ? item.title : undefined}
                                        >
                                            <button type="button" className="w-full text-left flex items-center gap-2">
                                                {label}
                                            </button>
                                        </SidebarMenuButton>

                                        <div
                                            // @ts-ignore
                                            ref={(el) => (subRefs.current[item.title] = el)}
                                            className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out mt-2 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                                            style={{ maxHeight: isOpen ? heights[item.title] ?? 400 : 0 }}
                                        >
                                            <SidebarMenuSub>
                                                {(item as NavItemExtended).subItems!.map((sub) => (
                                                    <SidebarMenuItem key={sub.title} >
                                                        <SidebarMenuButton tooltip={!isOpenId('main') ? sub.title : undefined} asChild>
                                                            {renderLink(sub.href, (
                                                                <>
                                                                    {sub.icon && <Icon iconNode={sub.icon} className="h-4 w-4 group-data-[collapsible=icon]:size-3.5" />}
                                                                    <span>{sub.title}</span>
                                                                </>
                                                            ), sub.target)}
                                                        </SidebarMenuButton>
                                                    </SidebarMenuItem>
                                                ))}
                                            </SidebarMenuSub>
                                        </div>
                                    </>
                                ) : (
                                    <SidebarMenuButton tooltip={!isOpenId('main') ? item.title : undefined} asChild>
                                        {renderLink(item.href ?? (item as NavItem).href, label, (item as any).target)}
                                    </SidebarMenuButton>
                                )}
                            </SidebarMenuItem>
                        );
                    })}
                </SidebarMenu>
            </SidebarGroupContent>
        </SidebarGroup>
    );
}

export default NavFooterExtended;