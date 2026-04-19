import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { withAppLayout } from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { useI18n } from '@/lib/i18n';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PermissionsChecklistCard from '@/components/users/permissions-checklist-card';

type RoleItem = { id: number; name: string; permissions?: Array<{ id: number; name: string }> };
type PermissionItem = { id: number; name: string };

type Props = {
    roles: RoleItem[];
    permissions: PermissionItem[];
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: '/users',
    },
    {
        title: 'Roles & permissions',
        href: '/admin/users/roles-permissions',
    },
];

function permissionDomain(permissionName: string): string {
    const n = permissionName.toLowerCase();

    if (n.includes('product') || n.includes('category') || n.includes('tag') || n.includes('price') || n.includes('gencod')) {
        return 'Produits';
    }

    if (n.includes('user') || n.includes('client') || n.includes('supplier') || n.includes('commercial') || n.includes('guest') || n.includes('admin')) {
        return 'Utilisateurs';
    }

    if (n.includes('order') || n.includes('invoice')) {
        return 'Commandes';
    }

    return 'Autres';
}

export default withAppLayout<Props>(breadcrumbs, false, ({ roles, permissions }) => {
    const { t } = useI18n();
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(roles[0]?.id ?? null);
    const [newRoleName, setNewRoleName] = useState('');
    const [newPermissionName, setNewPermissionName] = useState('');

    const selectedRole = useMemo(
        () => roles.find((r) => r.id === selectedRoleId) ?? null,
        [roles, selectedRoleId],
    );

    const [selectedPermissionIds, setSelectedPermissionIds] = useState<number[]>(
        (selectedRole?.permissions ?? []).map((p) => p.id),
    );

    const permissionsByDomain = useMemo(() => {
        const grouped = new Map<string, PermissionItem[]>();

        permissions.forEach((p) => {
            const domain = permissionDomain(p.name);
            const current = grouped.get(domain) ?? [];
            current.push(p);
            grouped.set(domain, current);
        });

        return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [permissions]);

    const syncRolePermissions = () => {
        if (!selectedRoleId) {
            return;
        }

        router.put(`/admin/users/roles-permissions/roles/${selectedRoleId}`, {
            permissions: selectedPermissionIds,
        }, {
            preserveScroll: true,
        });
    };

    const createRole = () => {
        if (!newRoleName.trim()) {
            return;
        }

        router.post('/admin/users/roles-permissions/roles', {
            name: newRoleName.trim(),
        }, {
            preserveScroll: true,
            onSuccess: () => setNewRoleName(''),
        });
    };

    const createPermission = () => {
        if (!newPermissionName.trim()) {
            return;
        }

        router.post('/admin/users/roles-permissions/permissions', {
            name: newPermissionName.trim(),
        }, {
            preserveScroll: true,
            onSuccess: () => setNewPermissionName(''),
        });
    };

    const deleteRole = (role: RoleItem) => {
        if (!confirm(t('Are you sure?'))) {
            return;
        }

        router.delete(`/admin/users/roles-permissions/roles/${role.id}`, {
            preserveScroll: true,
        });
    };

    const deletePermission = (permission: PermissionItem) => {
        if (!confirm(t('Are you sure?'))) {
            return;
        }

        router.delete(`/admin/users/roles-permissions/permissions/${permission.id}`, {
            preserveScroll: true,
        });
    };

    const onSelectRole = (role: RoleItem) => {
        setSelectedRoleId(role.id);
        setSelectedPermissionIds((role.permissions ?? []).map((p) => p.id));
    };

    const onTogglePermission = (permissionId: number, checked: boolean) => {
        if (checked) {
            setSelectedPermissionIds((prev) => Array.from(new Set([...prev, permissionId])));
            return;
        }

        setSelectedPermissionIds((prev) => prev.filter((id) => id !== permissionId));
    };

    return (
        <>
            <Head title={t('Roles & permissions')} />

            <div className='space-y-6'>
                <Card className='p-6'>
                    <h1 className='text-2xl font-semibold'>{t('Roles & permissions')}</h1>
                    <p className='text-sm text-muted-foreground mt-2'>
                        {t('Manage role and permission catalogs, then attach permissions to each role.')}
                    </p>
                </Card>

                <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
                    <Card className='p-6 space-y-4'>
                        <h2 className='text-lg font-medium'>{t('Roles')}</h2>

                        <div className='flex gap-2'>
                            <Input
                                value={newRoleName}
                                onChange={(e) => setNewRoleName(e.target.value)}
                                placeholder={t('Role name')}
                            />
                            <Button type='button' onClick={createRole}>{t('Add')}</Button>
                        </div>

                        <div className='space-y-2 max-h-[420px] overflow-y-auto'>
                            {roles.map((role) => (
                                <div key={role.id} className='flex items-center justify-between gap-2'>
                                    <button
                                        type='button'
                                        className={`text-left rounded-md px-3 py-2 w-full border ${selectedRoleId === role.id ? 'bg-muted border-primary' : 'border-border'}`}
                                        onClick={() => onSelectRole(role)}
                                    >
                                        <span className='font-medium'>{t(role.name)}</span>
                                        <span className='ml-2 text-xs text-muted-foreground'>({role.permissions?.length ?? 0})</span>
                                    </button>

                                    {!['admin', 'dev'].includes(role.name) && (
                                        <Button type='button' variant='destructive-outline' size='sm' onClick={() => deleteRole(role)}>
                                            {t('Delete')}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </Card>

                    <PermissionsChecklistCard
                        title={`${t('Permissions for role')}: ${selectedRole ? t(selectedRole.name) : '-'}`}
                        permissionsByDomain={permissionsByDomain}
                        selectedPermissionIds={selectedPermissionIds}
                        onTogglePermission={onTogglePermission}
                        translate={t}
                        createPermission={{
                            value: newPermissionName,
                            onChange: setNewPermissionName,
                            onCreate: createPermission,
                            placeholder: t('Permission name'),
                            addLabel: t('Add'),
                        }}
                        onDeletePermission={deletePermission}
                        submit={{
                            label: 'Save',
                            disabled: !selectedRoleId,
                            onClick: syncRolePermissions,
                            type: 'button',
                        }}
                    />
                </div>
            </div>
        </>
    );
});
