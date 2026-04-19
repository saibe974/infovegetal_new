import { send } from '@/routes/verification';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Transition } from '@headlessui/react';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Mail, Shield, Lock, AlertCircle, Users2Icon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import DeleteUser from '@/components/users/delete-user';
import HeadingSmall from '@/components/heading-small';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SelectWithItems } from '@/components/ui/select-with-items';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import SearchSelect from '@/components/app/search-select';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAdminUser, update as updateAdminUser } from '@/routes/users';
import { edit as editProfile, update as updateProfile } from '@/routes/profile';
import { useI18n } from '@/lib/i18n';
import { getEffectiveUser, isAdmin } from '@/lib/roles';

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
    const page = usePage<SharedData>();
    const { auth, locale } = page.props as SharedData & { locale?: string };
    const pageProps = page.props as any;
    const errors = pageProps.errors ?? {};
    const { t } = useI18n();
    const targetUser = editingUser ?? auth.user;
    const isSelf = !editingUser || editingUser.id === auth.user?.id;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Profile settings'),
            href: (isSelf ? editProfile() : editAdminUser(targetUser!.id)).url,
        },
    ];

    const effectiveUser = getEffectiveUser(auth);
    const isAdminUser = isAdmin(effectiveUser);
    const userAbilities = (usePage().props as any).userAbilities ?? {};
    const canManageRoles = !!userAbilities.assign_roles;
    const canManagePermissions = !!userAbilities.assign_permissions;
    const canManageParent = !!userAbilities.move;
    const isAdminEditContext = page.url.startsWith('/admin/users/') || isAdminUser;
    const formAction = isAdminEditContext
        ? updateAdminUser.form({ user: targetUser!.id })
        : updateProfile.form();

    // console.log(editingUser);


    // All possible roles/permissions provided by controller
    const allRoles = (usePage().props as any).allRoles ?? [];
    const allPermissions = (usePage().props as any).allPermissions ?? [];
    const roleManagementLocked = !canManageRoles;
    const selectableRoles = (allRoles as any[]) || [];

    const [roleSearch, setRoleSearch] = useState('');
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>((targetUser?.roles ?? []).map((r: any) => r.id));

    const [permissionSearch, setPermissionSearch] = useState('');
    const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>((targetUser?.permissions ?? []).map((p: any) => p.id));

    const isGroup = useMemo(
        () => selectedRoleIds.some((id) => (allRoles as any[]).find((r) => r.id === id)?.name === 'group'),
        [selectedRoleIds, allRoles],
    );

    // ── Parent ────────────────────────────────────────────────────────────────
    const [parentModalOpen, setParentModalOpen] = useState(false);
    const [parentSearch, setParentSearch] = useState('');
    const [parentSearchItems, setParentSearchItems] = useState<{ id: number; name: string; email: string; depth: number }[]>([]);
    const [parentSearchLoading, setParentSearchLoading] = useState(false);
    const initialParent = (targetUser as any)?.parent_id
        ? { id: (targetUser as any).parent_id, name: (targetUser as any).parent?.name ?? `#${(targetUser as any).parent_id}` }
        : null;
    const [selectedParent, setSelectedParent] = useState<{ id: number; name: string } | null>(initialParent);
    const parentSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const searchParents = (q: string) => {
        setParentSearch(q);
        if (parentSearchTimer.current) clearTimeout(parentSearchTimer.current);
        if (!q || q.trim().length < 2) { setParentSearchItems([]); return; }
        parentSearchTimer.current = setTimeout(async () => {
            setParentSearchLoading(true);
            try {
                const res = await fetch(
                    `/admin/users/tree-search?q=${encodeURIComponent(q.trim())}`,
                    { headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' } },
                );
                if (res.ok) {
                    const payload = await res.json();
                    setParentSearchItems(
                        ((payload.items || []) as any[]).map((item) => ({
                            id: item.id,
                            name: item.name,
                            email: item.email,
                            depth: Number(item.depth ?? 0),
                        })),
                    );
                }
            } finally {
                setParentSearchLoading(false);
            }
        }, 300);
    };

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
                    {/* Vérification d'email non vérifiée */}
                    {mustVerifyEmail &&
                        (targetUser as any)?.email_verified_at === null && (
                            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm text-amber-900">
                                        {t('The user email address is unverified.')}{' '}
                                        {/* Only allow resend for own profile */}
                                        {!editingUser && (
                                            <Link
                                                href={send()}
                                                as="button"
                                                className="font-medium underline hover:no-underline"
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
                            </div>
                        )}

                    <Form {...formAction} className='space-y-6'>

                        {/* Informations Personnelles */}
                        <Card className="p-6">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Mail size={20} />
                                {t('Profile information')}
                            </h2>

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

                            {!isGroup && (
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
                            )}

                        </Card>

                        {/* Section Rôles */}
                        {canManageRoles && (
                            <Card className="p-6">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <Shield size={20} />
                                    {t('Roles')} ({selectedRoleIds.length || 0})
                                </h2>

                                <SearchSelect
                                    value={roleSearch}
                                    onChange={(v) => setRoleSearch(v)}
                                    onSubmit={(s) => {
                                        const names = s && s.trim() ? s.trim().split(/\s+/) : [];
                                        const ids = (names || []).map((name) => {
                                            const found = selectableRoles.find((r) => r.name === name);
                                            return found ? found.id : null;
                                        }).filter((v) => v !== null) as number[];
                                        setSelectedRoleIds(ids);
                                    }}
                                    propositions={selectableRoles.map((r) => r.name)}
                                    selection={(selectedRoleIds || []).map((id: number) => {
                                        const r = (allRoles as any[]).find((x) => x.id === id) || (targetUser?.roles ?? []).find((x: any) => x.id === id);
                                        return r ? { value: r.name, label: r.name } : { value: String(id), label: String(id) };
                                    })}
                                    loading={false}
                                    minQueryLength={0}
                                />

                                {roleManagementLocked && (
                                    <p className="mt-3 text-sm text-amber-700">
                                        {t('Dev users cannot modify admin or dev accounts.')}
                                    </p>
                                )}

                                {/* Hidden inputs to submit role ids */}
                                {!roleManagementLocked && selectedRoleIds.map((id: number) => (
                                    <input key={id} type="hidden" name="roles[]" value={id} />
                                ))}

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {selectedRoleIds.length > 0 ? (
                                        selectedRoleIds.map((id: number) => {
                                            const r = (allRoles as any[]).find((x) => x.id === id) || (targetUser?.roles ?? []).find((x: any) => x.id === id);
                                            return r ? (
                                                <Badge key={id} variant="secondary" className="bg-blue-100 text-blue-800">
                                                    {r.name}
                                                </Badge>
                                            ) : null;
                                        })
                                    ) : (
                                        <p className="text-gray-500 text-sm">{t('No roles assigned')}</p>
                                    )}
                                </div>
                            </Card>
                        )}

                        {/* Section Permissions (affiché si l'éditeur est admin) */}
                        {canManagePermissions && (
                            <Card className="p-6">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <Lock size={20} />
                                    {t('Permissions')} ({selectedPermissionIds.length || 0})
                                </h2>

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

                                <div className="mt-4 flex flex-wrap gap-2 max-h-96 overflow-y-auto">
                                    {selectedPermissionIds.length > 0 ? (
                                        selectedPermissionIds.map((id: number) => {
                                            const p = (allPermissions as any[]).find((x) => x.id === id) || (targetUser?.permissions ?? []).find((x: any) => x.id === id);
                                            return p ? (
                                                <Badge key={id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                                    {p.name}
                                                </Badge>
                                            ) : null;
                                        })
                                    ) : (
                                        <p className="text-gray-500 text-sm">{t('No permissions assigned')}</p>
                                    )}
                                </div>
                            </Card>
                        )}
                        {/* Section Parent — visible uniquement en contexte admin */}
                        {isAdminEditContext && canManageParent && (
                            <Card className="p-6">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <Users2Icon size={20} />
                                    {t('Parent')}
                                </h2>
                                <div className="flex items-center gap-2">
                                    {selectedParent ? (
                                        <Badge variant="outline" className="text-sm py-1 px-3">
                                            {selectedParent.name}
                                        </Badge>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">{t('No parent selected')}</span>
                                    )}
                                    <Button type="button" variant="outline" size="sm" onClick={() => setParentModalOpen(true)}>
                                        <Users2Icon className="mr-1 h-4 w-4" />
                                        {selectedParent ? t('Change') : t('Select')}
                                    </Button>
                                    {selectedParent && (
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedParent(null)}>
                                            {t('Remove')}
                                        </Button>
                                    )}
                                </div>
                                <input type="hidden" name="parent_id" value={selectedParent?.id ?? ''} />
                            </Card>
                        )}

                        <div className="flex items-center gap-4 pt-4">
                            <Button type="submit">{t('Save')}</Button>
                        </div>
                    </Form>

                    {/* Modale sélection parent */}
                    <Dialog open={parentModalOpen} onOpenChange={setParentModalOpen}>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>{t('Select a parent')}</DialogTitle>
                            </DialogHeader>
                            <SearchSelect
                                value={parentSearch}
                                onChange={searchParents}
                                onSubmit={searchParents}
                                propositions={parentSearchItems.map((u) => ({ value: String(u.id), label: u.name }))}
                                loading={parentSearchLoading}
                                minQueryLength={2}
                                search={true}
                            />
                            {parentSearchItems.length > 0 && (
                                <ul className="mt-2 max-h-64 overflow-y-auto divide-y rounded-md border text-sm">
                                    {parentSearchItems.map((u) => (
                                        <li
                                            key={u.id}
                                            className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-muted"
                                            style={{ paddingLeft: `${(u.depth ?? 0) * 16 + 12}px` }}
                                            onClick={() => {
                                                setSelectedParent({ id: u.id, name: u.name });
                                                setParentModalOpen(false);
                                                setParentSearch('');
                                                setParentSearchItems([]);
                                            }}
                                        >
                                            <span>{u.name}</span>
                                            <span className="text-muted-foreground text-xs">{u.email}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {parentSearch.trim().length >= 2 && !parentSearchLoading && parentSearchItems.length === 0 && (
                                <p className="mt-2 text-sm text-muted-foreground">{t('No results.')}</p>
                            )}
                        </DialogContent>
                    </Dialog>

                    {/* Delete User */}
                    <DeleteUser />
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
