import { send } from '@/routes/verification';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';

import DeleteUser from '@/components/users/delete-user';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectWithItems } from '@/components/ui/select-with-items';
import { Badge } from '@/components/ui/badge';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit, update } from '@/routes/profile';
import { useI18n } from '@/lib/i18n';
import { isAdmin } from '@/lib/roles';

export default function Profile({
    mustVerifyEmail,
    status,
    editingUser,
}: {
    mustVerifyEmail: boolean;
    status?: string;
    // Optional user being edited (when an admin edits another user)
    editingUser?: User;
}) {
    const { auth, locale } = usePage<SharedData>().props as SharedData & { locale?: string };
    const { t } = useI18n();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Profile settings'),
            href: edit().url,
        },
    ];

    const targetUser = editingUser ?? auth.user;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Profile settings')} />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall
                        title={t('Profile information')}
                        description={t('Update your name and email address')}
                    />

                    <Form
                        // If editing another user, POST to admin update route, otherwise use current profile update
                        action={editingUser ? `/admin/users/${targetUser?.id}` : undefined}
                        method={editingUser ? 'post' : undefined}
                        options={{
                            preserveScroll: true,
                        }}
                        className="space-y-6"
                    >
                        {({ processing, recentlySuccessful, errors }) => (
                            <>
                                {/* When editing another user, spoof PUT for RESTful update */}
                                {editingUser && <input type="hidden" name="_method" value="PUT" />}

                                <div className="grid gap-2">
                                    <Label htmlFor="name">{t('Name')}</Label>

                                    <Input
                                        id="name"
                                        className="mt-1 block w-full"
                                        defaultValue={(targetUser as any)?.name || ''}
                                        name="name"
                                        required
                                        autoComplete="name"
                                        placeholder={t('Full name')}
                                    />

                                    <InputError
                                        className="mt-2"
                                        message={errors.name}
                                    />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="email">{t('Email address')}</Label>

                                    <Input
                                        id="email"
                                        type="email"
                                        className="mt-1 block w-full"
                                        defaultValue={(targetUser as any)?.email || ''}
                                        name="email"
                                        required
                                        autoComplete="username"
                                        placeholder={t('Email address')}
                                    />

                                    <InputError
                                        className="mt-2"
                                        message={errors.email}
                                    />
                                </div>

                                {/* Section Rôles */}
                                {targetUser?.roles && targetUser.roles.length > 0 && (
                                    <div className="grid gap-2">
                                        <Label>{t('Roles')}</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {targetUser.roles.map((role) => (
                                                <Badge key={role.id} variant="secondary">
                                                    {role.name}
                                                </Badge>
                                            ))}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {t('Current roles in the system')}
                                        </p>
                                    </div>
                                )}

                                {/* Section Permissions (affiché si l'éditeur est admin) */}
                                {isAdmin(auth.user) && targetUser?.permissions && targetUser.permissions.length > 0 && (
                                    <div className="grid gap-2">
                                        <Label>{t('Permissions')}</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {targetUser.permissions.map((permission) => (
                                                <Badge key={permission.id} variant="outline" className="text-xs">
                                                    {permission.name}
                                                </Badge>
                                            ))}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {t('Permissions for this user')}
                                        </p>
                                    </div>
                                )}

                                {mustVerifyEmail &&
                                    (targetUser as any)?.email_verified_at === null && (
                                        <div>
                                            <p className="-mt-4 text-sm text-muted-foreground">
                                                {t('The user email address is unverified.')}{' '}
                                                {/* Only allow resend for own profile */}
                                                {!editingUser && (
                                                    <Link
                                                        href={send()}
                                                        as="button"
                                                        className="text-foreground underline decoration-neutral-300 underline-offset-4 transition-colors duration-300 ease-out hover:decoration-current! dark:decoration-neutral-500"
                                                    >
                                                        {t('Click here to resend the verification email.')}
                                                    </Link>
                                                )}
                                            </p>

                                            {status ===
                                                'verification-link-sent' && (
                                                    <div className="mt-2 text-sm font-medium text-green-600">{t('A new verification link has been sent to the email address.')}</div>
                                                )}
                                        </div>
                                    )}

                                <div className="flex items-center gap-4">
                                    <Button
                                        disabled={processing}
                                        data-test="update-profile-button"
                                    >
                                        {t('Save')}
                                    </Button>

                                    <Transition
                                        show={recentlySuccessful}
                                        enter="transition ease-in-out"
                                        enterFrom="opacity-0"
                                        leave="transition ease-in-out"
                                        leaveTo="opacity-0"
                                    >
                                        <p className="text-sm text-neutral-600">{t('Saved')}</p>
                                    </Transition>
                                </div>
                            </>
                        )}
                    </Form>
                </div>

                <DeleteUser />
            </SettingsLayout>
        </AppLayout>
    );
}
