import SortableTree, {
    type Id,
    type LazyLoadPageArgs,
    type LazyLoadPageResult,
    type RenderItemProps,
} from '@/components/sortable-tree';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { StickyBar } from '@/components/ui/sticky-bar';
import { useI18n } from '@/lib/i18n';
import { type User } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDownIcon,
    ArrowUpDownIcon,
    ArrowUpIcon,
    ChevronDown,
    ChevronRight,
    EditIcon,
    GripVertical,
    Loader2Icon,
    TrashIcon,
    UserCheck,
} from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';

const accordionGrid =
    'grid grid-cols-[128px_minmax(180px,1.1fr)_minmax(220px,1.3fr)_minmax(200px,1fr)_120px_152px] items-center';

export type AccordionTreeUser = User & {
    depth: number;
    parent_id: number | null;
    has_children?: boolean;
};

interface UsersAccordionProps {
    items: AccordionTreeUser[];
    forcedExpandedIds?: Id[];
    lazy?: {
        pageSize?: number;
        loadPage: (
            parent: AccordionTreeUser | null,
            args: LazyLoadPageArgs,
        ) => Promise<LazyLoadPageResult<AccordionTreeUser>>;
    };
    onChange?: (
        items: AccordionTreeUser[],
        reason?: 'drag' | 'expand' | 'collapse' | 'lazy-load',
    ) => void;
    canEdit?: boolean;
    canDelete?: boolean;
    canImpersonate?: boolean;
    effectiveUserId?: number;
    onEdit?: (userId: number) => void;
    onDelete?: (userId: number) => void;
    onImpersonate?: (userId: number) => void;
}

function roleBadgeClass(roleName: string) {
    if (roleName === 'commercial')
        return 'border-transparent bg-blue-500 text-white hover:bg-blue-500/90';
    if (roleName === 'group')
        return 'border-transparent bg-purple-500 text-white hover:bg-purple-500/90';
    if (roleName === 'supplier')
        return 'border-transparent bg-amber-500 text-white hover:bg-amber-500/90';
    return undefined;
}

function roleBadgeVariant(
    roleName: string,
): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (roleName === 'dev') return 'destructive';
    if (roleName === 'admin') return 'default';
    if (roleName === 'client') return 'secondary';
    return 'outline';
}

function UsersAccordionHeader({
    showActions,
    headerRef,
}: {
    showActions: boolean;
    headerRef: RefObject<HTMLDivElement | null>;
}) {
    const { t } = useI18n();
    const page = usePage<{
        q?: string;
        query: { sort?: string; dir?: string };
    }>();
    const currentSort = page.props.query?.sort;
    const currentDirection = page.props.query?.dir ?? 'desc';

    const sortBy = (field: string) => {
        const url = new URL(window.location.href);

        if (currentSort !== field) {
            url.searchParams.set('sort', field);
            url.searchParams.set('dir', 'desc');
        } else if (currentDirection === 'desc') {
            url.searchParams.set('dir', 'asc');
        } else {
            url.searchParams.delete('sort');
            url.searchParams.delete('dir');
        }

        if (page.props.q && !url.searchParams.get('q')) {
            url.searchParams.set('q', page.props.q);
        }

        router.visit(url.toString(), { preserveScroll: true });
    };

    const SortButton = ({
        field,
        children,
    }: {
        field: string;
        children: React.ReactNode;
    }) => {
        const isActive = currentSort === field;

        return (
            <button
                type="button"
                onClick={() => sortBy(field)}
                className={`flex items-center gap-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground ${isActive ? 'text-foreground' : ''}`}
            >
                {children}
                {!isActive ? (
                    <ArrowUpDownIcon className="size-4 opacity-50" />
                ) : currentDirection === 'asc' ? (
                    <ArrowUpIcon className="size-4" />
                ) : (
                    <ArrowDownIcon className="size-4" />
                )}
            </button>
        );
    };

    return (
        <StickyBar
            zIndex={19}
            className="users-accordion-columns"
            stickyClassName="bg-card shadow-md"
            topOffsetElement=".top-sticky, .users-search-sticky"
        >
            <div
                ref={headerRef}
                className="w-full overflow-x-auto rounded-md border bg-card shadow-sm"
            >
                <div className={`${accordionGrid} min-w-[1050px] px-3 py-3`}>
                    <span aria-hidden />
                    <SortButton field="name">{t('Name')}</SortButton>
                    <SortButton field="email">{t('Email')}</SortButton>
                    <SortButton field="roles">{t('Current roles')}</SortButton>
                    <SortButton field="created_at">{t('Joined')}</SortButton>
                    <span className="text-right text-xs font-medium text-muted-foreground">
                        {showActions ? t('Actions') : ''}
                    </span>
                </div>
            </div>
        </StickyBar>
    );
}

function UserAccordionItem({
    props,
    canEdit,
    canDelete,
    canImpersonate,
    effectiveUserId,
    onEdit,
    onDelete,
    onImpersonate,
}: {
    props: RenderItemProps<AccordionTreeUser>;
    canEdit: boolean;
    canDelete: boolean;
    canImpersonate: boolean;
    effectiveUserId?: number;
    onEdit?: (userId: number) => void;
    onDelete?: (userId: number) => void;
    onImpersonate?: (userId: number) => void;
}) {
    const { t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const { item } = props;
    const isGroup = (item.roles ?? []).some((role) => role.name === 'group');
    const showEdit = canEdit && (item.id !== 1 || effectiveUserId === 1);
    const showDelete = canDelete && item.id !== 1;
    const showImpersonate =
        canImpersonate &&
        Boolean(item.abilities?.impersonate) &&
        Boolean(onImpersonate);

    return (
        <div
            ref={props.setNodeRef}
            data-user-accordion-row
            data-user-id={item.id}
            data-parent-id={item.parent_id ?? ''}
            data-expanded={props.isExpanded ? 'true' : 'false'}
            className={[
                'relative border-b border-border/40 transition-colors',
                props.isOver ? 'bg-muted/20' : '',
                props.isInsideTarget
                    ? 'bg-primary/10 ring-2 ring-primary/50 ring-offset-1'
                    : '',
                props.isDragging ? 'opacity-50' : '',
            ].join(' ')}
        >
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <div className="overflow-x-auto">
                    <div
                        className={`${accordionGrid} min-h-14 min-w-[1050px] px-3 py-2 hover:bg-muted/50`}
                    >
                        <div
                            className="relative flex items-center gap-2"
                            style={{ paddingLeft: props.depth * 12 }}
                        >
                            <div className="flex size-6 shrink-0 items-center justify-center">
                                {!props.isDragging && item.has_children && (
                                    <button
                                        type="button"
                                        data-user-tree-toggle
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            props.toggleExpand();
                                        }}
                                        className="flex size-6 items-center justify-center rounded hover:bg-muted"
                                        aria-label={
                                            props.isExpanded
                                                ? t('Collapse')
                                                : t('Expand')
                                        }
                                    >
                                        {props.isLoading ? (
                                            <Loader2Icon className="size-4 animate-spin" />
                                        ) : props.isExpanded ? (
                                            <ChevronDown className="size-4" />
                                        ) : (
                                            <ChevronRight className="size-4" />
                                        )}
                                    </button>
                                )}
                            </div>

                            <div
                                {...(props.listeners ?? {})}
                                {...props.attributes}
                                className="flex size-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground"
                                aria-label={t('Drag')}
                            >
                                <GripVertical className="size-4" />
                            </div>

                            {item.logo_url ? (
                                <img
                                    src={item.logo_url}
                                    alt={item.name}
                                    className="size-9 shrink-0 rounded-md border object-contain"
                                />
                            ) : (
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-sm font-medium text-muted-foreground">
                                    {item.name?.charAt(0)?.toUpperCase() ?? '?'}
                                </div>
                            )}
                        </div>

                        <CollapsibleTrigger asChild>
                            <button
                                type="button"
                                className="flex min-w-0 items-center gap-2 pr-4 text-left font-medium hover:underline"
                                style={{ paddingLeft: props.depth * 12 }}
                            >
                                <span className="truncate">{item.name}</span>
                                <ChevronDown
                                    className={`size-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                                />
                            </button>
                        </CollapsibleTrigger>

                        <span className="truncate pr-4 text-sm text-muted-foreground">
                            {isGroup ? '—' : item.email || '—'}
                        </span>

                        <span className="flex flex-wrap gap-1 pr-4">
                            {(item.roles ?? []).map((role) => (
                                <Badge
                                    key={role.id}
                                    variant={roleBadgeVariant(role.name)}
                                    className={roleBadgeClass(role.name)}
                                >
                                    {t(role.name)}
                                </Badge>
                            ))}
                            {(item.roles ?? []).length === 0 && (
                                <Badge variant="outline">{t('No role')}</Badge>
                            )}
                        </span>

                        <span className="text-sm text-muted-foreground">
                            {item.created_at
                                ? new Date(item.created_at).toLocaleDateString()
                                : '—'}
                        </span>

                        <div className="flex items-center justify-end gap-2">
                            {showImpersonate && (
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    onClick={() => onImpersonate?.(item.id)}
                                    title={t('Impersonate')}
                                >
                                    <UserCheck className="size-4" />
                                </Button>
                            )}
                            {showEdit && onEdit && (
                                <Button
                                    size="icon"
                                    variant="outline"
                                    onClick={() => onEdit(item.id)}
                                    title={t('Edit')}
                                >
                                    <EditIcon className="size-4" />
                                </Button>
                            )}
                            {showDelete && onDelete && (
                                <Button
                                    size="icon"
                                    variant="destructive-outline"
                                    onClick={() => onDelete(item.id)}
                                    title={t('Delete')}
                                >
                                    <TrashIcon className="size-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                <CollapsibleContent className="border-t border-border/40 bg-muted/20 px-4 py-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
                    <div className="grid gap-4 pl-14 sm:grid-cols-3">
                        <div className="min-w-0">
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Email')}
                            </div>
                            <div className="mt-1 truncate text-sm">
                                {isGroup ? '—' : item.email || '—'}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Current roles')}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {(item.roles ?? []).map((role) => (
                                    <Badge
                                        key={role.id}
                                        variant={roleBadgeVariant(role.name)}
                                        className={roleBadgeClass(role.name)}
                                    >
                                        {t(role.name)}
                                    </Badge>
                                ))}
                                {(item.roles ?? []).length === 0 && (
                                    <Badge variant="outline">
                                        {t('No role')}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                {t('Joined')}
                            </div>
                            <div className="mt-1 text-sm">
                                {item.created_at
                                    ? new Date(
                                          item.created_at,
                                      ).toLocaleDateString()
                                    : '—'}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button variant="link" asChild className="h-auto px-0">
                            <Link href={`/admin/users/${item.id}`}>
                                {t('View user')}
                            </Link>
                        </Button>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

function StickyParentRow({
    user,
    frame,
    onSelect,
    onToggle,
}: {
    user: AccordionTreeUser;
    frame: { top: number; left: number; width: number };
    onSelect: () => void;
    onToggle: () => void;
}) {
    const { t } = useI18n();
    const isGroup = (user.roles ?? []).some((role) => role.name === 'group');

    return (
        <div
            className="fixed z-[18] overflow-x-auto border-x border-b bg-card shadow-md"
            style={{ top: frame.top, left: frame.left, width: frame.width }}
        >
            <div
                className={`${accordionGrid} h-14 min-w-[1050px] px-3 py-2`}
            >
                <div
                    className="flex items-center gap-2 pr-4"
                    style={{ paddingLeft: user.depth * 12 }}
                >
                    <button
                        type="button"
                        onClick={onToggle}
                        className="flex size-6 shrink-0 items-center justify-center rounded hover:bg-muted"
                        aria-label={t('Collapse')}
                    >
                        <ChevronDown className="size-4" />
                    </button>
                    {user.logo_url ? (
                        <img
                            src={user.logo_url}
                            alt={user.name}
                            className="size-9 rounded-md border bg-background object-contain"
                        />
                    ) : (
                        <div className="flex size-9 items-center justify-center rounded-md border bg-muted text-sm font-medium text-muted-foreground">
                            {user.name?.charAt(0)?.toUpperCase() ?? '?'}
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onSelect}
                    className="truncate pr-4 text-left font-semibold hover:underline"
                    style={{ paddingLeft: user.depth * 12 }}
                    title={t('Scroll to parent')}
                >
                    {user.name}
                </button>

                <span className="truncate pr-4 text-sm text-muted-foreground">
                    {isGroup ? '—' : user.email || '—'}
                </span>

                <span className="flex flex-nowrap gap-1 overflow-hidden pr-4">
                    {(user.roles ?? []).map((role) => (
                        <Badge
                            key={role.id}
                            variant={roleBadgeVariant(role.name)}
                            className={roleBadgeClass(role.name)}
                        >
                            {t(role.name)}
                        </Badge>
                    ))}
                    {(user.roles ?? []).length === 0 && (
                        <Badge variant="outline">{t('No role')}</Badge>
                    )}
                </span>

                <span className="text-sm text-muted-foreground">
                    {user.created_at
                        ? new Date(user.created_at).toLocaleDateString()
                        : '—'}
                </span>

                <div className="flex justify-end">
                    <Badge variant="outline">{t('Parent')}</Badge>
                </div>
            </div>
        </div>
    );
}

export default function UsersAccordion({
    items,
    forcedExpandedIds,
    lazy,
    onChange,
    canEdit = false,
    canDelete = false,
    canImpersonate = false,
    effectiveUserId,
    onEdit,
    onDelete,
    onImpersonate,
}: UsersAccordionProps) {
    const showActions = canEdit || canDelete || canImpersonate;
    const headerRef = useRef<HTMLDivElement | null>(null);
    const treeRef = useRef<HTMLDivElement | null>(null);
    const loadedUsersRef = useRef(new Map<number, AccordionTreeUser>());
    const [stickyParents, setStickyParents] = useState<AccordionTreeUser[]>([]);
    const [stickyFrame, setStickyFrame] = useState({
        top: 0,
        left: 0,
        width: 0,
    });

    useEffect(() => {
        let animationFrame: number | null = null;

        const updateStickyParent = () => {
            animationFrame = null;
            const header = headerRef.current;
            const tree = treeRef.current;

            if (!header || !tree) return;

            const headerRect = header.getBoundingClientRect();
            const rows = Array.from(
                tree.querySelectorAll<HTMLElement>('[data-user-accordion-row]'),
            );
            const probeY = headerRect.bottom + 2;
            const currentRow = rows.find((row) => {
                const rect = row.getBoundingClientRect();
                return rect.bottom > probeY && rect.top < window.innerHeight;
            });

            const nextParents: AccordionTreeUser[] = [];
            let parentId = currentRow?.dataset.parentId
                ? Number(currentRow.dataset.parentId)
                : null;

            while (parentId !== null && Number.isFinite(parentId)) {
                const parentRow = tree.querySelector<HTMLElement>(
                    `[data-user-id="${parentId}"]`,
                );
                const parent = loadedUsersRef.current.get(parentId);

                if (!parentRow || !parent) break;

                if (
                    parentRow.dataset.expanded === 'true' &&
                    parentRow.getBoundingClientRect().bottom <= probeY
                ) {
                    nextParents.push(parent);
                }

                parentId = parent.parent_id;
            }

            nextParents.reverse();
            setStickyParents((current) =>
                current.length === nextParents.length &&
                current.every(
                    (parent, index) => parent.id === nextParents[index]?.id,
                )
                    ? current
                    : nextParents,
            );
            setStickyFrame((current) => {
                const next = {
                    top: Math.round(headerRect.bottom),
                    left: Math.round(headerRect.left),
                    width: Math.round(headerRect.width),
                };

                return current.top === next.top &&
                    current.left === next.left &&
                    current.width === next.width
                    ? current
                    : next;
            });
        };

        const scheduleUpdate = () => {
            if (animationFrame !== null) return;
            animationFrame = window.requestAnimationFrame(updateStickyParent);
        };

        const observer = new MutationObserver(scheduleUpdate);
        if (treeRef.current) {
            observer.observe(treeRef.current, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['data-expanded', 'data-parent-id'],
            });
        }

        window.addEventListener('scroll', scheduleUpdate, true);
        window.addEventListener('resize', scheduleUpdate);
        scheduleUpdate();

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', scheduleUpdate, true);
            window.removeEventListener('resize', scheduleUpdate);
            if (animationFrame !== null)
                window.cancelAnimationFrame(animationFrame);
        };
    }, []);

    return (
        <div className="space-y-2">
            <UsersAccordionHeader
                showActions={showActions}
                headerRef={headerRef}
            />
            {stickyFrame.width > 0 &&
                stickyParents.map((stickyParent, index) => (
                    <StickyParentRow
                        key={stickyParent.id}
                        user={stickyParent}
                        frame={{
                            ...stickyFrame,
                            top: stickyFrame.top + index * 56,
                        }}
                        onSelect={() => {
                            treeRef.current
                                ?.querySelector<HTMLElement>(
                                    `[data-user-id="${stickyParent.id}"]`,
                                )
                                ?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'center',
                                });
                        }}
                        onToggle={() => {
                            treeRef.current
                                ?.querySelector<HTMLElement>(
                                    `[data-user-id="${stickyParent.id}"] [data-user-tree-toggle]`,
                                )
                                ?.click();
                        }}
                    />
                ))}
            <div
                ref={treeRef}
                className="overflow-hidden rounded-md border bg-card"
            >
                <SortableTree
                    items={items}
                    idKey="id"
                    parentKey="parent_id"
                    depthKey="depth"
                    storageKey="users-accordion"
                    expandOnInside={false}
                    forcedExpandedIds={forcedExpandedIds}
                    lazy={lazy}
                    onChange={onChange}
                    renderItem={(props) => {
                        loadedUsersRef.current.set(props.item.id, props.item);

                        return (
                            <UserAccordionItem
                                key={props.item.id}
                                props={props}
                                canEdit={canEdit}
                                canDelete={canDelete}
                                canImpersonate={canImpersonate}
                                effectiveUserId={effectiveUserId}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onImpersonate={onImpersonate}
                            />
                        );
                    }}
                />
            </div>
        </div>
    );
}
