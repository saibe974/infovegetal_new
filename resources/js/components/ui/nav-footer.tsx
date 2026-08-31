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
import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
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
    menuButtonClassName,
}: {
    items: NavItemExtended[] | NavItem[];
    title?: string;
    className?: string;
    menuButtonClassName?: string;
}) {
    const page = usePage();
    const { isOpenId } = useSidebar();
    const currentPath = page.props?.url ?? page.props?.current ?? '';

    const getCandidateUrl = (href: NavItem['href'] | undefined): string => {
        if (!href) return '';
        if (typeof href === 'string') return href;
        return typeof href.url === 'string' ? href.url : '';
    };

    // initial open map based on current path (similar to NavMainExtended)
    const initialOpenMap = (items as NavItemExtended[]).reduce((acc: Record<string, boolean>, item) => {
        const itemMatch = (href: NavItem['href'] | undefined) => {
            const candidate = getCandidateUrl(href);
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
            setHeights((prev) => (areNumberRecordsEqual(prev, newHeights) ? prev : newHeights));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [items]);

    useEffect(() => {
        // update open state when path changes
        setOpenMap((prev) => {
            const next = { ...prev };
            let changed = false;

            (items as NavItemExtended[]).forEach((item) => {
                const itemMatch = (href: NavItem['href'] | undefined) => {
                    const candidate = getCandidateUrl(href);
                    return typeof currentPath === 'string' && candidate && currentPath.startsWith(candidate);
                };

                if (itemMatch((item as NavItemExtended).href) || ((item as NavItemExtended).subItems || []).some((s) => itemMatch(s.href))) {
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
            (items as NavItemExtended[]).forEach((it) => {
                next[it.title] = it.title === title ? open : false;
            });
            return next;
        });
        if (open) {
            window.dispatchEvent(new CustomEvent(ACCORDION_EVENT, { detail: { source: 'nav-footer', title } }));
        }
    };

    const closeOthersKeeping = (keepTitle: string) => {
        setOpenMap((m) => {
            const next: Record<string, boolean> = {};
            let changed = false;
            (items as NavItemExtended[]).forEach((it) => {
                next[it.title] = it.title === keepTitle ? !!m[it.title] : false;
                if (next[it.title] !== !!m[it.title]) changed = true;
            });
            return changed ? next : m;
        });
        window.dispatchEvent(new CustomEvent(ACCORDION_EVENT, { detail: { source: 'nav-footer', title: keepTitle } }));
    };

    const collapseAll = () => {
        setOpenMap((m) => {
            const next: Record<string, boolean> = {};
            let changed = false;
            (items as NavItemExtended[]).forEach((it) => {
                next[it.title] = false;
                if (m[it.title]) changed = true;
            });
            return changed ? next : m;
        });
        window.dispatchEvent(new CustomEvent(ACCORDION_EVENT, { detail: { source: 'nav-footer', title: '' } }));
    };

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { source: string; title: string };
            if (detail.source === 'nav-footer') return;
            setOpenMap((m) => {
                const hasOpen = (items as NavItemExtended[]).some((it) => !!m[it.title]);
                if (!hasOpen) return m;
                const next: Record<string, boolean> = {};
                (items as NavItemExtended[]).forEach((it) => {
                    next[it.title] = false;
                });
                return next;
            });
        };
        window.addEventListener(ACCORDION_EVENT, handler);
        return () => window.removeEventListener(ACCORDION_EVENT, handler);
    }, [items]);

    const isExternal = (href: NavItem['href'] | undefined) => {
        const url = getCandidateUrl(href);
        return /^(https?:\/\/|mailto:|tel:)/.test(url);
    };

    const renderLink = (href: NavItem['href'] | undefined, children: ReactNode, itemTarget?: string) => {
        const url = getCandidateUrl(href);
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
                                            onClick={() => setOpenExclusive(item.title, !isOpen)}
                                            className={menuButtonClassName}
                                            tooltip={!isOpenId('main') ? item.title : undefined}
                                        >
                                            <button type="button" className="relative w-full text-left flex items-center gap-2">
                                                {label}
                                                <ChevronRight className={`ml-auto size-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                                                <ChevronRight className={`absolute left-5 bottom-2 size-3 opacity-60 transition-transform duration-200 hidden group-data-[collapsible=icon]:block ${isOpen ? 'rotate-90' : ''}`} />
                                            </button>
                                        </SidebarMenuButton>

                                        <div
                                            ref={(el: HTMLDivElement | null) => {
                                                subRefs.current[item.title] = el;
                                            }}
                                            className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out mt-2 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                                            style={{ maxHeight: isOpen ? heights[item.title] ?? 400 : 0 }}
                                        >
                                            <SidebarMenuSub>
                                                {(item as NavItemExtended).subItems!.map((sub) => (
                                                    <SidebarMenuItem key={sub.title} >
                                                        <SidebarMenuButton
                                                            tooltip={!isOpenId('main') ? sub.title : undefined}
                                                            asChild
                                                            className={menuButtonClassName}
                                                            onClick={() => closeOthersKeeping(item.title)}
                                                        >
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
                                    <SidebarMenuButton tooltip={!isOpenId('main') ? item.title : undefined} asChild className={menuButtonClassName} onClick={collapseAll}>
                                        {renderLink(item.href ?? (item as NavItem).href, label, item.target)}
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