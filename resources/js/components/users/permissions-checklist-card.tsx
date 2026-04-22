import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrashIcon } from 'lucide-react';

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
    helpText?: string;
    optionsByDomain: Array<[string, Array<{ value: string; label: string }>]>;
    disabled?: boolean;
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
    officialPermissionNames?: string[];
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
    officialPermissionNames,
}: PermissionsChecklistCardProps) {
    const officialPermissionSet = officialPermissionNames ? new Set(officialPermissionNames) : null;

    const isValidPermission = (permissionName: string): boolean => {
        if (officialPermissionSet) {
            return officialPermissionSet.has(permissionName);
        }

        return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,2}$/.test(permissionName);
    };

    return (
        <Card className='p-6 xl:col-span-2 space-y-4'>
            <h2 className='text-lg font-medium'>{title}</h2>

            {createPermission && (
                <>
                    <div className='flex gap-2'>
                        {createPermission.optionsByDomain.length > 0 ? (
                            <Select value={createPermission.value} onValueChange={createPermission.onChange}>
                                <SelectTrigger className='w-full'>
                                    <SelectValue placeholder={createPermission.placeholder} />
                                </SelectTrigger>
                                <SelectContent>
                                    {createPermission.optionsByDomain.map(([domain, items]) => (
                                        <SelectGroup key={domain}>
                                            <SelectLabel>{domain}</SelectLabel>
                                            {items.map((item) => (
                                                <SelectItem key={item.value} value={item.value}>
                                                    {item.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ))}
                                </SelectContent>
                            </Select>
                        ) : (
                            <Input
                                value={createPermission.value}
                                onChange={(e) => createPermission.onChange(e.target.value)}
                                placeholder={createPermission.placeholder}
                                className='w-full'
                            />
                        )}
                        <Button
                            type='button'
                            onClick={createPermission.onCreate}
                            disabled={createPermission.disabled || !createPermission.value}
                        >
                            {createPermission.addLabel}
                        </Button>
                    </div>

                    {createPermission.helpText && (
                        <p className='text-xs text-muted-foreground'>
                            {createPermission.helpText}
                        </p>
                    )}

                    <Separator />
                </>
            )}

            <div className='space-y-6'>
                {permissionsByDomain.map(([domain, items]) => (
                    <div key={domain}>
                        <h3 className='text-sm font-semibold mb-2'>{domain}</h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
                            {items.map((permission) => {
                                const isValid = isValidPermission(permission.name);

                                return (
                                    <div
                                        key={permission.id}
                                        className={`flex items-center justify-between border rounded-md px-3 py-2 ${selectedPermissionIds.includes(permission.id)
                                            ? 'border-green-200'
                                            : 'border-red-200'
                                            }`}
                                    >
                                        <div className='flex items-center gap-2'>
                                            <Label
                                                htmlFor={`perm-${permission.id}`}
                                                className={`cursor-pointer ${selectedPermissionIds.includes(permission.id)
                                                    ? 'text-green-700 dark:text-green-200'
                                                    : 'text-red-700 dark:text-red-200'
                                                    }`}
                                            >
                                                {translate(permission.name)}
                                            </Label>
                                            <Badge
                                                variant='outline'
                                                className={isValid
                                                    ? 'border-green-300 text-green-700 dark:border-green-200 dark:text-green-200'
                                                    : 'border-amber-300 text-amber-700 dark:border-amber-200 dark:text-amber-200'}
                                            >
                                                {isValid ? translate('Valid') : translate('Custom')}
                                            </Badge>
                                        </div>
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
                                                    <TrashIcon size={16} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
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
