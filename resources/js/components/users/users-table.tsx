import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditIcon, TrashIcon, UserCheck } from 'lucide-react';
import { type User, SharedData } from '@/types';
import { useI18n } from '@/lib/i18n';
import { router } from '@inertiajs/react';

interface UsersTableProps {
    users: User[];
    roles: Array<{ id: number; name: string }>;
    auth: SharedData['auth'];
    canEdit?: boolean;
    canDelete?: boolean;
    canPreview?: boolean;
    canImpersonate?: boolean;
    onImpersonate?: (userId: number) => void;
}

export default function UsersTable({ users, roles, auth, canEdit = false, canDelete = false, canPreview = false, canImpersonate = false, onImpersonate }: UsersTableProps) {

    const { t } = useI18n();
    void roles;
    void auth;
    void canPreview;

    const handleEdit = (userId: number) => {
        router.visit(`/admin/users/${userId}/edit`);
    };

    const handleDelete = (userId: number) => {
        if (confirm(t('Are you sure?'))) {
            router.delete(`/admin/users/${userId}`, {
                preserveScroll: true,
                preserveState: true,
            });
        }
    };

    const goToUserPage = (id: number) => {
        window.location.href = `/admin/users/${id}/edit`;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead></TableHead>
                    <SortableTableHead field="name">{t('Name')}</SortableTableHead>
                    <SortableTableHead field="email">{t('Email')}</SortableTableHead>
                    <SortableTableHead field="roles">{t('Current roles')}</SortableTableHead>
                    {/* {canPreview && <TableHead>{t('Change role')}</TableHead>} */}
                    <SortableTableHead field="created_at">{t('Joined')}</SortableTableHead>
                    {(canEdit || canDelete || canImpersonate) && <TableHead className="text-end">Actions</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((user) => {
                    const isGroup = (user.roles ?? []).some((role) => role.name === 'group');
                    return (
                        <TableRow key={user.id} className="cursor-pointer hover:bg-muted" onClick={() => goToUserPage(user.id!)}>
                            <TableCell>
                                {user.logo_url ? (
                                    <img
                                        src={user.logo_url}
                                        alt={user.name}
                                        className="size-12 rounded-lg border object-contain shrink-0"
                                    />
                                ) : (
                                    <div className="flex size-12 items-center justify-center rounded-lg border bg-muted text-muted-foreground text-sm font-medium shrink-0">
                                        {user.name?.charAt(0)?.toUpperCase() ?? '?'}
                                    </div>
                                )}
                            </TableCell>
                            <TableCell className="font-medium">
                                {user.name}
                            </TableCell>
                            <TableCell>{isGroup ? '' : user.email}</TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {user.roles && user.roles.length > 0 ? (
                                        user.roles.map((role) => (
                                            <Badge
                                                key={role.id}
                                                variant={
                                                    role.name === 'dev'
                                                        ? 'destructive'
                                                        : role.name === 'admin'
                                                            ? 'default'
                                                            : role.name === 'client'
                                                                ? 'secondary'
                                                                : 'outline'
                                                }
                                                className={
                                                    role.name === 'commercial'
                                                        ? 'border-transparent bg-blue-500 text-white hover:bg-blue-500/90'
                                                        : role.name === 'group'
                                                            ? 'border-transparent bg-purple-500 text-white hover:bg-purple-500/90'
                                                            : role.name === 'supplier'
                                                                ? 'border-transparent bg-amber-500 text-white hover:bg-amber-500/90'
                                                                : undefined
                                                }
                                            >
                                                {t(role.name)}
                                            </Badge>
                                        ))
                                    ) : (
                                        <Badge variant="outline">
                                            {t('No role')}
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            {/* {canPreview && <TableCell>
                            <Select
                                onValueChange={(value) =>
                                    handleRoleChange(user.id, value)
                                }
                                disabled={user.id === auth.user?.id}
                            >
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue
                                        placeholder={t('Select role')}
                                    />
                                </SelectTrigger>
                                <SelectContent>
                                    {roles.map((role) => (
                                        <SelectItem
                                            key={role.id}
                                            value={role.name}
                                        >
                                            {t(role.name)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {user.id === auth.user?.id && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {t('Cannot modify your own role')}
                                </p>
                            )}
                        </TableCell>
                        } */}
                            <TableCell className="text-sm text-muted-foreground">
                                {user.created_at
                                    ? new Date(user.created_at).toLocaleDateString()
                                    : '—'}
                            </TableCell>
                            {(canEdit || canDelete || canImpersonate) && (
                                <TableCell>
                                    <div className="flex gap-2 justify-end">
                                        {canImpersonate && user.abilities?.impersonate && onImpersonate && (
                                            <Button
                                                size="icon"
                                                variant="secondary"
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    onImpersonate(user.id);
                                                }}
                                            >
                                                <UserCheck size={16} />
                                            </Button>
                                        )}
                                        {canEdit && (
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    handleEdit(user.id);
                                                }}
                                            >
                                                <EditIcon size={16} />
                                            </Button>
                                        )}
                                        {canDelete && user.id !== 1 && (
                                            <Button
                                                size="icon"
                                                variant="destructive-outline"
                                                onClick={(e: React.MouseEvent) => {
                                                    e.stopPropagation();
                                                    handleDelete(user.id);
                                                }}
                                            >
                                                <TrashIcon size={16} />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
