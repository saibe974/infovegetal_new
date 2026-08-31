import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    useSidebar,
} from '@/components/ui/sidebar';
import { type NavItem, type NavItemExtended } from '@/types';
import { useState, useEffect, useRef } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';

const ACCORDION_EVENT = 'sidebar-nav-accordion';

const areNumberRecordsEqual = (a: Record<string, number>, b: Record<string, number>): boolean => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);

    if (aKeys.length !== bKeys.length) {
        return false;
    }

    return aKeys.every((key) => a[key] === b[key]);
};

function NavMain({ items = [] }: { items: NavItem[] }) {
    const page = usePage();
    const { state } = useSidebar();
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
                            tooltip={state === 'collapsed' ? { children: item.title } : undefined}
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

export function NavMainExtended({
    items = [],
    title = 'Navigation',
    menuButtonClassName,
}: {
    items: NavItemExtended[];
    title?: string;
    menuButtonClassName?: string;
}) {
    const page = usePage();
    const { isOpenId } = useSidebar();
    const currentPath = page.props?.url ?? page.props?.current ?? '';

    // console.log(isOpenId);

    const getCandidateUrl = (href: NavItem['href'] | undefined): string => {
        if (!href) return '';
        if (typeof href === 'string') return href;
        return typeof href.url === 'string' ? href.url : '';
    };

    // initialize open state per item key (use title as key)
    const initialOpenMap = items.reduce((acc: Record<string, boolean>, item) => {
        const itemMatch = (href: NavItem['href'] | undefined) => {
            const candidate = getCandidateUrl(href);
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
        } catch {
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
            setHeights((prev) => (areNumberRecordsEqual(prev, newHeights) ? prev : newHeights));
        };

        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);

    }, [items]);

    useEffect(() => {
        // when path changes, ensure matching item is opened
        setOpenMap((prev) => {
            const next = { ...prev };
            let changed = false;

            items.forEach((item) => {
                const itemMatch = (href: NavItem['href'] | undefined) => {
                    const candidate = getCandidateUrl(href);
                    return typeof currentPath === 'string' && candidate && currentPath.startsWith(candidate);
                };

                if (itemMatch(item.href) || (item.subItems || []).some((s) => itemMatch(s.href))) {
                    if (!next[item.title]) {
                        next[item.title] = true;
                        changed = true;
                    }
                }
            });

            return changed ? next : prev;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPath]);

    // persist openMap to localStorage when it changes
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(openMap));
        } catch {
            // ignore
        }
    }, [openMap]);

    // accordion behavior: opening an item collapses all others (across nav groups)
    const setOpenExclusive = (title: string, open: boolean) => {
        setOpenMap(() => {
            const next: Record<string, boolean> = {};
            items.forEach((it) => {
                next[it.title] = it.title === title ? open : false;
            });
            return next;
        });
        if (open) {
            window.dispatchEvent(new CustomEvent(ACCORDION_EVENT, { detail: { source: 'nav-main', title } }));
        }
    };

    const closeOthersKeeping = (keepTitle: string) => {
        setOpenMap((m) => {
            const next: Record<string, boolean> = {};
            let changed = false;
            items.forEach((it) => {
                next[it.title] = it.title === keepTitle ? !!m[it.title] : false;
                if (next[it.title] !== !!m[it.title]) changed = true;
            });
            return changed ? next : m;
        });
        window.dispatchEvent(new CustomEvent(ACCORDION_EVENT, { detail: { source: 'nav-main', title: keepTitle } }));
    };

    const collapseAll = () => {
        setOpenMap((m) => {
            const next: Record<string, boolean> = {};
            let changed = false;
            items.forEach((it) => {
                next[it.title] = false;
                if (m[it.title]) changed = true;
            });
            return changed ? next : m;
        });
        window.dispatchEvent(new CustomEvent(ACCORDION_EVENT, { detail: { source: 'nav-main', title: '' } }));
    };

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { source: string; title: string };
            if (detail.source === 'nav-main') return;
            setOpenMap((m) => {
                const hasOpen = items.some((it) => !!m[it.title]);
                if (!hasOpen) return m;
                const next: Record<string, boolean> = {};
                items.forEach((it) => {
                    next[it.title] = false;
                });
                return next;
            });
        };
        window.addEventListener(ACCORDION_EVENT, handler);
        return () => window.removeEventListener(ACCORDION_EVENT, handler);
    }, [items]);

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
                                        className={menuButtonClassName}
                                        tooltip={!isOpenId('main') ? {
                                            children: item.title,
                                            side: 'right',
                                        } : undefined}
                                    >
                                        <Link
                                            href={item.href}
                                            prefetch
                                            className="relative"
                                            onClick={(e) => {
                                                const itemUrl = typeof item.href === 'string' ? item.href : item.href.url;
                                                // Si on est déjà sur cette URL, basculer les sous-éléments sans naviguer
                                                if (page.url === itemUrl || page.url.startsWith(itemUrl)) {
                                                    e.preventDefault();
                                                    setOpenExclusive(item.title, !isOpen);
                                                } else {
                                                    // Sinon, ouvrir les sous-éléments lors de la navigation
                                                    setOpenExclusive(item.title, true);
                                                }
                                            }}
                                        >
                                            {item.icon && <item.icon />}
                                            <span>{item.title}</span>
                                            <ChevronRight className={`ml-auto size-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                                            <ChevronRight className={`absolute left-5 bottom-2 size-3 opacity-60 transition-transform duration-200 hidden group-data-[collapsible=icon]:block ${isOpen ? 'rotate-90' : ''}`} />
                                        </Link>
                                    </SidebarMenuButton>

                                    <div
                                        ref={(el: HTMLDivElement | null) => {
                                            subRefs.current[item.title] = el;
                                        }}
                                        className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out mt-2 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                                        style={{ maxHeight: isOpen ? heights[item.title] ?? 400 : 0 }}
                                    >
                                        <SidebarMenuSub
                                        // className='group-data-[collapsible=icon]:hidden'
                                        >
                                            {item.subItems.map((subItem) => (
                                                <SidebarMenuItem key={subItem.title}>
                                                    <SidebarMenuButton
                                                        asChild
                                                        isActive={page.url.startsWith(
                                                            typeof subItem.href === 'string' ? subItem.href : subItem.href.url,
                                                        )}
                                                        className={menuButtonClassName}
                                                        tooltip={!isOpenId('main') ? { children: subItem.title } : undefined}
                                                    >
                                                        <Link href={subItem.href} prefetch onClick={() => closeOthersKeeping(item.title)}>
                                                            {subItem.icon && <subItem.icon className='group-data-[collapsible=icon]:size-3.5' />}
                                                            <span>{subItem.title}</span>
                                                        </Link>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            ))}
                                        </SidebarMenuSub>
                                    </div>
                                </>
                            ) : (
                                <SidebarMenuButton
                                    asChild
                                    isActive={isActive}
                                    className={menuButtonClassName}
                                    tooltip={!isOpenId('main') ? { children: item.title } : undefined}
                                >
                                    <Link href={item.href} prefetch onClick={collapseAll}>
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
