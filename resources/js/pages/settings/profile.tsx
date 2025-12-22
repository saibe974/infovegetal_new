import { send } from '@/routes/verification';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage, router } from '@inertiajs/react';
import { useState, useEffect, useMemo } from 'react';

import DeleteUser from '@/components/users/delete-user';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectWithItems } from '@/components/ui/select-with-items';
import { Badge } from '@/components/ui/badge';
import SearchSelect from '@/components/app/search-select';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit, update } from '@/routes/users';
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
    const pageProps = usePage().props as any;
    const errors = pageProps.errors ?? {};
    const { t } = useI18n();
    const targetUser = editingUser ?? auth.user;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Profile settings'),
            href: edit(targetUser!.id).url,
        },
    ];


    // All possible roles/permissions provided by controller
    const allRoles = (usePage().props as any).allRoles ?? [];
    const allPermissions = (usePage().props as any).allPermissions ?? [];

    const [roleSearch, setRoleSearch] = useState('');
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>((targetUser?.roles ?? []).map((r: any) => r.id));

    const [permissionSearch, setPermissionSearch] = useState('');
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>((targetUser?.permissions ?? []).map((p: any) => p.id));

    // Keep selected role/permission ids in sync when targetUser changes (e.g. admin editing another user)
    useEffect(() => {
        setSelectedRoleIds((targetUser?.roles ?? []).map((r: any) => r.id));
        setSelectedPermissionIds((targetUser?.permissions ?? []).map((p: any) => p.id));
    }, [targetUser?.id]);

    // Compute inherited permissions from selected roles
    const inheritedPermissionIds = useMemo(() => {
        const set = new Set<number>();
        (selectedRoleIds || []).forEach((rid) => {
            const role = (allRoles as any[]).find((r) => r.id === rid);
            if (role && role.permissions) {
                role.permissions.forEach((p: any) => set.add(p.id));
            }
        });
        return Array.from(set);
    }, [selectedRoleIds, allRoles]);

    // Permissions to display (union of inherited and explicitly selected)
    const displayedPermissionIds = useMemo(() => {
        const set = new Set<number>([...(inheritedPermissionIds || []), ...(selectedPermissionIds || [])]);
        return Array.from(set);
    }, [inheritedPermissionIds, selectedPermissionIds]);

    // Merge allPermissions names with inherited permission names so propositions include both
    const mergedPermissionPropositions = useMemo(() => {
        const names = new Set<string>();
        (allPermissions || []).forEach((p: any) => names.add(p.name));

        // ensure inherited permissions from roles are present
        (inheritedPermissionIds || []).forEach((pid) => {
            const p = (allPermissions as any[]).find((x) => x.id === pid) || (targetUser?.permissions ?? []).find((x: any) => x.id === pid);
            if (p) names.add(p.name);
        });

        return Array.from(names);
    }, [allPermissions, inheritedPermissionIds, targetUser?.permissions]);


    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Profile settings')} />

            <SettingsLayout>
                <div className="space-y-6">
                    {/* <HeadingSmall
                        title={t('Profile information')}
                        description={t('Update your name and email address')}
                    /> */}

                    <form
                        className="space-y-6"
                        onSubmit={(e) => {
                            e.preventDefault();

                            const form = e.currentTarget as HTMLFormElement;
                            const formData = new FormData(form);

                            const payload: any = {
                                name: String(formData.get('name') || ''),
                                email: String(formData.get('email') || ''),
                            };

                            // Attach roles/permissions arrays from state
                            payload.roles = selectedRoleIds;
                            payload.permissions = selectedPermissionIds;

                            // Use PUT for admin edit; use PATCH for own profile (settings route expects PATCH)
                            if (editingUser) {
                                router.put(`/admin/users/${targetUser?.id}`, payload, {
                                    preserveScroll: true,
                                });
                            } else {
                                // settings/profile route uses PATCH — include target user id
                                router.patch(update((editingUser ?? auth.user)!.id).url, payload, {
                                    preserveScroll: true,
                                });
                            }
                        }}
                    >
                        <>
                            {/* When editing another user, spoof PUT for RESTful update (kept for compatibility) */}
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
                            <div className="grid gap-2">
                                <Label>{t('Roles')}</Label>
                                <div>
                                    <SearchSelect
                                        value={roleSearch}
                                        onChange={(v) => setRoleSearch(v)}
                                        onSubmit={(s) => {
                                            const names = s && s.trim() ? s.trim().split(/\s+/) : [];
                                            const ids = (names || []).map((name) => {
                                                const found = (allRoles as any[]).find((r) => r.name === name);
                                                return found ? found.id : null;
                                            }).filter((v) => v !== null) as number[];
                                            setSelectedRoleIds(ids);
                                        }}
                                        propositions={((allRoles as any[]) || []).map((r) => r.name)}
                                        selection={(selectedRoleIds || []).map((id: number) => {
                                            const r = (allRoles as any[]).find((x) => x.id === id) || (targetUser?.roles ?? []).find((x: any) => x.id === id);
                                            return r ? { value: r.name, label: r.name } : { value: String(id), label: String(id) };
                                        })}
                                        loading={false}
                                        minQueryLength={0}
                                    />

                                    {/* Hidden inputs to submit role ids */}
                                    {selectedRoleIds.map((id: number) => (
                                        <input key={id} type="hidden" name="roles[]" value={id} />
                                    ))}
                                </div>
                                <p className="text-sm text-muted-foreground">{t('Current roles in the system')}</p>
                            </div>

                            {/* Section Permissions (affiché si l'éditeur est admin) */}
                            {isAdmin(auth.user) && (
                                <div className="grid gap-2">
                                    <Label>{t('Permissions')}</Label>
                                    <div>
                                        <SearchSelect
                                            value={permissionSearch}
                                            onChange={(v) => setPermissionSearch(v)}
                                            onSubmit={(s) => {
                                                const names = s && s.trim() ? s.trim().split(/\s+/) : [];
                                                const ids = (names || []).map((name) => {
                                                    const found = (allPermissions as any[]).find((p) => p.name === name);
                                                    return found ? found.id : null;
                                                }).filter((v) => v !== null) as number[];
                                                setSelectedPermissionIds(ids);
                                            }}
                                            propositions={mergedPermissionPropositions}
                                            selection={(selectedPermissionIds || []).map((id: number) => {
                                                const p = (allPermissions as any[]).find((x) => x.id === id) || (targetUser?.permissions ?? []).find((x: any) => x.id === id);
                                                return p ? { value: p.name, label: p.name } : { value: String(id), label: String(id) };
                                            })}
                                            loading={false}
                                            minQueryLength={0}
                                        />

                                        {/* Hidden inputs to submit permission ids */}
                                        {selectedPermissionIds.map((id: number) => (
                                            <input key={id} type="hidden" name="permissions[]" value={id} />
                                        ))}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{t('Permissions for this user')}</p>

                                    {/* Visual summary: badges for inherited vs explicit permissions
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {displayedPermissionIds.map((id) => {
                                            const perm = (allPermissions as any[]).find((p) => p.id === id) || (targetUser?.permissions ?? []).find((p: any) => p.id === id);
                                            if (!perm) return null;
                                            const inherited = (inheritedPermissionIds || []).includes(id);
                                            const explicit = (selectedPermissionIds || []).includes(id);
                                            // inherited only -> slightly transparent; explicit -> normal; both -> highlight
                                            const extraClass = inherited && !explicit ? 'opacity-70' : inherited && explicit ? 'ring-1 ring-accent/40' : '';
                                            return (
                                                <Badge key={id} className={`${extraClass}`}>{perm.name}{inherited && !explicit ? ' · inherited' : ''}</Badge>
                                            );
                                        })}
                                    </div> */}
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
                                <Button type="submit">{t('Save')}</Button>
                            </div>
                        </>
                    </form>
                </div>

                <DeleteUser />
            </SettingsLayout>
        </AppLayout>
    );
}
