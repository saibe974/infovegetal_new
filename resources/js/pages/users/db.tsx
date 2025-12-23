import { Head, Link, router, usePage, Form } from '@inertiajs/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SelectWithItems } from '@/components/ui/select-with-items';
import { type SharedData, type User } from '@/types';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { FormField } from '@/components/ui/form-field';
import SearchSelect from '@/components/app/search-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function UserDbPage() {
    const { auth, user: propsUser, dbProducts, selectedDbId, dbUserAttributes } = usePage<SharedData & { user: User; dbProducts: Array<{ id: number; name: string }>; selectedDbId?: number | null; dbUserAttributes?: Record<string, any> }>().props as any;
    const { t } = useI18n();

    const targetUser: User = propsUser;
    // attributesByDbId : { [dbProductId: number]: Record<string, any> }
    const [attributesByDbId, setAttributesByDbId] = useState<Record<number, Record<string, any>>>(() => {
        // Si dbUserAttributes est un objet { [dbProductId]: attributes }
        if (dbUserAttributes && typeof dbUserAttributes === 'object') return { ...dbUserAttributes };
        return {};
    });
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<number[]>(Array.isArray(selectedDbId) ? selectedDbId : []);
    const [processing, setProcessing] = useState(false);

    // Prepare initial selection for SearchSelect (value as string ids)
    const initialSelection = useMemo(() => {
        return (Array.isArray(selectedDbId) ? selectedDbId : []).map((id: number) => {
            const found = (dbProducts as any[]).find((d) => d.id === id);
            return { value: found ? found.name : String(id), label: found ? found.name : String(id) };
        });
    }, [dbProducts, selectedDbId]);

    // When selectedIds change, optionally show toast or update UI; keep processing state for submit
    useEffect(() => {
        // no-op for now
    }, [selectedIds]);

    return (
        <AppLayout breadcrumbs={[] as any}>
            <Head title={t('User database association')} />

            <SettingsLayout>
                <div className="space-y-6">
                    {/* <HeadingSmall
                        title={t('Associate DB product')}
                        description={t('Link a DB product to this user')}
                    /> */}

                    <Form method="post" action={`/admin/users/${targetUser.id}/db`} className="space-y-4">
                        <div className="flex flex-col gap-6">
                            <FormField label={t('Select DB product')}>
                                <SearchSelect
                                    value={search}
                                    onChange={(v) => setSearch(v)}
                                    onSubmit={(s) => {
                                        // s is a space-separated string of names; map names to ids
                                        const names = s && s.trim() ? s.trim().split(/\s+/) : [];
                                        const ids = (names || []).map((name) => {
                                            const found = (dbProducts as any[]).find((d) => d.name === name);
                                            return found ? found.id : null;
                                        }).filter((v) => v !== null) as number[];
                                        setSelectedIds(ids);
                                    }}
                                    propositions={((dbProducts as any[]) || []).map((d) => d.name)}
                                    selection={initialSelection}
                                    loading={false}
                                    minQueryLength={0}
                                />


                                {/* Tableau d'éditeurs d'attributs pour chaque DB sélectionné */}
                                {selectedIds.length > 0 && (
                                    <div className="mt-6 space-y-4">
                                        {/* <HeadingSmall title={t('Custom attributes')} /> */}
                                        {selectedIds.map((dbId) => {
                                            const db = (dbProducts as any[]).find((d) => d.id === dbId);
                                            const attrs = Object.entries(attributesByDbId[dbId] || {}).filter(([k]) => !k.startsWith('__'));
                                            
                                            return (
                                                <Card key={dbId}>
                                                    <CardHeader>
                                                        <CardTitle className="text-base">{db ? db.name : dbId}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className="space-y-3">
                                                        {attrs.length > 0 && (
                                                            <div className="space-y-2">
                                                                {attrs.map(([key, value]) => (
                                                                    <div key={key} className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/50">
                                                                        <span className="text-sm font-medium text-muted-foreground min-w-[100px]">{key}</span>
                                                                        <span className="text-sm flex-1">{value}</span>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                                                                            title={t('Delete attribute')}
                                                                            onClick={() => setAttributesByDbId(prev => {
                                                                                const { [key]: _, ...rest } = prev[dbId] || {};
                                                                                return { ...prev, [dbId]: rest };
                                                                            })}
                                                                        >
                                                                            <X />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Formulaire d'ajout */}
                                                        <div className="flex items-center gap-2 pt-2 border-t">
                                                            <Input
                                                                type="text"
                                                                placeholder={t('Key')}
                                                                className="h-9"
                                                                value={attributesByDbId[dbId]?.__newKey || ''}
                                                                onChange={e => setAttributesByDbId(prev => ({
                                                                    ...prev,
                                                                    [dbId]: {
                                                                        ...prev[dbId],
                                                                        __newKey: e.target.value
                                                                    }
                                                                }))}
                                                            />
                                                            <Input
                                                                type="text"
                                                                placeholder={t('Value')}
                                                                className="h-9"
                                                                value={attributesByDbId[dbId]?.__newValue || ''}
                                                                onChange={e => setAttributesByDbId(prev => ({
                                                                    ...prev,
                                                                    [dbId]: {
                                                                        ...prev[dbId],
                                                                        __newValue: e.target.value
                                                                    }
                                                                }))}
                                                            />
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-9 px-3 hover:bg-green-600/30 hover:border-green-700"
                                                                title={t('Add attribute')}
                                                                onClick={() => {
                                                                    const key = attributesByDbId[dbId]?.__newKey?.trim();
                                                                    const value = attributesByDbId[dbId]?.__newValue;
                                                                    if (!key) return;
                                                                    setAttributesByDbId(prev => {
                                                                        const { __newKey, __newValue, ...rest } = prev[dbId] || {};
                                                                        return {
                                                                            ...prev,
                                                                            [dbId]: {
                                                                                ...rest,
                                                                                [key]: value,
                                                                            }
                                                                        };
                                                                    });
                                                                }}
                                                            >
                                                                <PlusCircle />
                                                            </Button>
                                                        </div>
                                                        
                                                        {/* Champ caché pour envoyer le JSON de chaque dbId au backend */}
                                                        <input type="hidden" name={`attributes[${dbId}]`} value={JSON.stringify(Object.fromEntries(attrs))} />
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Hidden inputs for selected ids as db_ids[] */}
                                {(selectedIds || []).map((id) => (
                                    <input key={id} type="hidden" name="db_ids[]" value={id} />
                                ))}
                            </FormField>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button disabled={processing} type="submit">{t('Save')}</Button>
                            <Link href="/users" className="text-sm text-muted-foreground">{t('Back to users')}</Link>
                        </div>
                    </Form>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
