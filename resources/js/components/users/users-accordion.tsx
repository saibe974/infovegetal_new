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
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StickyBar } from '@/components/ui/sticky-bar';
import { useI18n } from '@/lib/i18n';
import { DatabaseAccessIcon } from '@/lib/icons';
import { type User } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDownIcon,
    ArrowUpDownIcon,
    ArrowUpIcon,
    ChevronDown,
    ChevronRight,
    EditIcon,
    ExternalLink,
    GripVertical,
    Loader2Icon,
    Mail,
    MapPin,
    Phone,
    Settings2,
    TrashIcon,
    UserCheck,
} from 'lucide-react';
import {
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
} from 'react';

type OptionalColumn = 'email' | 'roles' | 'created_at' | 'actions';
type ColumnVisibility = Record<OptionalColumn, boolean>;

const defaultColumnVisibility: ColumnVisibility = {
    email: true,
    roles: true,
    created_at: true,
    actions: true,
};

const accordionGridClass = 'grid items-center';

function getAccordionGridStyle(columns: ColumnVisibility): CSSProperties {
    const tracks = ['128px', 'minmax(180px, 1.1fr)'];
    let minWidth = 340;

    if (columns.email) {
        tracks.push('minmax(220px, 1.3fr)');
        minWidth += 220;
    }
    if (columns.roles) {
        tracks.push('minmax(200px, 1fr)');
        minWidth += 200;
    }
    if (columns.created_at) {
        tracks.push('120px');
        minWidth += 120;
    }
    if (columns.actions) {
        tracks.push('152px');
        minWidth += 152;
    }

    return {
        gridTemplateColumns: tracks.join(' '),
        minWidth,
    };
}

export type AccordionTreeUser = User & {
    depth: number;
    parent_id: number | null;
    has_children?: boolean;
};

interface UsersAccordionProps {
    items: AccordionTreeUser[];
    memoryCacheKey?: string;
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
    visibleColumns,
    onColumnVisibilityChange,
    onResetColumns,
}: {
    showActions: boolean;
    headerRef: RefObject<HTMLDivElement | null>;
    visibleColumns: ColumnVisibility;
    onColumnVisibilityChange: (
        column: OptionalColumn,
        visible: boolean,
    ) => void;
    onResetColumns: () => void;
}) {
    const { t } = useI18n();
    const page = usePage<{
        q?: string;
        query: { sort?: string; dir?: string };
    }>();
    const currentSort = page.props.query?.sort;
    const currentDirection = page.props.query?.dir ?? 'desc';
    const configurableColumns: Array<{ key: OptionalColumn; label: string }> = [
        { key: 'email', label: t('Email') },
        { key: 'roles', label: t('Current roles') },
        { key: 'created_at', label: t('Joined') },
        { key: 'actions', label: t('Actions') },
    ];

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
                <div
                    className={`${accordionGridClass} px-3 py-3`}
                    style={getAccordionGridStyle(visibleColumns)}
                >
                    <div className="flex justify-end pr-4">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="size-8"
                                    title={t('Choose columns')}
                                    aria-label={t('Choose columns')}
                                >
                                    <Settings2 className="size-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                                <DropdownMenuLabel>
                                    {t('Displayed columns')}
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {configurableColumns.map((column) => (
                                    <DropdownMenuCheckboxItem
                                        key={column.key}
                                        checked={visibleColumns[column.key]}
                                        onCheckedChange={(checked) =>
                                            onColumnVisibilityChange(
                                                column.key,
                                                Boolean(checked),
                                            )
                                        }
                                        onSelect={(event) =>
                                            event.preventDefault()
                                        }
                                    >
                                        {column.label}
                                    </DropdownMenuCheckboxItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={onResetColumns}>
                                    {t('Reset columns')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <SortButton field="name">{t('Name')}</SortButton>
                    {visibleColumns.email && (
                        <SortButton field="email">{t('Email')}</SortButton>
                    )}
                    {visibleColumns.roles && (
                        <SortButton field="roles">
                            {t('Current roles')}
                        </SortButton>
                    )}
                    {visibleColumns.created_at && (
                        <SortButton field="created_at">
                            {t('Joined')}
                        </SortButton>
                    )}
                    {visibleColumns.actions && (
                        <span className="text-right text-xs font-medium text-muted-foreground">
                            {showActions ? t('Actions') : ''}
                        </span>
                    )}
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
    visibleColumns,
    onEdit,
    onDelete,
    onImpersonate,
}: {
    props: RenderItemProps<AccordionTreeUser>;
    canEdit: boolean;
    canDelete: boolean;
    canImpersonate: boolean;
    effectiveUserId?: number;
    visibleColumns: ColumnVisibility;
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
    const addressLocality = [item.address_zip, item.address_town]
        .filter(Boolean)
        .join(' ');

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
                        className={`${accordionGridClass} min-h-14 px-3 py-2 hover:bg-muted/50`}
                        style={getAccordionGridStyle(visibleColumns)}
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

                        {visibleColumns.email && (
                            <span className="truncate pr-4 text-sm text-muted-foreground">
                                {isGroup ? '—' : item.email || '—'}
                            </span>
                        )}

                        {visibleColumns.roles && (
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
                                    <Badge variant="outline">
                                        {t('No role')}
                                    </Badge>
                                )}
                            </span>
                        )}

                        {visibleColumns.created_at && (
                            <span className="text-sm text-muted-foreground">
                                {item.created_at
                                    ? new Date(
                                          item.created_at,
                                      ).toLocaleDateString()
                                    : '—'}
                            </span>
                        )}

                        {visibleColumns.actions && (
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
                        )}
                    </div>
                </div>

                <CollapsibleContent className="border-t border-border/50 bg-muted/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
                    <div className="p-4 sm:p-5">
                        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
                            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(260px,1.1fr)_minmax(0,2fr)]">
                                <div className="flex min-w-0 items-center gap-4">
                                    {item.logo_url ? (
                                        <img
                                            src={item.logo_url}
                                            alt={item.name}
                                            loading="lazy"
                                            className="size-16 shrink-0 rounded-xl border bg-background object-contain p-1 shadow-sm"
                                        />
                                    ) : (
                                        <div className="flex size-16 shrink-0 items-center justify-center rounded-xl border bg-muted text-xl font-semibold text-muted-foreground shadow-sm">
                                            {item.name
                                                ?.charAt(0)
                                                ?.toUpperCase() ?? '?'}
                                        </div>
                                    )}
                                    <div className="min-w-0 space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="truncate text-lg font-semibold">
                                                {item.name}
                                            </h3>
                                            <Badge
                                                variant={
                                                    item.active
                                                        ? 'outline'
                                                        : 'secondary'
                                                }
                                                className={
                                                    item.active
                                                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                                        : undefined
                                                }
                                            >
                                                {item.active
                                                    ? t('Active')
                                                    : t('Inactive')}
                                            </Badge>
                                        </div>
                                        <p className="truncate text-sm text-muted-foreground">
                                            {item.alias ||
                                                (item.ref
                                                    ? `${t('Reference')}: ${item.ref}`
                                                    : t(
                                                          'No additional identifier',
                                                      ))}
                                        </p>
                                        {item.alias && item.ref && (
                                            <p className="text-xs text-muted-foreground">
                                                {t('Reference')}: {item.ref}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-3">
                                    <div className="rounded-lg bg-muted/40 p-3">
                                        <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            <Mail className="size-3.5" />
                                            {t('Contact')}
                                        </div>
                                        <p className="truncate text-sm font-medium">
                                            {isGroup ? '—' : item.email || '—'}
                                        </p>
                                        <p className="mt-1 truncate text-sm text-muted-foreground">
                                            <Phone className="mr-1.5 inline size-3.5" />
                                            {item.phone || '—'}
                                        </p>
                                    </div>

                                    <div className="rounded-lg bg-muted/40 p-3">
                                        <div className="mb-2 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            <MapPin className="size-3.5" />
                                            {t('Address')}
                                        </div>
                                        <div className="space-y-1 text-sm">
                                            <p className="truncate">
                                                {item.address_road || '—'}
                                            </p>
                                            <p className="truncate text-muted-foreground">
                                                {addressLocality || '—'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-lg bg-muted/40 p-3">
                                        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                            {t('Current roles')}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            {(item.roles ?? []).map((role) => (
                                                <Badge
                                                    key={role.id}
                                                    variant={roleBadgeVariant(
                                                        role.name,
                                                    )}
                                                    className={roleBadgeClass(
                                                        role.name,
                                                    )}
                                                >
                                                    {t(role.name)}
                                                </Badge>
                                            ))}
                                            {(item.roles ?? []).length ===
                                                0 && (
                                                <Badge variant="outline">
                                                    {t('No role')}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {t('Joined')}:{' '}
                                            {item.created_at
                                                ? new Date(
                                                      item.created_at,
                                                  ).toLocaleDateString()
                                                : '—'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/20 px-5 py-3">
                                {item.abilities?.manage_db && (
                                    <Button size="sm" variant="outline" asChild>
                                        <Link
                                            href={`/admin/users/${item.id}/db`}
                                        >
                                            <DatabaseAccessIcon className="size-4" />
                                            {t('Databases')}
                                        </Link>
                                    </Button>
                                )}
                                {!visibleColumns.actions && showImpersonate && (
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => onImpersonate?.(item.id)}
                                    >
                                        <UserCheck className="size-4" />
                                        {t('Impersonate')}
                                    </Button>
                                )}
                                {showEdit && onEdit && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => onEdit(item.id)}
                                    >
                                        <EditIcon className="size-4" />
                                        {t('Edit')}
                                    </Button>
                                )}
                                {!visibleColumns.actions &&
                                    showDelete &&
                                    onDelete && (
                                        <Button
                                            size="sm"
                                            variant="destructive-outline"
                                            onClick={() => onDelete(item.id)}
                                        >
                                            <TrashIcon className="size-4" />
                                            {t('Delete')}
                                        </Button>
                                    )}
                                <Button size="sm" asChild>
                                    <Link href={`/admin/users/${item.id}`}>
                                        {t('View user')}
                                        <ExternalLink className="size-4" />
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

function StickyParentRow({
    user,
    frame,
    visibleColumns,
    onSelect,
    onToggle,
}: {
    user: AccordionTreeUser;
    frame: { top: number; left: number; width: number };
    visibleColumns: ColumnVisibility;
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
                className={`${accordionGridClass} h-14 px-3 py-2`}
                style={getAccordionGridStyle(visibleColumns)}
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

                {visibleColumns.email && (
                    <span className="truncate pr-4 text-sm text-muted-foreground">
                        {isGroup ? '—' : user.email || '—'}
                    </span>
                )}

                {visibleColumns.roles && (
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
                )}

                {visibleColumns.created_at && (
                    <span className="text-sm text-muted-foreground">
                        {user.created_at
                            ? new Date(user.created_at).toLocaleDateString()
                            : '—'}
                    </span>
                )}

                {visibleColumns.actions && (
                    <div className="flex justify-end">
                        <Badge variant="outline">{t('Parent')}</Badge>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function UsersAccordion({
    items,
    memoryCacheKey,
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
    const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(
        () => {
            if (typeof window === 'undefined') return defaultColumnVisibility;

            try {
                const stored = JSON.parse(
                    localStorage.getItem('usersAccordionColumns') || '{}',
                ) as Partial<ColumnVisibility>;

                return {
                    email: stored.email ?? true,
                    roles: stored.roles ?? true,
                    created_at: stored.created_at ?? true,
                    actions: stored.actions ?? true,
                };
            } catch {
                return defaultColumnVisibility;
            }
        },
    );
    const headerRef = useRef<HTMLDivElement | null>(null);
    const treeRef = useRef<HTMLDivElement | null>(null);
    const loadedUsersRef = useRef(new Map<number, AccordionTreeUser>());
    const [stickyParents, setStickyParents] = useState<AccordionTreeUser[]>([]);
    const [stickyFrame, setStickyFrame] = useState({
        top: 0,
        left: 0,
        width: 0,
    });

    const saveVisibleColumns = (columns: ColumnVisibility) => {
        setVisibleColumns(columns);
        if (typeof window !== 'undefined') {
            localStorage.setItem(
                'usersAccordionColumns',
                JSON.stringify(columns),
            );
        }
    };

    const handleColumnVisibilityChange = (
        column: OptionalColumn,
        visible: boolean,
    ) => {
        const next = { ...visibleColumns, [column]: visible };
        saveVisibleColumns(next);

        if (!visible && window.location.search) {
            const url = new URL(window.location.href);
            if (url.searchParams.get('sort') === column) {
                url.searchParams.delete('sort');
                url.searchParams.delete('dir');
                router.visit(url.toString(), { preserveScroll: true });
            }
        }
    };

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
                visibleColumns={visibleColumns}
                onColumnVisibilityChange={handleColumnVisibilityChange}
                onResetColumns={() =>
                    saveVisibleColumns(defaultColumnVisibility)
                }
            />
            {stickyFrame.width > 0 &&
                stickyParents.map((stickyParent, index) => (
                    <StickyParentRow
                        key={stickyParent.id}
                        user={stickyParent}
                        visibleColumns={visibleColumns}
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
                    key={memoryCacheKey}
                    items={items}
                    idKey="id"
                    parentKey="parent_id"
                    depthKey="depth"
                    storageKey="users-accordion"
                    memoryCacheKey={memoryCacheKey}
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
                                visibleColumns={visibleColumns}
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
