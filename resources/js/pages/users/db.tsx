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

export default function UserDbPage() {
    const { auth, user: propsUser, dbProducts, selectedDbId } = usePage<SharedData & { user: User; dbProducts: Array<{ id: number; name: string }>; selectedDbId?: number | null }>().props as any;
    const { t } = useI18n();

    const targetUser: User = propsUser;
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
                    <HeadingSmall
                        title={t('Associate DB product')}
                        description={t('Link a DB product to this user')}
                    />

                    <Form method="post" action={`/admin/users/${targetUser.id}/db`} className="space-y-4">
                        <div className="grid gap-2">
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
