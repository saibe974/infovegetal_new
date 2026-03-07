import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAdminUser } from '@/routes/users';
import { edit as editProfile } from '@/routes/profile';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { FormEvent } from 'react';

type UserMetaItem = {
    id: number;
    user_id: number;
    key: string;
    value: string | null;
    type: string | null;
    sort_order: number;
};

type PageProps = SharedData & {
    editingUser?: User;
    userMeta?: UserMetaItem[];
};

type AdditionalInfoPayload = {
    alias: string;
    ref: string;
    tel: string;
    address_road: string;
    address_zip: string;
    address_town: string;
    active: boolean;
    mailing: boolean;
};

export default function AdditionalInfo() {
    const page = usePage<PageProps>();
    const { auth, editingUser } = page.props;
    const targetUser = editingUser ?? auth.user;
    const isSelf = !editingUser || editingUser.id === auth.user?.id;
    const isAdminPath = page.url.startsWith('/admin/users/');
    const userMeta = page.props.userMeta ?? [];

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Additional info',
            href: isSelf ? editProfile().url : editAdminUser(targetUser!.id).url,
        },
    ];

    const updateUrl = isAdminPath
        ? `/admin/users/${targetUser!.id}/additional-info`
        : '/settings/additional-info';

    const metaBaseUrl = isAdminPath
        ? `/admin/users/${targetUser!.id}/additional-info/meta`
        : '/settings/additional-info/meta';

    const { data, setData, patch, processing, errors } = useForm<AdditionalInfoPayload>({
        alias: (targetUser as any)?.alias ?? '',
        ref: (targetUser as any)?.ref ?? '',
        tel: (targetUser as any)?.tel ?? '',
        address_road: (targetUser as any)?.address_road ?? '',
        address_zip: (targetUser as any)?.address_zip ?? '',
        address_town: (targetUser as any)?.address_town ?? '',
        active: Boolean((targetUser as any)?.active ?? true),
        mailing: Boolean((targetUser as any)?.mailing ?? false),
    });

    const newMetaForm = useForm({
        key: '',
        value: '',
        type: '',
        sort_order: 0,
    });

    const saveMain = (e: FormEvent) => {
        e.preventDefault();
        patch(updateUrl, { preserveScroll: true });
    };

    const addMeta = (e: FormEvent) => {
        e.preventDefault();
        newMetaForm.post(metaBaseUrl, {
            preserveScroll: true,
            onSuccess: () => {
                newMetaForm.reset('key', 'value', 'type', 'sort_order');
            },
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Additional info" />

            <SettingsLayout>
                <div className="space-y-6">
                    <Card className="p-6">
                        <h2 className="mb-4 text-xl font-semibold">Informations complementaires</h2>
                        <form onSubmit={saveMain} className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="alias">Alias</Label>
                                    <Input id="alias" value={data.alias} onChange={(e) => setData('alias', e.target.value)} />
                                    <InputError message={errors.alias} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="ref">Reference</Label>
                                    <Input id="ref" value={data.ref} onChange={(e) => setData('ref', e.target.value)} />
                                    <InputError message={errors.ref} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="tel">Telephone</Label>
                                    <Input id="tel" value={data.tel} onChange={(e) => setData('tel', e.target.value)} />
                                    <InputError message={errors.tel} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="address_zip">Code postal</Label>
                                    <Input id="address_zip" value={data.address_zip} onChange={(e) => setData('address_zip', e.target.value)} />
                                    <InputError message={errors.address_zip} />
                                </div>
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="address_road">Adresse</Label>
                                    <Input id="address_road" value={data.address_road} onChange={(e) => setData('address_road', e.target.value)} />
                                    <InputError message={errors.address_road} />
                                </div>
                                <div className="grid gap-2 md:col-span-2">
                                    <Label htmlFor="address_town">Ville</Label>
                                    <Input id="address_town" value={data.address_town} onChange={(e) => setData('address_town', e.target.value)} />
                                    <InputError message={errors.address_town} />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-6 pt-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        id="active"
                                        type="checkbox"
                                        checked={data.active}
                                        onChange={(e) => setData('active', e.target.checked)}
                                    />
                                    <Label htmlFor="active">Actif</Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        id="mailing"
                                        type="checkbox"
                                        checked={data.mailing}
                                        onChange={(e) => setData('mailing', e.target.checked)}
                                    />
                                    <Label htmlFor="mailing">Accepte le mailing</Label>
                                </div>
                            </div>

                            <div className="pt-2">
                                <Button type="submit" disabled={processing}>
                                    <Save className="mr-2 h-4 w-4" />
                                    Enregistrer
                                </Button>
                            </div>
                        </form>
                    </Card>

                    <Card className="p-6">
                        <h2 className="mb-4 text-xl font-semibold">Champs dynamiques</h2>

                        <form onSubmit={addMeta} className="mb-6 grid gap-3 md:grid-cols-[1fr_1fr_140px_120px_auto]">
                            <Input
                                placeholder="key (ex: phone.secondary)"
                                value={newMetaForm.data.key}
                                onChange={(e) => newMetaForm.setData('key', e.target.value)}
                            />
                            <Input
                                placeholder="value"
                                value={newMetaForm.data.value}
                                onChange={(e) => newMetaForm.setData('value', e.target.value)}
                            />
                            <Input
                                placeholder="type (ex: string/json)"
                                value={newMetaForm.data.type}
                                onChange={(e) => newMetaForm.setData('type', e.target.value)}
                            />
                            <Input
                                type="number"
                                placeholder="ordre"
                                value={String(newMetaForm.data.sort_order)}
                                onChange={(e) => newMetaForm.setData('sort_order', Number(e.target.value || 0))}
                            />
                            <Button type="submit" disabled={newMetaForm.processing}>
                                <Plus className="mr-2 h-4 w-4" />
                                Ajouter
                            </Button>
                        </form>
                        <InputError message={newMetaForm.errors.key || newMetaForm.errors.value || newMetaForm.errors.type} />

                        <div className="space-y-3">
                            {userMeta.length === 0 && (
                                <p className="text-sm text-muted-foreground">Aucun champ dynamique.</p>
                            )}

                            {userMeta.map((item) => (
                                <MetaRow
                                    key={item.id}
                                    item={item}
                                    metaBaseUrl={metaBaseUrl}
                                />
                            ))}
                        </div>
                    </Card>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}

function MetaRow({ item, metaBaseUrl }: { item: UserMetaItem; metaBaseUrl: string }) {
    const form = useForm({
        key: item.key,
        value: item.value ?? '',
        type: item.type ?? '',
        sort_order: item.sort_order ?? 0,
    });

    const save = (e: FormEvent) => {
        e.preventDefault();
        form.put(`${metaBaseUrl}/${item.id}`, { preserveScroll: true });
    };

    const remove = () => {
        form.delete(`${metaBaseUrl}/${item.id}`, { preserveScroll: true });
    };

    return (
        <form onSubmit={save} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_140px_120px_auto_auto]">
            <Input value={form.data.key} onChange={(e) => form.setData('key', e.target.value)} />
            <Input value={form.data.value} onChange={(e) => form.setData('value', e.target.value)} />
            <Input value={form.data.type} onChange={(e) => form.setData('type', e.target.value)} />
            <Input
                type="number"
                value={String(form.data.sort_order)}
                onChange={(e) => form.setData('sort_order', Number(e.target.value || 0))}
            />
            <Button type="submit" variant="secondary" disabled={form.processing}>
                <Save className="mr-2 h-4 w-4" />
                Sauver
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={form.processing}>
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
            </Button>
        </form>
    );
}
