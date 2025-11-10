import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';

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
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { useI18n } from '@/lib/i18n';
import { isAdmin } from '@/lib/roles';

interface UsersPageProps {
    users: User[];
    roles: Array<{ id: number; name: string }>;
}

export default function Users({ users, roles }: UsersPageProps) {
    const { auth } = usePage<SharedData>().props;
    const { t } = useI18n();
    const [updating, setUpdating] = useState<number | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Users management'),
            href: '/settings/users',
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

    const handleRoleChange = (userId: number, roleName: string) => {
        setUpdating(userId);
        router.post(
            `/settings/users/${userId}/role`,
            { role: roleName },
            {
                preserveScroll: true,
                onFinish: () => setUpdating(null),
            }
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Users management')} />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title={t('Users management')}
                        description={t('Manage user roles and permissions')}
                    />

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('All users')}</CardTitle>
                            <CardDescription>
                                {t('View and modify user roles')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>{t('Name')}</TableHead>
                                        <TableHead>{t('Email')}</TableHead>
                                        <TableHead>{t('Current roles')}</TableHead>
                                        <TableHead>{t('Change role')}</TableHead>
                                        <TableHead className="text-right">{t('Joined')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => (
                                        <TableRow key={user.id}>
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
                                                                    role.name === 'admin'
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
                                            <TableCell>
                                                <Select
                                                    onValueChange={(value) =>
                                                        handleRoleChange(user.id, value)
                                                    }
                                                    disabled={
                                                        updating === user.id ||
                                                        user.id === auth.user?.id
                                                    }
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
                                            <TableCell className="text-right text-sm text-muted-foreground">
                                                {new Date(
                                                    user.created_at
                                                ).toLocaleDateString()}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
