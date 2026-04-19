import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Form, Head, usePage } from '@inertiajs/react';
import { useState, useEffect, useMemo } from 'react';
import { Shield } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import SearchSelect from '@/components/app/search-select';
import PermissionsChecklistCard from '@/components/users/permissions-checklist-card';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { useI18n } from '@/lib/i18n';

const permissionDomain = (permissionName: string): string => {
    const n = permissionName.toLowerCase();

    if (
        n.includes('product') ||
        n.includes('products') ||
        n.includes('category') ||
        n.includes('categories') ||
        n.includes('tag') ||
        n.includes('tags') ||
        n.includes('price') ||
        n.includes('prices') ||
        n.includes('gencod') ||
        n.includes('export/import')
    ) {
        return 'Produits';
    }

    if (
        n.includes('user') ||
        n.includes('users') ||
        n.includes('client') ||
        n.includes('clients') ||
        n.includes('supplier') ||
        n.includes('suppliers') ||
        n.includes('commercial') ||
        n.includes('guests') ||
        n.includes('adminstrator')
    ) {
        return 'Utilisateurs';
    }

    if (
        n.includes('order') ||
        n.includes('orders') ||
        n.includes('invoice') ||
        n.includes('place ') ||
        n.includes('register ')
    ) {
        return 'Commandes';
    }

    return 'Autres';
};

export default function PermissionsSettings({
    editingUser,
}: {
    editingUser?: User;
}) {
    const page = usePage<SharedData>();
    const { auth } = page.props as SharedData;
    const { t } = useI18n();
    const targetUser = editingUser ?? auth.user;
    const isSelf = !editingUser || editingUser.id === auth.user?.id;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Profile settings'),
            href: isSelf ? '/settings/profile' : `/admin/users/${targetUser!.id}/edit`,
        },
        {
            title: t('Permissions'),
            href: isSelf ? '/settings/permissions' : `/admin/users/${targetUser!.id}/permissions`,
        },
    ];

    const userAbilities = (usePage().props as any).userAbilities ?? {};
    const canManageRoles = !!userAbilities.assign_roles;
    const canManagePermissions = !!userAbilities.assign_permissions;

    const allRoles = (usePage().props as any).allRoles ?? [];
    const allPermissions = (usePage().props as any).allPermissions ?? [];
    const roleManagementLocked = !canManageRoles;
    const selectableRoles = (allRoles as any[]) || [];
    const roleLabel = (name: string) => t(name);

    const [roleSearch, setRoleSearch] = useState('');
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>((targetUser?.roles ?? []).map((r: any) => r.id));

    const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>((targetUser?.permissions ?? []).map((p: any) => p.id));
    const [removedPermissionIds, setRemovedPermissionIds] = useState<number[]>([]);

    useEffect(() => {
        setSelectedRoleIds((targetUser?.roles ?? []).map((r: any) => r.id));
        setSelectedPermissionIds((targetUser?.permissions ?? []).map((p: any) => p.id));
        setRemovedPermissionIds([]);
    }, [targetUser?.id]);

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

    const activePermissionIds = useMemo(() => {
        const set = new Set<number>([...(inheritedPermissionIds || []), ...(selectedPermissionIds || [])]);
        removedPermissionIds.forEach((id) => set.delete(id));
        return Array.from(set);
    }, [inheritedPermissionIds, selectedPermissionIds, removedPermissionIds]);

    const permissionsByDomain = useMemo(() => {
        const grouped = new Map<string, Array<{ id: number; name: string }>>();

        (allPermissions as any[]).forEach((permission) => {
            const domain = permissionDomain(String(permission.name));
            const current = grouped.get(domain) ?? [];
            current.push({ id: Number(permission.id), name: String(permission.name) });
            grouped.set(domain, current);
        });

        return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [allPermissions]);

    const togglePermission = (permissionId: number, checked: boolean) => {
        if (checked) {
            setRemovedPermissionIds((prev) => prev.filter((id) => id !== permissionId));

            if (!inheritedPermissionIds.includes(permissionId)) {
                setSelectedPermissionIds((prev) => (prev.includes(permissionId) ? prev : [...prev, permissionId]));
            }
            return;
        }

        setSelectedPermissionIds((prev) => prev.filter((id) => id !== permissionId));

        if (inheritedPermissionIds.includes(permissionId)) {
            setRemovedPermissionIds((prev) => (prev.includes(permissionId) ? prev : [...prev, permissionId]));
        }
    };

    const formAction = isSelf
        ? '/settings/permissions'
        : `/admin/users/${targetUser!.id}/permissions`;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Permissions')} />

            <SettingsLayout>
                <div className='space-y-6'>
                    <Form method='patch' action={formAction} className='space-y-6'>
                        {canManageRoles && (
                            <Card className='p-6'>
                                <h2 className='text-xl font-semibold mb-4 flex items-center gap-2'>
                                    <Shield size={20} />
                                    {t('Roles & permissions')}
                                </h2>

                                <h3 className='text-sm font-medium mb-2'>{t('Roles')} ({selectedRoleIds.length || 0})</h3>

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
                                    propositions={selectableRoles.map((r) => ({ value: r.name, label: roleLabel(r.name) }))}
                                    selection={(selectedRoleIds || []).map((id: number) => {
                                        const r = (allRoles as any[]).find((x) => x.id === id) || (targetUser?.roles ?? []).find((x: any) => x.id === id);
                                        return r ? { value: r.name, label: roleLabel(r.name) } : { value: String(id), label: String(id) };
                                    })}
                                    loading={false}
                                    minQueryLength={0}
                                />

                                {roleManagementLocked && (
                                    <p className='mt-3 text-sm text-amber-700'>
                                        {t('Dev users cannot modify admin or dev accounts.')}
                                    </p>
                                )}

                                {!roleManagementLocked && selectedRoleIds.map((id: number) => (
                                    <input key={id} type='hidden' name='roles[]' value={id} />
                                ))}

                                <div className='mt-4 flex flex-wrap gap-2'>
                                    {selectedRoleIds.length > 0 ? (
                                        selectedRoleIds.map((id: number) => {
                                            const r = (allRoles as any[]).find((x) => x.id === id) || (targetUser?.roles ?? []).find((x: any) => x.id === id);
                                            return r ? (
                                                <Badge key={id} variant='secondary' className='bg-blue-100 text-blue-800'>
                                                    {roleLabel(r.name)}
                                                </Badge>
                                            ) : null;
                                        })
                                    ) : (
                                        <p className='text-gray-500 text-sm'>{t('No roles assigned')}</p>
                                    )}
                                </div>
                            </Card>
                        )}

                        {canManagePermissions && (
                            <>
                                {activePermissionIds.map((id: number) => (
                                    <input key={id} type='hidden' name='permissions[]' value={id} />
                                ))}

                                <PermissionsChecklistCard
                                    title={`${t('Permissions')} (${activePermissionIds.length || 0})`}
                                    permissionsByDomain={permissionsByDomain}
                                    selectedPermissionIds={activePermissionIds}
                                    onTogglePermission={togglePermission}
                                    translate={t}
                                    submit={{
                                        label: 'Save',
                                        type: 'submit',
                                    }}
                                />
                            </>
                        )}
                    </Form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
