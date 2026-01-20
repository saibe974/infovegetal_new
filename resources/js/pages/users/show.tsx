import { Button } from '@/components/ui/button';
import Heading from '@/components/heading';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import type { BreadcrumbItem, ProductDetailed, SharedData, User } from '@/types';
import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeftCircle, LinkIcon, SaveIcon, Mail, Calendar, Shield, Lock, EditIcon, TrashIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import SearchSoham from '@/components/app/search-select';
import { useState } from 'react';
import users from '@/routes/users';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/lib/i18n';
import { hasPermission, isAdmin } from '@/lib/roles';

type Props = {
    user: User;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: users.index().url,
    },
];

const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default withAppLayout<Props>(breadcrumbs, false, ({ user }) => {
    const { t } = useI18n();

    const { auth, locale } = usePage<SharedData>().props;
    const userAuth = auth?.user;
    const canEdit = isAdmin(userAuth) || hasPermission(userAuth, 'edit products');
    const canDelete = isAdmin(userAuth) || hasPermission(userAuth, 'delete products');

    const handleDelete = (userId: number) => {
        if (confirm(t('Are you sure?'))) {
            router.visit(`/admin/users/${userId}/destroy`, {
                method: 'delete',
            });
        }
    };
    // console.log(user)
    return (
        <div className="space-y-6">
            <Head title={t(`Profile ${user.name}`)} />
            {/* Header */}
            <div className="flex items-center justify-between gap-4 py-2">
                <div className="flex items-center gap-4">
                    <Link href="#"
                        onClick={(e) => { e.preventDefault(); window.history.back(); }}
                        className='hover:text-gray-500 transition-colors duration-200'
                    >
                        <ArrowLeftCircle size={35} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold capitalize">{user.name}</h1>
                        <p className="text-gray-500">{user.email}</p>
                    </div>
                </div>
                <div className='flex gap-3 items-center'>
                    {user.email_verified_at ? (
                        <Badge variant="default" className="bg-green-500 h-fit hidden sm:block">{t('Email Verified')}</Badge>
                    ) : (
                        <Badge variant="destructive" className="h-fit hidden sm:block">{t('Not Verified')}</Badge>
                    )}
                    <div className="flex gap-3">
                        {canEdit && (
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    router.visit(`/admin/users/${user.id}/edit`);
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
                </div>
            </div>

            {/* User Info */}
            <div className='w-full max-w-[1200px] md:mx-auto flex flex-col gap-5'>
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Mail size={20} />
                        {t('User Information')}
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">{t('Email')}</p>
                            <p className="font-medium">{user.email}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('User ID')}</p>
                            <p className="font-medium">#{user.id}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('Created')}</p>
                            <p className="font-medium text-sm">{formatDate(user.created_at)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">{t('Updated')}</p>
                            <p className="font-medium text-sm">{formatDate(user.updated_at)}</p>
                        </div>

                        <div className="">
                            <p className="text-sm text-gray-500">{t('Email Verified At')}</p>
                            {user.email_verified_at ? (
                                <p className="font-medium text-sm">
                                    {formatDate(user.email_verified_at)}
                                </p>
                            ) : (
                                <Badge variant="destructive">{t('Not Verified')}</Badge>
                            )
                            }
                        </div>

                        {user.parent ? (
                            <div className="">
                                <p className="text-sm text-gray-500">{t('Parent User')}</p>
                                <Link
                                    href={users.show((user.parent as User).id).url}
                                    className="font-medium text-blue-500 hover:text-blue-700 hover:underline"
                                >
                                    {(user.parent as User).name}
                                </Link>
                            </div>
                        ) : null}

                    </div>
                </Card>

                {/* Roles */}
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Shield size={20} />
                        {t('Roles')} ({user.roles?.length || 0})
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {user.roles && user.roles.length > 0 ? (
                            user.roles.map((role: any) => (
                                <Badge key={role.id} variant="secondary" className="bg-blue-100 text-blue-800">
                                    {role.name}
                                </Badge>
                            ))
                        ) : (
                            <p className="text-gray-500 text-sm">{t('No roles assigned')}</p>
                        )}
                    </div>
                </Card>

                {/* Permissions */}
                <Card className="p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Lock size={20} />
                        {t('Permissions')} ({user.permissions?.length || 0})
                    </h2>
                    <div className="flex flex-wrap gap-2 max-h-96 overflow-y-auto">
                        {user.permissions && user.permissions.length > 0 ? (
                            user.permissions.map((perm: any) => (
                                <Badge key={perm.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                    {perm.name}
                                </Badge>
                            ))
                        ) : (
                            <p className="text-gray-500 text-sm">{t('No permissions assigned')}</p>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
});