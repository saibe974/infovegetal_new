import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';

export type PermissionItem = { id: number; name: string };

type SubmitConfig = {
    label: string;
    disabled?: boolean;
    type?: 'button' | 'submit';
    onClick?: () => void;
};

type CreatePermissionConfig = {
    value: string;
    onChange: (value: string) => void;
    onCreate: () => void;
    placeholder: string;
    addLabel: string;
};

type PermissionsChecklistCardProps = {
    title: string;
    permissionsByDomain: Array<[string, PermissionItem[]]>;
    selectedPermissionIds: number[];
    onTogglePermission: (permissionId: number, checked: boolean) => void;
    translate: (key: string) => string;
    submit: SubmitConfig;
    createPermission?: CreatePermissionConfig;
    onDeletePermission?: (permission: PermissionItem) => void;
};

export default function PermissionsChecklistCard({
    title,
    permissionsByDomain,
    selectedPermissionIds,
    onTogglePermission,
    translate,
    submit,
    createPermission,
    onDeletePermission,
}: PermissionsChecklistCardProps) {
    return (
        <Card className='p-6 xl:col-span-2 space-y-4'>
            <h2 className='text-lg font-medium'>{title}</h2>

            {createPermission && (
                <>
                    <div className='flex gap-2'>
                        <Input
                            value={createPermission.value}
                            onChange={(e) => createPermission.onChange(e.target.value)}
                            placeholder={createPermission.placeholder}
                        />
                        <Button type='button' onClick={createPermission.onCreate}>{createPermission.addLabel}</Button>
                    </div>

                    <Separator />
                </>
            )}

            <div className='space-y-6'>
                {permissionsByDomain.map(([domain, items]) => (
                    <div key={domain}>
                        <h3 className='text-sm font-semibold mb-2'>{domain}</h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                            {items.map((permission) => (
                                <div key={permission.id} className='flex items-center justify-between border rounded-md px-3 py-2'>
                                    <Label htmlFor={`perm-${permission.id}`} className='cursor-pointer'>
                                        {translate(permission.name)}
                                    </Label>
                                    <div className='flex items-center gap-2'>
                                        <Checkbox
                                            id={`perm-${permission.id}`}
                                            checked={selectedPermissionIds.includes(permission.id)}
                                            onCheckedChange={(checked) => onTogglePermission(permission.id, !!checked)}
                                        />
                                        {onDeletePermission && (
                                            <Button
                                                type='button'
                                                variant='ghost'
                                                size='sm'
                                                onClick={() => onDeletePermission(permission)}
                                            >
                                                {translate('Delete')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className='pt-2'>
                <Button
                    type={submit.type ?? 'button'}
                    onClick={submit.onClick}
                    disabled={submit.disabled}
                >
                    {translate(submit.label)}
                </Button>
            </div>
        </Card>
    );
}
