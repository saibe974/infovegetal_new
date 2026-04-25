import { PaginatedCollection, type BreadcrumbItem, type SharedData, type User } from '@/types';
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
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { EditIcon, Loader2Icon, TrashIcon, ChevronDown, ChevronRight, GripVertical, SaveIcon, Undo2, Undo2Icon, RotateCcw, UploadIcon, UserCheck } from 'lucide-react';
import SearchSelect from '@/components/app/search-select';
import { DialogUpload } from '@/components/dialog-upload';
import { canAccessUsers, canCreateUsers, getEffectiveUser, isDev, isAdmin, isClient, hasPermission } from '@/lib/roles';
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
import { take as impersonateTake } from '@/actions/App/Http/Controllers/ImpersonationController';

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
        meta: {
            total: number;
            per_page: number;
            current_page: number;
            last_page: number;
        }
    };
    roles: Array<{ id: number; name: string }>;
    q?: string | null;
    searchPropositions?: string[];
}

const dedupeUsersById = (users: User[]): User[] => {
    const seen = new Set<number>();
    const unique: User[] = [];

    for (const user of users) {
        if (!user || typeof user.id !== 'number' || seen.has(user.id)) {
            continue;
        }
        seen.add(user.id);
        unique.push(user);
    }

    return unique;
};



export default withAppLayout(
    breadcrumbs,
    true,
    ({ collection, roles, q, searchPropositions = [] }: UsersPageProps) => {

        // console.log(collection)
        const { t } = useI18n();
        type TreeUser = User & { depth: number; parent_id: number | null; has_children?: boolean };
        const [pending, setPending] = useState<TreeUser[] | null>(null);
        const [treeSearchItems, setTreeSearchItems] = useState<TreeUser[] | null>(null);
        const [treeSearchExpandedIds, setTreeSearchExpandedIds] = useState<number[]>([]);
        const [treeSearchLoading, setTreeSearchLoading] = useState(false);
        const [saving, setSaving] = useState(false);
        const [allUsers, setAllUsers] = useState<User[]>(() => dedupeUsersById(collection?.data || []));
        const [search, setSearch] = useState(q || '');
        const [fetching, setFetching] = useState(false);
        const [searchPropositionsState, setSearchPropositions] = useState<string[]>(searchPropositions ?? []);

        useEffect(() => {
            setAllUsers(dedupeUsersById(collection?.data || []));
        }, [collection]);

        const { auth, locale } = usePage<SharedData>().props;
        const user = auth?.user;
        const effectiveUser = getEffectiveUser(auth);
        const isAuthenticated = !!user;
        const canManageUsers = canAccessUsers(effectiveUser);
        const canPreview = isDev(effectiveUser) || hasPermission(effectiveUser, 'preview');


        const breadcrumbs: BreadcrumbItem[] = [
            {
                title: t('Users management'),
                href: '/users',
            },
        ];

        if (!canManageUsers) {
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

        const canEdit = isAdmin(effectiveUser) || isDev(effectiveUser) || hasPermission(effectiveUser, 'edit users') || hasPermission(effectiveUser, 'manage users');
        const canDelete = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'delete users') || hasPermission(effectiveUser, 'manage users');
        const canImportExport = isAdmin(effectiveUser) || hasPermission(effectiveUser, 'import users') || hasPermission(effectiveUser, 'export users') || hasPermission(effectiveUser, 'manage users');
        const canAddUsers = canCreateUsers(effectiveUser);
        const canImpersonateUsers = !auth?.impersonate_from;

        // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
        const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

        const [viewMode, setViewMode] = useState<ViewMode>(() => {
            if (typeof window === 'undefined') return 'table';
            const views = JSON.parse(localStorage.getItem('views') || '{}');
            return (views.users || 'table') as ViewMode;
        });

        const treeSearchQuery = (q ?? '').trim();
        const isTreeSearchMode = viewMode === 'tree' && treeSearchQuery.length > 0;

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
                router.delete(`/admin/users/${userId}`, {
                    preserveScroll: true,
                    preserveState: true,
                    onError: () => toast.error(t('Error while deleting user')),
                });
            }
        };

        const handleImpersonate = (targetUserId: number) => {
            if (!canImpersonateUsers) {
                return;
            }

            const url = impersonateTake({ id: targetUserId }).url;
            window.location.href = url;
        };

        const hasChanges = useMemo(() => !isTreeSearchMode && pending !== null, [pending, isTreeSearchMode]);

        useEffect(() => {
            if (!isTreeSearchMode) {
                setTreeSearchItems(null);
                setTreeSearchExpandedIds([]);
                setTreeSearchLoading(false);
                return;
            }

            const controller = new AbortController();
            setTreeSearchLoading(true);

            fetch(`/admin/users/tree-search?q=${encodeURIComponent(treeSearchQuery)}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                signal: controller.signal,
            })
                .then(async (response) => {
                    if (!response.ok) {
                        throw new Error('Failed to load users tree search fragment');
                    }
                    return response.json();
                })
                .then((payload) => {
                    const nextItems = ((payload.items || []) as any[]).map((item) => ({
                        ...item,
                        parent_id: item.parent_id ?? null,
                        depth: Number(item.depth ?? 0),
                        has_children: Boolean(item.has_children),
                    })) as TreeUser[];

                    setTreeSearchItems(nextItems);
                    setTreeSearchExpandedIds(
                        (payload.expanded_ids || [])
                            .map((id: unknown) => Number(id))
                            .filter((id: number) => Number.isFinite(id)),
                    );
                })
                .catch((error) => {
                    if (error?.name === 'AbortError') {
                        return;
                    }
                    console.error(error);
                    toast.error(t('Error while loading tree search'));
                })
                .finally(() => {
                    if (!controller.signal.aborted) {
                        setTreeSearchLoading(false);
                    }
                });

            return () => {
                controller.abort();
            };
        }, [isTreeSearchMode, treeSearchQuery]);

        const loadTreePage = async (
            parent: TreeUser | null,
            args: { offset: number; limit: number },
        ): Promise<{ items: TreeUser[]; hasMore: boolean; nextOffset: number }> => {
            const params = new URLSearchParams();
            params.set('offset', String(args.offset));
            params.set('limit', String(args.limit));

            if (parent && parent.id) {
                params.set('parent_id', String(parent.id));
            }

            const currentSearch = (search || '').trim();
            if (currentSearch.length >= 2) {
                params.set('q', currentSearch);
            }

            const response = await fetch(`/admin/users/tree-children?${params.toString()}`, {
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                throw new Error('Failed to load users tree page');
            }

            const payload = await response.json();
            const parentDepth = parent?.depth ?? -1;
            const items = (payload.items || []).map((item: any) => ({
                ...item,
                parent_id: item.parent_id ?? (parent ? parent.id : null),
                depth:
                    item.depth !== null &&
                        item.depth !== undefined &&
                        Number.isFinite(Number(item.depth))
                        ? Number(item.depth)
                        : parentDepth + 1,
                has_children: Boolean(item.has_children),
            }));

            return {
                items,
                hasMore: Boolean(payload.has_more),
                nextOffset: Number(payload.next_offset ?? (args.offset + items.length)),
            };
        };

        const handleTreeChange = (items: TreeUser[], reason?: 'drag' | 'expand' | 'collapse' | 'lazy-load') => {
            if (isTreeSearchMode) return;
            if (reason === 'expand' || reason === 'collapse') return;
            if (reason === 'lazy-load') return;
            if (reason === 'drag') {
                // Réordonner en parcours DFS pour garantir parent avant enfants
                const reorderedItems = (() => {
                    const result: TreeUser[] = [];
                    const visited = new Set<number>();

                    const dfs = (parentId: number | null) => {
                        for (const item of items) {
                            if (visited.has(item.id)) continue;
                            if ((item.parent_id ?? null) !== parentId) continue;

                            visited.add(item.id);
                            result.push(item);
                            dfs(item.id);
                        }
                    };

                    dfs(null);
                    return result;
                })();

                setPending(reorderedItems);
            }
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
                console.log("Saving hierarchy payload:", payload);
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

                // Refetch users to update the tree with fresh nested set values
                // router.reload({ preserveState: false });
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
        const renderItem = (props: RenderItemProps<User>) => (
            <SortableTreeItem
                props={props}
                hasChildren={(item) => Boolean((item as any)?.has_children)}
                nameHref={(item) => '/admin/users/' + item.id}
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={(item) => handleEdit(item.id)}
                onDelete={(item) => handleDelete(item.id)}
                extraContent={(item) => (
                    canImpersonateUsers && item.abilities?.impersonate ? (
                        <Button
                            size="icon"
                            variant="secondary"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleImpersonate(item.id);
                            }}
                            title={t('Impersonate')}
                        >
                            <UserCheck size={16} />
                        </Button>
                    ) : null
                )}
            />
        );

        const uniqueCount = allUsers.length;

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

                    {(canImportExport || canAddUsers || hasChanges) && (
                        <ButtonsActions
                            cancel={hasChanges ? cancel : undefined}
                            save={hasChanges ? save : undefined}
                            saving={saving}
                            import={canImportExport ? (
                                <DialogUpload
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
                            ) : undefined}
                            export={canImportExport ? "/admin/users/export" : undefined}
                            add={canAddUsers ? () => {
                                router.visit('/admin/users/create');
                            } : undefined}
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
                            canImpersonate={canImpersonateUsers}
                            onImpersonate={handleImpersonate}
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
                            canImpersonate={canImpersonateUsers}
                            impersonateUser={handleImpersonate}
                        />
                    </InfiniteScroll>
                ) : (
                    <div className="space-y-2">
                        {isTreeSearchMode && treeSearchLoading && (
                            <div className="text-sm text-muted-foreground px-1">Chargement du fragment...</div>
                        )}
                        <div className="border rounded-md overflow-hidden">
                            <SortableTree
                                items={isTreeSearchMode ? (treeSearchItems ?? []) : (pending ?? [])}
                                idKey="id"
                                parentKey="parent_id"
                                depthKey="depth"
                                storageKey="users"
                                expandOnInside={false}
                                forcedExpandedIds={isTreeSearchMode ? treeSearchExpandedIds : undefined}
                                lazy={isTreeSearchMode ? undefined : {
                                    pageSize: 30,
                                    loadPage: loadTreePage,
                                }}
                                onChange={handleTreeChange}
                                renderItem={renderItem}
                            />
                        </div>
                    </div>
                )}

                {uniqueCount < collection.meta.total && (viewMode === 'table' || viewMode === 'grid') &&
                    <div className='w-full h-50 flex items-center justify-center mt-4'>
                        <Loader2Icon size={50} className='animate-spin text-brand-main' />
                    </div>
                }

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
