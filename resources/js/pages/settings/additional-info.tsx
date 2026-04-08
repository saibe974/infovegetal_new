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
import { FormEvent, useEffect, useMemo, useState } from 'react';

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
    metaKeyOptions?: Array<{ value: string; label: string }>;
    metaKeyConfig?: Record<string, { input: string; fields: string[] }>;
};

type AdditionalInfoPayload = {
    alias: string;
    ref: string;
    phone: string;
    address_road: string;
    address_zip: string;
    address_town: string;
    active: boolean;
    mailing: boolean;
};

type MetaFormPayload = {
    key: string;
    custom_key: string;
    value: string;
    value_json: Record<string, string>;
    value_file: File | null;
    type: string;
    sort_order: number;
};

export default function AdditionalInfo() {
    const page = usePage<PageProps>();
    const { auth, editingUser } = page.props;
    const targetUser = editingUser ?? auth.user;
    const isSelf = !editingUser || editingUser.id === auth.user?.id;
    const isAdminPath = page.url.startsWith('/admin/users/');
    const userMeta = page.props.userMeta ?? [];
    const metaKeyOptions = page.props.metaKeyOptions ?? [];
    const metaKeyConfig = page.props.metaKeyConfig ?? {};

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
        phone: (targetUser as any)?.phone ?? '',
        address_road: (targetUser as any)?.address_road ?? '',
        address_zip: (targetUser as any)?.address_zip ?? '',
        address_town: (targetUser as any)?.address_town ?? '',
        active: Boolean((targetUser as any)?.active ?? true),
        mailing: Boolean((targetUser as any)?.mailing ?? false),
    });

    const newMetaForm = useForm<MetaFormPayload>({
        key: metaKeyOptions[0]?.value ?? 'custom',
        custom_key: '',
        value: '',
        value_json: { number: '', road: '', zip: '', town: '' },
        value_file: null,
        type: '',
        sort_order: 0,
    });

    const selectedNewMetaInput = resolveInputKind(newMetaForm.data.key, metaKeyConfig);

    const saveMain = (e: FormEvent) => {
        e.preventDefault();
        patch(updateUrl, { preserveScroll: true });
    };

    const addMeta = (e: FormEvent) => {
        e.preventDefault();

        const actualKey = resolveActualKey(newMetaForm.data.key, newMetaForm.data.custom_key);
        const mappedType = metaKeyConfig[actualKey]?.input ?? selectedNewMetaInput;

        newMetaForm.transform((payload) => ({
            ...payload,
            key: actualKey,
            type: mappedType,
        }));

        newMetaForm.post(metaBaseUrl, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                newMetaForm.reset('custom_key', 'value', 'type', 'sort_order', 'value_file');
                newMetaForm.setData('value_json', { number: '', road: '', zip: '', town: '' });
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
                            <div className="grid gap-4 md:grid-cols-3">
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
                                    <Label htmlFor="phone">Telephone</Label>
                                    <Input id="phone" value={data.phone} onChange={(e) => setData('phone', e.target.value)} />
                                    <InputError message={errors.phone} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="address_road">Adresse</Label>
                                    <Input id="address_road" value={data.address_road} onChange={(e) => setData('address_road', e.target.value)} />
                                    <InputError message={errors.address_road} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="address_town">Ville</Label>
                                    <Input id="address_town" value={data.address_town} onChange={(e) => setData('address_town', e.target.value)} />
                                    <InputError message={errors.address_town} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="address_zip">Code postal</Label>
                                    <Input id="address_zip" value={data.address_zip} onChange={(e) => setData('address_zip', e.target.value)} />
                                    <InputError message={errors.address_zip} />
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
                        <h2 className="mb-4 text-xl font-semibold">Création de champs dynamiques</h2>

                        <form onSubmit={addMeta} className="mb-6 space-y-3">
                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label>Cle</Label>
                                    <select
                                        className="h-10 rounded-md border bg-card px-3"
                                        value={newMetaForm.data.key}
                                        onChange={(e) => newMetaForm.setData('key', e.target.value)}
                                    >
                                        {metaKeyOptions.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid gap-2">
                                    <Label>Ordre</Label>
                                    {/* <Label>Type detecte</Label> */}
                                    {/* <Input value={selectedNewMetaInput} readOnly /> */}
                                    <Input
                                        type="number"
                                        placeholder="ordre"
                                        value={String(newMetaForm.data.sort_order)}
                                        onChange={(e) => newMetaForm.setData('sort_order', Number(e.target.value || 0))}
                                    />
                                </div>

                                {newMetaForm.data.key === 'custom' && (
                                    <>
                                        <div className="grid gap-2 ">
                                            <Label>Nom de la cle custom</Label>
                                            <Input
                                                placeholder="ex: contact.secondary_email"
                                                value={newMetaForm.data.custom_key}
                                                onChange={(e) => newMetaForm.setData('custom_key', e.target.value)}
                                            />
                                        </div>

                                        <div className='grid gap-2'>
                                            <Label>Valeur</Label>
                                            <DynamicValueInput
                                                inputKind={selectedNewMetaInput}
                                                fields={metaKeyConfig[newMetaForm.data.key]?.fields ?? []}
                                                data={newMetaForm.data}
                                                setData={newMetaForm.setData}
                                            />
                                        </div>

                                    </>
                                )}
                            </div>

                            {newMetaForm.data.key !== 'custom' && (
                                <DynamicValueInput
                                    inputKind={selectedNewMetaInput}
                                    fields={metaKeyConfig[newMetaForm.data.key]?.fields ?? []}
                                    data={newMetaForm.data}
                                    setData={newMetaForm.setData}
                                />
                            )}


                            <div className="pt-2">
                                {/* <Input
                                    type="number"
                                    placeholder="ordre"
                                    value={String(newMetaForm.data.sort_order)}
                                    onChange={(e) => newMetaForm.setData('sort_order', Number(e.target.value || 0))}
                                /> */}
                                <Button type="submit" disabled={newMetaForm.processing}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Ajouter
                                </Button>
                            </div>
                        </form>
                        <InputError message={newMetaForm.errors.key || newMetaForm.errors.value || newMetaForm.errors.type} />

                        {/* <div className="">
                            {userMeta.length === 0 && (
                                <p className="text-sm text-muted-foreground">Aucun champ dynamique.</p>
                            )}
                        </div> */}
                    </Card>

                    {userMeta.length > 0 && (
                        <Card className="p-6">
                            <h2 className="mb-4 text-xl font-semibold">Champs dynamiques</h2>
                            {userMeta.map((item) => (
                                <MetaRow
                                    key={item.id}
                                    item={item}
                                    metaBaseUrl={metaBaseUrl}
                                    metaKeyOptions={metaKeyOptions}
                                    metaKeyConfig={metaKeyConfig}
                                />
                            ))}
                        </Card>
                    )}
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}

function MetaRow({
    item,
    metaBaseUrl,
    metaKeyOptions,
    metaKeyConfig,
}: {
    item: UserMetaItem;
    metaBaseUrl: string;
    metaKeyOptions: Array<{ value: string; label: string }>;
    metaKeyConfig: Record<string, { input: string; fields: string[] }>;
}) {
    const knownKeys = useMemo(() => new Set(metaKeyOptions.map((x) => x.value)), [metaKeyOptions]);
    const startsAsCustom = !knownKeys.has(item.key);

    const form = useForm<MetaFormPayload>({
        key: startsAsCustom ? 'custom' : item.key,
        custom_key: startsAsCustom ? item.key : '',
        value: resolvePersistedFileValue(item.value),
        value_json: parseJsonValue(item.value),
        value_file: null,
        type: item.type ?? '',
        sort_order: item.sort_order ?? 0,
    });

    const actualKey = resolveActualKey(form.data.key, form.data.custom_key);
    const inputKind = resolveInputKind(actualKey, metaKeyConfig);
    const fields = metaKeyConfig[actualKey]?.fields ?? [];

    const save = (e: FormEvent) => {
        e.preventDefault();

        form.transform((payload) => ({
            ...payload,
            key: actualKey,
            type: inputKind,
        }));

        form.put(`${metaBaseUrl}/${item.id}`, {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    const remove = () => {
        form.delete(`${metaBaseUrl}/${item.id}`, { preserveScroll: true });
    };

    return (
        <form onSubmit={save} className="space-y-4 rounded-md border p-4">
            <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label>Cle</Label>
                    <select
                        className="h-10 rounded-md border bg-card px-3"
                        value={form.data.key}
                        onChange={(e) => form.setData('key', e.target.value)}
                    >
                        {metaKeyOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                        <option value="custom">Custom</option>
                    </select>
                </div>

                <div className="grid gap-2">
                    <Label>Ordre</Label>
                    <Input
                        type="number"
                        value={String(form.data.sort_order)}
                        onChange={(e) => form.setData('sort_order', Number(e.target.value || 0))}
                    />
                </div>

                {form.data.key === 'custom' && (
                    <>
                        <div className="grid gap-2">
                            <Label>Nom de la cle custom</Label>
                            <Input
                                placeholder="Nom de la cle custom"
                                value={form.data.custom_key}
                                onChange={(e) => form.setData('custom_key', e.target.value)}
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Valeur</Label>
                            <DynamicValueInput
                                inputKind={inputKind}
                                fields={fields}
                                data={form.data}
                                setData={form.setData}
                            />
                        </div>
                    </>
                )}
            </div>

            {form.data.key !== 'custom' && (
                <DynamicValueInput
                    inputKind={inputKind}
                    fields={fields}
                    data={form.data}
                    setData={form.setData}
                />
            )}

            <div className="pt-2">
                <div className="flex items-center justify-between gap-2">
                    <Button type="submit" disabled={form.processing}>
                        <Save className="mr-2 h-4 w-4" />
                        Sauver
                    </Button>
                    <Button type="button" variant="destructive-outline" size="icon" onClick={remove} disabled={form.processing}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </form>
    );
}

function resolveActualKey(key: string, customKey: string): string {
    return key === 'custom' ? customKey.trim() : key;
}

function resolveInputKind(key: string, config: Record<string, { input: string; fields: string[] }>): string {
    if (!key || key === 'custom') {
        return 'input';
    }

    return config[key]?.input ?? 'input';
}

function parseJsonValue(raw: string | null): Record<string, string> {
    if (!raw) {
        return { number: '', road: '', zip: '', town: '' };
    }

    try {
        const decoded = JSON.parse(raw);
        return {
            number: String(decoded?.number ?? ''),
            road: String(decoded?.road ?? ''),
            zip: String(decoded?.zip ?? ''),
            town: String(decoded?.town ?? ''),
        };
    } catch {
        return { number: '', road: '', zip: '', town: '' };
    }
}

function DynamicValueInput({
    inputKind,
    fields,
    data,
    setData,
}: {
    inputKind: string;
    fields: string[];
    data: MetaFormPayload;
    setData: (key: keyof MetaFormPayload, value: any) => void;
}) {
    const selectedPreview = useSelectedFilePreview(data.value_file);
    const persistedPreview = resolveImagePreview(data.value);

    if (inputKind === 'textarea') {
        return (
            <textarea
                className="min-h-24 w-full rounded-md border p-3"
                placeholder="Valeur"
                value={data.value}
                onChange={(e) => setData('value', e.target.value)}
            />
        );
    }

    if (inputKind === 'json') {
        const jsonFields = fields.length > 0 ? fields : ['number', 'road', 'zip', 'town'];
        return (
            <div className='grid gap-3 md:grid-cols-2'>
                {jsonFields.map((field) => (
                    <Input
                        key={field}
                        placeholder={field}
                        value={data.value_json[field] ?? ''}
                        onChange={(e) =>
                            setData('value_json', {
                                ...data.value_json,
                                [field]: e.target.value,
                            })
                        }
                    />
                ))}
            </div>
        );
    }

    if (inputKind === 'file/image') {
        return (
            <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                    <Input
                        placeholder="Valeur actuelle (path/url)"
                        value={data.value}
                        onChange={(e) => setData('value', e.target.value)}
                    />
                    <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setData('value_file', e.target.files?.[0] ?? null)}
                    />
                </div>

                {(selectedPreview || persistedPreview) && (
                    <div className="rounded-md border p-3">
                        <p className="mb-2 text-sm text-muted-foreground">Apercu</p>
                        <img
                            src={selectedPreview ?? persistedPreview ?? ''}
                            alt="Apercu image"
                            className="max-h-52 rounded-md border object-contain"
                        />
                    </div>
                )}
            </div>
        );
    }

    if (inputKind === 'tel') {
        return (
            <Input
                type="tel"
                placeholder="+33123456789"
                value={data.value}
                onChange={(e) => setData('value', e.target.value)}
            />
        );
    }

    if (inputKind === 'number tel') {
        return (
            <Input
                type="tel"
                placeholder="+33123456789"
                value={data.value}
                onChange={(e) => setData('value', e.target.value)}
            />
        );
    }

    return (
        <Input
            type={inputKind === 'mail' ? 'email' : 'text'}
            placeholder="Valeur"
            value={data.value}
            onChange={(e) => setData('value', e.target.value)}
            className=''
        />
    );
}

function resolvePersistedFileValue(raw: string | null): string {
    if (!raw) {
        return '';
    }

    const decoded = safeJson(raw);
    if (decoded && typeof decoded.url === 'string') {
        return decoded.url;
    }

    return raw;
}

function resolveImagePreview(raw: string): string | null {
    const decoded = safeJson(raw);
    if (decoded) {
        if (typeof decoded.medium_url === 'string' && decoded.medium_url) {
            return decoded.medium_url;
        }
        if (typeof decoded.thumb_url === 'string' && decoded.thumb_url) {
            return decoded.thumb_url;
        }
        if (typeof decoded.url === 'string' && decoded.url) {
            return decoded.url;
        }
    }

    const value = raw.trim();
    if (!value) {
        return null;
    }

    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
        return value;
    }

    if (value.startsWith('/')) {
        return value;
    }

    return `/storage/${value}`;
}

function safeJson(value: string): Record<string, any> | null {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function useSelectedFilePreview(file: File | null): string | null {
    const [preview, setPreview] = useState<string | null>(null);

    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [file]);

    return preview;
}
