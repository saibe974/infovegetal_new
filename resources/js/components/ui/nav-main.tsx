import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
} from '@/components/ui/sidebar';
import { type NavItem, type NavItemExtended } from '@/types';
import { useState, useEffect, useRef } from 'react';
import { Link, usePage } from '@inertiajs/react';

function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                            asChild
                            isActive={page.url.startsWith(
                                typeof item.href === 'string'
                                    ? item.href
                                    : item.href.url,
                            )}
                            tooltip={{ children: item.title }}
                        >
                            <Link href={item.href} prefetch>
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarGroup>
    );
}

export function NavMainExtended({ items = [], title = 'Navigation' }: { items: NavItemExtended[]; title?: string }) {
    const page = usePage();
    const currentPath = page.props?.url ?? page.props?.current ?? '';

    // initialize open state per item key (use title as key)
    const initialOpenMap = items.reduce((acc: Record<string, boolean>, item) => {
        const itemMatch = (href: any) => {
            if (!href) return false;
            const candidate = typeof href === 'string' ? href : href.url ?? '';
            return typeof currentPath === 'string' && candidate && currentPath.startsWith(candidate);
        };

        const open = itemMatch(item.href) || (item.subItems || []).some((s) => itemMatch(s.href));
        acc[item.title] = open;
        return acc;
    }, {} as Record<string, boolean>);
    // try to restore persisted openMap from localStorage (client-side only)
    const storageKey = 'nav-open-map';
    const getPersisted = () => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    };

    const persisted = getPersisted();
    const mergedInitial = { ...initialOpenMap, ...(persisted ?? {}) };

    const [openMap, setOpenMap] = useState<Record<string, boolean>>(mergedInitial);

    // refs to submenu wrappers to measure heights
    const subRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [heights, setHeights] = useState<Record<string, number>>({});

    // measure heights for all submenus
    useEffect(() => {
        const measure = () => {
            const newHeights: Record<string, number> = {};
            items.forEach((item) => {
                const el = subRefs.current[item.title];
                if (el) newHeights[item.title] = el.scrollHeight;
            });
            setHeights(newHeights);
        };

        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items]);

    useEffect(() => {
        // when path changes, ensure matching item is opened
        const newMap = { ...openMap };
        items.forEach((item) => {
            const itemMatch = (href: any) => {
                if (!href) return false;
                const candidate = typeof href === 'string' ? href : href.url ?? '';
                return typeof currentPath === 'string' && candidate && currentPath.startsWith(candidate);
            };
            if (itemMatch(item.href) || (item.subItems || []).some((s) => itemMatch(s.href))) {
                newMap[item.title] = true;
            }
        });
        setOpenMap(newMap);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath]);

    // persist openMap to localStorage when it changes
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(openMap));
        } catch (e) {
            // ignore
        }
    }, [openMap]);


    return (
        <SidebarGroup className="px-2 py-0">
            {title && <SidebarGroupLabel>{title}</SidebarGroupLabel>}
            <SidebarMenu>
                {items.map((item) => {
                    const isActive = page.url.startsWith(
                        typeof item.href === 'string' ? item.href : item.href.url,
                    );
                    const isOpen = !!openMap[item.title];

                    return (
                        <SidebarMenuItem key={item.title}>
                            {item.subItems && item.subItems.length > 0 ? (
                                <>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={isActive}
                                        tooltip={{ children: item.title }}
                                        onClick={() => setOpenMap((m) => ({ ...m, [item.title]: !m[item.title] }))}
                                    >
                                        <span>
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                        </span>
                                    </SidebarMenuButton>

                                    <div
                                        // @ts-ignore
                                        ref={(el) => (subRefs.current[item.title] = el)}
                                        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out mt-2 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                                        style={{ maxHeight: isOpen ? heights[item.title] ?? 400 : 0 }}
                                    >
                                        <SidebarMenuSub>
                                            {item.subItems.map((subItem) => (
                                                <SidebarMenuItem key={subItem.title}>
                                                    <SidebarMenuButton
                                                        asChild
                                                        isActive={page.url.startsWith(
                                                            typeof subItem.href === 'string' ? subItem.href : subItem.href.url,
                                                        )}
                                                        tooltip={{ children: subItem.title }}
                                                    >
                                                        <Link href={subItem.href} prefetch>
                                                            {subItem.icon && <subItem.icon />}
                                                            <span>{subItem.title}</span>
                                                        </Link>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            ))}
                                        </SidebarMenuSub>
                                    </div>
                                </>
                            ) : (
                                <SidebarMenuButton asChild isActive={isActive} tooltip={{ children: item.title }}>
                                    <Link href={item.href} prefetch>
                                        {item.icon && <item.icon />}
                                        <span>{item.title}</span>
                                    </Link>
                                </SidebarMenuButton>
                            )}
                        </SidebarMenuItem>
                    );
                })}
            </SidebarMenu>
        </SidebarGroup>
    );

}

export default NavMain;
