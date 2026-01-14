import React, { useState } from "react";
import { Link, router } from "@inertiajs/react";
import { useI18n } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit as EditIcon, Trash as TrashIcon, Check as CheckIcon, X as XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type Product, User } from "@/types";


// UserCard types and component
type UserCardProps = {
    user: User;
    roles: Array<{ id: number; name: string }>;
    currentUser?: User | null;
    canEdit?: boolean;
    canDelete?: boolean;
    canChangeRole?: boolean;
    editUser?: (userId: number) => void;
    deleteUser?: (userId: number) => void;
    changeUserRole?: (userId: number, roleName: string) => void;
    className?: string;
};

export function UserCard({
    user,
    roles,
    currentUser,
    canEdit = false,
    canDelete = false,
    canChangeRole = false,
    editUser,
    deleteUser,
    changeUserRole,
    className
}: UserCardProps) {
    const { t } = useI18n();
    const [isUpdating, setIsUpdating] = useState(false);

    const handleEdit = (id: number) => {
        if (editUser) return editUser(id);
        router.visit(`/admin/users/${id}/edit`);
    };

    const handleDelete = (id: number) => {
        if (deleteUser) return deleteUser(id);
        if (confirm(t('Êtes-vous sûr de vouloir supprimer cet utilisateur ?'))) {
            router.visit(`/admin/users/${id}/destroy`, {
                method: 'delete',
            });
        }
    };

    const handleRoleChange = (roleValue: string) => {
        if (changeUserRole) {
            changeUserRole(user.id, roleValue);
        } else {
            setIsUpdating(true);
            router.post(
                `/settings/users/${user.id}/role`,
                { role: roleValue },
                {
                    preserveScroll: true,
                    onFinish: () => setIsUpdating(false),
                }
            );
        }
    };

    const isCurrentUser = currentUser?.id === user.id;

    return (
        <Link
            key={user.id}
            href={'/admin/users/' + user.id}
            className="no-underline group hover:no-underline hover:scale-102 transition-transform duration-300"
            aria-label={`Voir ${name}`}
        >
            <Card className={`relative h-105 w-75 flex flex-col p-4 gap-4 ${className ?? ""}`}>
                <CardHeader className="p-0">
                    <CardTitle className="text-lg font-semibold">
                        {user.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                        {user.email}
                    </p>
                </CardHeader>

                <CardContent className="p-0 flex-1 space-y-3">
                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                            {t('Rôles actuels')}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
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
                    </div>

                    {canChangeRole && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                                {t('Change role')}
                            </p>
                            <Select
                                onValueChange={handleRoleChange}
                                disabled={isUpdating || isCurrentUser}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder={t('Select role')} />
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
                            {isCurrentUser && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                    {t('Cannot modify your own role')}
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                            {t('Joined')}
                        </p>
                        <p className="text-sm">
                            {new Date(user.created_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>
                    </div>
                </CardContent>

                <div className="w-full h-1 bg-black/10 dark:bg-accent rounded" />

                <CardFooter className="w-full flex justify-end gap-2 p-0">
                    <div className="flex gap-2">
                        {canEdit && (
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEdit(user.id);
                                }}
                                title={t('Edit')}
                            >
                                <EditIcon size={16} />
                            </Button>
                        )}
                        {canDelete && (
                            <Button
                                size="icon"
                                variant="destructive-outline"
                                onClick={(e: React.MouseEvent) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDelete(user.id);
                                }}
                                title={t('Delete')}
                            >
                                <TrashIcon size={16} />
                            </Button>
                        )}
                    </div>
                </CardFooter>
            </Card>
        </Link>
    );
}