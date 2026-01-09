import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Head, Link, router, usePage, InfiniteScroll } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

import SettingsLayout from '@/layouts/settings/layout';
import { useI18n } from '@/lib/i18n';
import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { EditIcon, Loader2Icon, TrashIcon, ChevronDown, ChevronRight, GripVertical, SaveIcon, Undo2, Undo2Icon, RotateCcw, UploadIcon } from 'lucide-react';
import SearchSelect from '@/components/app/search-select';
import { CsvUploadFilePond } from '@/components/csv-upload-filepond';
import { isDev, isAdmin, isClient, hasPermission } from '@/lib/roles';
import ProductsTable from '@/components/products/products-table';
import { ProductsCardsList } from '@/components/products/products-cards-list';
import usersRoutes from '@/routes/users';
import UsersTable from '@/components/users/users-table';
import UsersCardsList from '@/components/users/users-cards-list';
import UsersImportTreatment from '@/components/users/import';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ViewModeToggle, type ViewMode } from '@/components/ui/view-mode-toggle';
import SortableTree, { RenderItemProps } from '@/components/sortable-tree';
import { SortableTreeItem } from '@/components/sortable-tree-item';
import { toast } from 'sonner';
import { ButtonsActions } from '@/components/buttons-actions';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users management',
        href: usersRoutes.index().url,
    },
];

interface UsersPageProps {
    collection: {
        data: User[];
        next_page_url?: string | null;
    };
    roles: Array<{ id: number; name: string }>;
    q?: string | null;
    searchPropositions?: string[];
}



export default withAppLayout(
    breadcrumbs,
    true,
    ({ collection, roles, q, searchPropositions = [] }: UsersPageProps) => {

        // console.log(users)
        const { t } = useI18n();
        type TreeUser = User & { depth: number; parent_id: number | null };
        const [pending, setPending] = useState<TreeUser[] | null>(null);
        const [saving, setSaving] = useState(false);
        const [allUsers, setAllUsers] = useState<User[]>(collection?.data || []);
        const [search, setSearch] = useState(q || '');
        const [fetching, setFetching] = useState(false);
        const [searchPropositionsState, setSearchPropositions] = useState<string[]>(searchPropositions ?? []);

        useEffect(() => {
            setAllUsers(collection?.data || []);
        }, [collection]);

        const { auth, locale } = usePage<SharedData>().props;
        const user = auth?.user;
        const isAuthenticated = !!user;
        const canEditProducts = isAdmin(user) || hasPermission(user, 'edit products');
        const canDeleteProducts = isAdmin(user) || hasPermission(user, 'delete products');
        const canImportExportProducts = isAdmin(user) || hasPermission(user, 'import products') || hasPermission(user, 'export products');
        const canManageUsers = isAdmin(user) || hasPermission(user, 'manage users');
        const canPreview = isDev(user) || hasPermission(user, 'preview');


        const breadcrumbs: BreadcrumbItem[] = [
            {
                title: t('Users management'),
                href: '/users',
            },
        ];

        // Vérifier que l'utilisateur est admin
        if (!isAdmin(auth.user)) {
            return (
                <AppLayout breadcrumbs={breadcrumbs}>
                    <Head title={t('Users management')} />
                    <SettingsLayout>
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('Access denied')}</CardTitle>
                                <CardDescription>
                                    {t('You do not have permission to access this page')}
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </SettingsLayout>
                </AppLayout>
            );
        }

        const canEdit = isAdmin(user) || hasPermission(user, 'edit users');
        const canDelete = isAdmin(user) || hasPermission(user, 'delete users');
        const canImportExport = isAdmin(user) || hasPermission(user, 'import users') || hasPermission(user, 'export users');

        // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
        const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

        const [viewMode, setViewMode] = useState<ViewMode>(() => {
            if (typeof window === 'undefined') return 'table';
            const views = JSON.parse(localStorage.getItem('views') || '{}');
            return (views.users || 'table') as ViewMode;
        });

        const handleSearch = (s: string) => {
            setSearch(s);
            // @ts-ignore
            clearTimeout(timerRef.current);
            router.cancelAll();
            if (s.length < 2) {
                return;
            }
            setFetching(true);
            timerRef.current = setTimeout(async () => {
                try {
                    const res = await fetch(`/search-propositions?context=users&q=${encodeURIComponent(s)}&limit=10`);
                    const json = await res.json();
                    setSearchPropositions((json.propositions || []) as string[]);
                } finally {
                    setFetching(false);
                }
            }, 300);
        }

        // @ts-ignore
        const onSelect = (mysearch: string, options?: { force?: boolean }) => {
            const trimmed = (mysearch ?? '').trim();
            // If explicit clear requested, remove q from URL instead of setting q=""
            if (options?.force && trimmed.length === 0) {
                const url = new URL(window.location.href);
                url.searchParams.delete('q');
                router.visit(url.toString(), { replace: true });
                setSearch('');
                return;
            }

            // Otherwise ignore empty submissions
            if (trimmed.length === 0) {
                return;
            }

            // Validation: navigation complète pour réactualiser la page
            setSearch('');
            router.get(window.location.pathname, { q: trimmed }, {
                preserveState: false,
                replace: true,
                preserveScroll: false,
            });

            // console.log("selected:", trimmed);
        };


        const handleRoleChange = (userId: number, roleName: string) => {
            // setUpdating(userId);
            // router.post(
            //     `/settings/users/${userId}/role`,
            //     { role: roleName },
            //     {
            //         preserveScroll: true,
            //         onFinish: () => setUpdating(null),
            //     }
            // );
        };

        const handleEdit = (userId: number) => {
            router.visit(`/admin/users/${userId}/edit`);
        };

        const handleDelete = (userId: number) => {
            if (confirm(t('Are you sure?'))) {
                router.visit(`/admin/users/${userId}/destroy`, {
                    method: 'delete',
                });
            }
        };

        // Construire une liste plate pour le SortableTree avec calcul de depth basé sur parent_id
        const allItems = useMemo<TreeUser[]>(() => {
            const safeUsers = Array.isArray(allUsers) ? allUsers : [];

            // Créer un map id -> user pour accès rapide
            const userMap = new Map<number, any>();
            const usersWithParent = safeUsers
                .filter((u: any) => u && typeof u.id === 'number')
                .map((u: any) => ({
                    ...u,
                    parent_id: (u as any).parent_id ?? null,
                }));

            usersWithParent.forEach(u => userMap.set(u.id, u));

            // Calculer le depth pour chaque user en parcourant la chaîne parent
            return usersWithParent.map((u: any) => {
                let depth = 0;
                let parentId = u.parent_id;
                const visited = new Set<number>();

                while (parentId !== null && !visited.has(parentId)) {
                    visited.add(parentId);
                    const parent = userMap.get(parentId);
                    if (!parent) break;
                    depth++;
                    parentId = parent.parent_id ?? null;
                }

                return {
                    ...u,
                    depth,
                };
            });
        }, [allUsers]);

        const hasChanges = useMemo(() => {
            if (!pending) return false;
            const a = pending.map(i => i.id);
            const b = allItems.map(i => i.id);
            return JSON.stringify(a) !== JSON.stringify(b) ||
                JSON.stringify(pending.map(i => i.parent_id ?? null)) !== JSON.stringify(allItems.map(i => i.parent_id ?? null));
        }, [pending, allItems]);

        const loadChildren = async (): Promise<TreeUser[]> => {
            // Pas de hiérarchie utilisateur à charger côté client pour l'instant
            return [];
        };

        const handleTreeChange = (items: TreeUser[], reason?: 'drag' | 'expand' | 'collapse') => {
            if (reason === 'expand' || reason === 'collapse') return;
            if (reason === 'drag') setPending(items);
        };

        const save = async () => {
            if (!pending) return;

            setSaving(true);
            try {
                const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

                const payload = (() => {
                    const items = pending.map((i: any) => ({
                        id: i.id,
                        parent_id: i.parent_id ?? null,
                        position: 0,
                    }));

                    const posByParent = new Map<number | null, number>();
                    for (const it of items) {
                        const pid = it.parent_id;
                        const pos = posByParent.get(pid) ?? 0;
                        it.position = pos;
                        posByParent.set(pid, pos + 1);
                    }

                    return { items };
                })();

                const reorderUrl = '/admin/users/reorder';
                const res = await fetch(reorderUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': csrf,
                    },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) throw new Error(await res.text());

                toast.success(t('Hierarchy saved successfully'));
                setPending(null);
            } catch (e) {
                console.error(e);
                toast.error(t('Error while saving'));
            } finally {
                setSaving(false);
            }
        };

        const cancel = () => {
            setPending(null);
            router.reload();
        };

        // Rendu personnalisé de chaque item
        const renderItem = (props: RenderItemProps<User>) => {
            const {
                item,
                depth,
                isExpanded,
                toggleExpand,
                isDragging,
                insertLine, // 'before' | 'after' | null
                isInsideTarget, // true = intention "inside"
                isOver, // survol (optionnel pour un léger highlight)
                setNodeRef,
                attributes,
                listeners,
            } = props;

            const hasValidId = !!item && typeof (item as any).id === 'number' && Number.isFinite((item as any).id);
            const displayName = (item as any)?.name ?? '(sans nom)';

            // console.log(item)

            return (
                <div
                    ref={setNodeRef}
                    className={[
                        'relative flex items-center gap-2 px-3 py-2 text-sm',
                        'border-b border-border/30 transition-colors',
                        !isDragging ? 'hover:bg-muted/50' : '',
                        isOver ? 'bg-muted/20' : '',
                        isInsideTarget ? 'bg-primary/10 ring-2 ring-primary/50 ring-offset-1' : '',
                        isDragging ? 'opacity-50' : '',
                    ].join(' ')}
                    style={{
                        marginLeft: depth * 24,
                    }}
                >
                    {!isDragging && (
                        <button
                            type="button"
                            onClick={toggleExpand}
                            className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted flex-shrink-0"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                    )}

                    <div
                        {...listeners}
                        {...attributes}
                        className="flex h-6 w-6 items-center justify-center text-muted-foreground cursor-grab flex-shrink-0"
                        aria-label="Drag"
                    >
                        <GripVertical size={14} />
                    </div>

                    <span className="truncate font-medium flex-1">{displayName}</span>

                    <div className="flex gap-2 justify-end flex-shrink-0">
                        {hasValidId && !isDragging && (
                            <>
                                {canEdit && (
                                    <Button
                                        size="icon"
                                        variant="outline"
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleEdit((item as any).id);
                                        }}
                                    >
                                        <EditIcon size={16} />
                                    </Button>
                                )}
                                {canDelete && (
                                    <Button
                                        size="icon"
                                        variant="destructive-outline"
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            handleDelete((item as any).id);
                                        }}
                                    >
                                        <TrashIcon size={16} />
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            );
        };

        // console.log(usersRoutes.import.process.url())
        return (
            <div>
                <Head title="Users" />
                <StickyBar
                    zIndex={20}
                    borderBottom={false}
                    className='mb-4'
                >
                    <ViewModeToggle
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        pageKey="users"
                        modes={['table', 'grid', 'tree']}
                    />
                    <div className="w-200 left-0 top-1 mr-2">
                        <SearchSelect
                            value={search}
                            onChange={handleSearch}
                            onSubmit={onSelect}
                            propositions={searchPropositionsState}
                            loading={fetching}
                            count={(collection as any)?.meta?.total ?? collection?.data?.length ?? 0}
                            query={q ?? ''}
                            minQueryLength={2}
                        />
                    </div>

                    {canImportExport && (
                        <ButtonsActions
                            cancel={hasChanges ? cancel : undefined}
                            save={hasChanges ? save : undefined}
                            saving={saving}
                            import={
                                <CsvUploadFilePond
                                    title="Upload CSV"
                                    description="Uploadez un fichier CSV"
                                    uploadUrl="/upload"
                                    importProcessUrl={usersRoutes.import.process.url()}
                                    importProcessChunkUrl={usersRoutes.import.process_chunk.url()}
                                    importCancelUrl={usersRoutes.import.cancel.url()}
                                    importProgressUrl={(id) => usersRoutes.import.progress.url({ id })}
                                    postTreatmentComponent={UsersImportTreatment}
                                    successRedirectUrl={usersRoutes.index().url}
                                    buttonLabel=""
                                />
                            }
                            export={"/admin/users/export"}
                            add={() => {
                                router.visit('/admin/users/create');
                            }}
                        />

                    )}
                </StickyBar>

                {viewMode === 'table' ? (
                    <InfiniteScroll data="collection" className=''>
                        <UsersTable
                            users={allUsers}
                            roles={roles}
                            auth={auth}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            canPreview={canPreview}
                        />
                    </InfiniteScroll>
                ) : viewMode === 'grid' ? (
                    <InfiniteScroll data="collection" className=''>
                        <UsersCardsList
                            users={allUsers}
                            roles={roles}
                            auth={auth}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            canChangeRole={canPreview}
                        />
                    </InfiniteScroll>
                ) : (
                    <div className="space-y-2">
                        <div className="border rounded-md overflow-hidden">
                            <SortableTree
                                items={allItems}
                                idKey="id"
                                parentKey="parent_id"
                                depthKey="depth"
                                loadChildren={loadChildren}
                                onChange={handleTreeChange}
                                renderItem={renderItem}
                            />
                        </div>
                    </div>
                )}
            </div>

        );

    })


function DownloadCsvButton() {
    return (
        <a href="/admin/users/export" className="clickable inline-flex items-center border px-3 py-1 rounded text-sm">
            <UploadIcon />
        </a>
    );
}