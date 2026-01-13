import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditIcon, TrashIcon } from 'lucide-react';
import { type User, PaginatedCollection, SharedData } from '@/types';
import { useI18n } from '@/lib/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { router } from '@inertiajs/react';

interface UsersTableProps {
    users: User[];
    roles: Array<{ id: number; name: string }>;
    auth: SharedData['auth'];
    canEdit?: boolean;
    canDelete?: boolean;
    canPreview?: boolean;
}

export default function UsersTable({ users, roles, auth, canEdit = false, canDelete = false, canPreview = false }: UsersTableProps) {

    const { t } = useI18n();

    const handleRoleChange = (userId: number, roleName: string) => {
        router.post(
            `/settings/users/${userId}/role`,
            { role: roleName },
            {
                preserveScroll: true,
            }
        );
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

    const goToUserPage = (id: number) => {
        window.location.href = `/admin/users/${id}`;
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t('Name')}</TableHead>
                    <TableHead>{t('Email')}</TableHead>
                    <TableHead>{t('Current roles')}</TableHead>
                    {canPreview && <TableHead>{t('Change role')}</TableHead>}
                    <TableHead>{t('Joined')}</TableHead>
                    {(canEdit || canDelete) && <TableHead className="text-end">Actions</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((user) => (
                    <TableRow key={user.id} className="cursor-pointer hover:bg-muted" onClick={() => goToUserPage(user.id!)}>
                        <TableCell className="font-medium">
                            {user.name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
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
                                        >
                                            {role.name}
                                        </Badge>
                                    ))
                                ) : (
                                    <Badge variant="outline">
                                        {t('No role')}
                                    </Badge>
                                )}
                            </div>
                        </TableCell>
                        {canPreview && <TableCell>
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
                                            {role.name}
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
                        }
                        <TableCell className="text-sm text-muted-foreground">
                            {new Date(
                                user.created_at
                            ).toLocaleDateString()}
                        </TableCell>
                        {(canEdit || canDelete) && (
                            <TableCell>
                                <div className="flex gap-2 justify-end">
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
                                    {canDelete && (
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
                ))}
            </TableBody>
        </Table>
    );
}