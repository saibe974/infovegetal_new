import { send } from '@/routes/verification';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { StickyBar } from '@/components/ui/sticky-bar';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ImageIcon, Mail, Plus, Save, Trash2, Upload, Users2Icon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import DeleteUser from '@/components/users/delete-user';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SearchSelect from '@/components/app/search-select';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAdminUser, update as updateAdminUser } from '@/routes/users';
import { edit as editProfile, update as updateProfile } from '@/routes/profile';
import { useI18n } from '@/lib/i18n';
import { getEffectiveUser, isAdmin } from '@/lib/roles';

export type UserMetaItem = {
    id: number;
    user_id: number;
    key: string;
    value: string | null;
    type: string | null;
    sort_order: number;
};

export type MetaFormPayload = {
    key: string;
    custom_key: string;
    value: string;
    value_json: Record<string, string>;
    value_file: File | null;
    type: string;
    sort_order: number;
};

export function resolveActualKey(key: string, customKey: string): string {
    return key === 'custom' ? customKey.trim() : key;
}

export function resolveInputKind(key: string, config: Record<string, { input: string; fields: string[] }>): string {
    if (!key || key === 'custom') {
        return 'input';
    }

    return config[key]?.input ?? 'input';
}

export function parseJsonValue(raw: string | null): Record<string, string> {
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

export function safeJson(value: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

export function resolvePersistedFileValue(raw: string | null): string {
    if (!raw) {
        return '';
    }

    const decoded = safeJson(raw);
    if (decoded && typeof decoded.url === 'string') {
        return decoded.url;
    }

    return raw;
}

export function resolveImagePreview(raw: string): string | null {
    const decoded = safeJson(raw);
    if (decoded) {
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

export function useSelectedFilePreview(file: File | null): string | null {
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

export function DynamicValueInput({
    inputKind,
    fields,
    data,
    setData,
}: {
    inputKind: string;
    fields: string[];
    data: MetaFormPayload;
    setData: (key: keyof MetaFormPayload, value: unknown) => void;
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

    if (inputKind === 'tel' || inputKind === 'number tel') {
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
        />
    );
}

export function MetaRow({
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

    const save = () => {
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
        <div className="space-y-4 rounded-md border p-4">
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
                    <Button type="button" onClick={save} disabled={form.processing}>
                        <Save className="mr-2 h-4 w-4" />
                        Sauver
                    </Button>
                    <Button type="button" variant="destructive-outline" size="icon" onClick={remove} disabled={form.processing}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

type PageProps = SharedData & {
    locale?: string;
    errors?: Record<string, string>;
    userAbilities?: { move?: boolean };
    userMeta?: UserMetaItem[];
    metaKeyOptions?: Array<{ value: string; label: string }>;
    metaKeyConfig?: Record<string, { input: string; fields: string[] }>;
};

type ProfileFormPayload = {
    name: string;
    email: string;
    alias: string;
    ref: string;
    phone: string;
    address_road: string;
    address_zip: string;
    address_town: string;
    active: boolean;
    mailing: boolean;
    parent_id: number | null;
};

export default function Profile({
    mustVerifyEmail,
    status,
    editingUser,
}: {
    mustVerifyEmail: boolean;
    status?: string;
    editingUser?: User;
}) {
    const page = usePage<SharedData>();
    const pageProps = page.props as PageProps;
    const { auth } = pageProps;
    const errors = pageProps.errors ?? {};
    const { t } = useI18n();
    const targetUser = editingUser ?? auth.user;
    const targetUserWithParent = (targetUser ?? {}) as User & {
        parent_id?: number | null;
        parent?: { name?: string | null } | null;
    };
    const isSelf = !editingUser || editingUser.id === auth.user?.id;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Profile settings'),
            href: (isSelf ? editProfile() : editAdminUser(targetUser!.id)).url,
        },
    ];

    const effectiveUser = getEffectiveUser(auth);
    const isAdminUser = isAdmin(effectiveUser);
    const userAbilities = pageProps.userAbilities ?? {};
    const canManageParent = !!userAbilities.move;
    const isAdminEditContext = page.url.startsWith('/admin/users/') || isAdminUser;

    const isGroup = useMemo(
        () => (targetUser?.roles ?? []).some((role) => role?.name === 'group'),
        [targetUser?.roles],
    );

    const userMeta = useMemo(
        () => (pageProps.userMeta ?? []) as UserMetaItem[],
        [pageProps.userMeta],
    );
    const metaKeyOptions = pageProps.metaKeyOptions ?? [];
    const metaKeyConfig = pageProps.metaKeyConfig ?? {};

    // ── Profile form ─────────────────────────────────────────────────────────
    const initialParentId = targetUserWithParent.parent_id ?? null;

    const profileForm = useForm<ProfileFormPayload>({
        name: targetUser?.name ?? '',
        email: targetUser?.email ?? '',
        alias: targetUser?.alias ?? '',
        ref: targetUser?.ref ?? '',
        phone: targetUser?.phone ?? '',
        address_road: targetUser?.address_road ?? '',
        address_zip: targetUser?.address_zip ?? '',
        address_town: targetUser?.address_town ?? '',
        active: Boolean(targetUser?.active ?? true),
        mailing: Boolean(targetUser?.mailing ?? false),
        parent_id: initialParentId,
    });

    const updateUrl = isAdminEditContext
        ? updateAdminUser({ user: targetUser!.id }).url
        : updateProfile().url;

    const submitProfile = (e: FormEvent) => {
        e.preventDefault();
        if (isAdminEditContext) {
            profileForm.put(updateUrl, { preserveScroll: true });
        } else {
            profileForm.patch(updateUrl, { preserveScroll: true });
        }
    };

    // ── Logo ─────────────────────────────────────────────────────────────────
    const logoMeta = useMemo(() => userMeta.find((m) => m.key === 'logo'), [userMeta]);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const selectedLogoPreview = useSelectedFilePreview(logoFile);
    const persistedLogoPreview = useMemo(
        () => (logoMeta?.value ? resolveImagePreview(logoMeta.value) : null),
        [logoMeta],
    );
    const logoPreview = selectedLogoPreview ?? persistedLogoPreview;

    const metaBaseUrl = isAdminEditContext
        ? `/admin/users/${targetUser!.id}/additional-info/meta`
        : '/settings/additional-info/meta';

    const logoForm = useForm({
        key: 'logo' as string,
        custom_key: '',
        value: '',
        value_json: { number: '', road: '', zip: '', town: '' },
        value_file: null as File | null,
        type: 'file/image' as string,
        sort_order: 0,
    });

    const uploadLogo = () => {
        logoForm.transform((payload) => ({
            ...payload,
            key: 'logo',
            type: 'file/image',
        }));
        logoForm.post(metaBaseUrl, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setLogoFile(null);
            },
        });
    };

    // ── Parent ────────────────────────────────────────────────────────────────
    const [parentModalOpen, setParentModalOpen] = useState(false);
    const [parentSearch, setParentSearch] = useState('');
    const [parentSearchItems, setParentSearchItems] = useState<{ id: number; name: string; email: string; depth: number }[]>([]);
    const [parentSearchLoading, setParentSearchLoading] = useState(false);
    const initialParent = targetUserWithParent.parent_id
        ? { id: targetUserWithParent.parent_id, name: targetUserWithParent.parent?.name ?? `#${targetUserWithParent.parent_id}` }
        : null;
    const [selectedParent, setSelectedParent] = useState<{ id: number; name: string } | null>(initialParent);

    const handleSelectParent = (parent: { id: number; name: string } | null) => {
        setSelectedParent(parent);
        profileForm.setData('parent_id', parent?.id ?? null);
    };
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
                        ((payload.items || []) as Array<Record<string, unknown>>).map((item) => ({
                            id: Number(item.id),
                            name: String(item.name ?? ''),
                            email: String(item.email ?? ''),
                            depth: Number(item.depth ?? 0),
                        })),
                    );
                }
            } finally {
                setParentSearchLoading(false);
            }
        }, 300);
    };

    // ── Meta creation form (from additional-info.tsx#200-287) ────────────────
    const metaForm = useForm<MetaFormPayload>({
        key: metaKeyOptions[0]?.value ?? 'custom',
        custom_key: '',
        value: '',
        value_json: { number: '', road: '', zip: '', town: '' },
        value_file: null,
        type: '',
        sort_order: 0,
    });

    const selectedNewMetaInput = resolveInputKind(metaForm.data.key, metaKeyConfig);

    const addMeta = () => {
        const actualKey = resolveActualKey(metaForm.data.key, metaForm.data.custom_key);
        const mappedType = metaKeyConfig[actualKey]?.input ?? selectedNewMetaInput;

        metaForm.transform((payload) => ({
            ...payload,
            key: actualKey,
            type: mappedType,
        }));

        metaForm.post(metaBaseUrl, {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                metaForm.reset('custom_key', 'value', 'type', 'sort_order', 'value_file');
                metaForm.setData('value_json', { number: '', road: '', zip: '', town: '' });
            },
        });
    };

    // ── Non-logo metas for display ───────────────────────────────────────────
    const nonLogoMetas = useMemo(() => userMeta.filter((m) => m.key !== 'logo'), [userMeta]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Profile settings')} />

            <SettingsLayout>
                <div className="space-y-6">

                    <form onSubmit={submitProfile} className="space-y-6">
                        <StickyBar topOffsetElement=".top-sticky, .settings-sticky">
                            <div className="ml-auto">
                                <Button type="submit" disabled={profileForm.processing}>
                                    <Save className="mr-2 h-4 w-4" />
                                    {t('Save')}
                                </Button>
                            </div>
                        </StickyBar>

                        {/* Vérification d'email non vérifiée */}
                        {mustVerifyEmail &&
                            targetUserWithParent.email_verified_at === null && (
                                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                                    <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-sm text-amber-900">
                                            {t('The user email address is unverified.')}{' '}
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
                                        {status === 'verification-link-sent' && (
                                            <div className="mt-2 text-sm font-medium text-green-600">{t('A new verification link has been sent to the email address.')}</div>
                                        )}
                                    </div>
                                </div>
                            )}

                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

                            {/* ────── COLONNE 1 ────── */}
                            <div className="xl:col-span-5 space-y-6">

                                {/* Logo */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg">{t('Logo')}</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex flex-col items-center gap-3">
                                            {logoPreview ? (
                                                <img
                                                    src={logoPreview}
                                                    alt="Logo"
                                                    className="h-40 w-40 rounded-lg border object-contain"
                                                />
                                            ) : (
                                                <div className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-lg border bg-muted">
                                                    <ImageIcon className="size-12 text-muted-foreground/60" />
                                                    <span className="text-sm text-muted-foreground">No image</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0] ?? null;
                                                    setLogoFile(file);
                                                    logoForm.setData('value_file', file);
                                                }}
                                            />
                                            <InputError message={logoForm.errors.value_file} />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                className="w-full"
                                                disabled={!logoFile || logoForm.processing}
                                                onClick={uploadLogo}
                                            >
                                                <Upload className="mr-2 h-4 w-4" />
                                                {t('Upload')}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Création de champs dynamiques */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg">{t('Dynamic fields creation')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            <div className="grid gap-3">
                                                <div className="grid gap-2">
                                                    <Label>Clé</Label>
                                                    <select
                                                        className="h-10 rounded-md border bg-card px-3"
                                                        value={metaForm.data.key}
                                                        onChange={(e) => metaForm.setData('key', e.target.value)}
                                                    >
                                                        {metaKeyOptions.map((opt) => (
                                                            <option key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* <div className="grid gap-2">
                                                    <Label>Ordre</Label>
                                                    <Input
                                                        type="number"
                                                        placeholder="ordre"
                                                        value={String(metaForm.data.sort_order)}
                                                        onChange={(e) => metaForm.setData('sort_order', Number(e.target.value || 0))}
                                                    />
                                                </div> */}

                                                {metaForm.data.key === 'custom' && (
                                                    <>
                                                        <div className="grid gap-2">
                                                            <Label>Nom de la clé custom</Label>
                                                            <Input
                                                                placeholder="ex: contact.secondary_email"
                                                                value={metaForm.data.custom_key}
                                                                onChange={(e) => metaForm.setData('custom_key', e.target.value)}
                                                            />
                                                        </div>

                                                        <div className="grid gap-2">
                                                            <Label>Valeur</Label>
                                                            <DynamicValueInput
                                                                inputKind={selectedNewMetaInput}
                                                                fields={metaKeyConfig[metaForm.data.key]?.fields ?? []}
                                                                data={metaForm.data}
                                                                setData={metaForm.setData}
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </div>

                                            {metaForm.data.key !== 'custom' && (
                                                <DynamicValueInput
                                                    inputKind={selectedNewMetaInput}
                                                    fields={metaKeyConfig[metaForm.data.key]?.fields ?? []}
                                                    data={metaForm.data}
                                                    setData={metaForm.setData}
                                                />
                                            )}

                                            <div className="pt-2">
                                                <Button type="button" onClick={addMeta} disabled={metaForm.processing}>
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Ajouter
                                                </Button>
                                            </div>
                                        </div>
                                        <InputError message={metaForm.errors.key || metaForm.errors.value || metaForm.errors.type} />
                                    </CardContent>
                                </Card>
                            </div>

                            {/* ────── COLONNE 2 ────── */}
                            <div className="xl:col-span-7 space-y-6">

                                {/* Informations Personnelles */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Mail size={20} />
                                            {t('Profile information')}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="grid gap-2">
                                                <Label htmlFor="name">{t('Name')}</Label>
                                                <Input
                                                    id="name"
                                                    value={profileForm.data.name}
                                                    onChange={(e) => profileForm.setData('name', e.target.value)}
                                                    required
                                                    autoComplete="name"
                                                    placeholder={t('Full name')}
                                                />
                                                <InputError message={errors.name} />
                                            </div>

                                            {!isGroup && (
                                                <div className="grid gap-2">
                                                    <Label htmlFor="email">{t('Email address')}</Label>
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        value={profileForm.data.email}
                                                        onChange={(e) => profileForm.setData('email', e.target.value)}
                                                        required
                                                        autoComplete="username"
                                                        placeholder={t('Email address')}
                                                    />
                                                    <InputError message={errors.email} />
                                                </div>
                                            )}

                                            <div className="grid gap-2">
                                                <Label htmlFor="alias">Alias</Label>
                                                <Input
                                                    id="alias"
                                                    value={profileForm.data.alias}
                                                    onChange={(e) => profileForm.setData('alias', e.target.value)}
                                                />
                                                <InputError message={errors.alias} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="ref">Référence</Label>
                                                <Input
                                                    id="ref"
                                                    value={profileForm.data.ref}
                                                    onChange={(e) => profileForm.setData('ref', e.target.value)}
                                                />
                                                <InputError message={errors.ref} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="phone">Téléphone</Label>
                                                <Input
                                                    id="phone"
                                                    value={profileForm.data.phone}
                                                    onChange={(e) => profileForm.setData('phone', e.target.value)}
                                                />
                                                <InputError message={errors.phone} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="address_road">Adresse</Label>
                                                <Input
                                                    id="address_road"
                                                    value={profileForm.data.address_road}
                                                    onChange={(e) => profileForm.setData('address_road', e.target.value)}
                                                />
                                                <InputError message={errors.address_road} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="address_zip">Code postal</Label>
                                                <Input
                                                    id="address_zip"
                                                    value={profileForm.data.address_zip}
                                                    onChange={(e) => profileForm.setData('address_zip', e.target.value)}
                                                />
                                                <InputError message={errors.address_zip} />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="address_town">Ville</Label>
                                                <Input
                                                    id="address_town"
                                                    value={profileForm.data.address_town}
                                                    onChange={(e) => profileForm.setData('address_town', e.target.value)}
                                                />
                                                <InputError message={errors.address_town} />
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-6 pt-4">
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id="active"
                                                    type="checkbox"
                                                    checked={profileForm.data.active}
                                                    onChange={(e) => profileForm.setData('active', e.target.checked)}
                                                />
                                                <Label htmlFor="active">Actif</Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    id="mailing"
                                                    type="checkbox"
                                                    checked={profileForm.data.mailing}
                                                    onChange={(e) => profileForm.setData('mailing', e.target.checked)}
                                                />
                                                <Label htmlFor="mailing">Accepte le mailing</Label>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Champs dynamiques existants */}
                                {nonLogoMetas.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg">Champs dynamiques</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {nonLogoMetas.map((item) => (
                                                <MetaRow
                                                    key={item.id}
                                                    item={item}
                                                    metaBaseUrl={metaBaseUrl}
                                                    metaKeyOptions={metaKeyOptions}
                                                    metaKeyConfig={metaKeyConfig}
                                                />
                                            ))}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>

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
                                        <Button type="button" variant="ghost" size="sm" onClick={() => handleSelectParent(null)}>
                                            {t('Remove')}
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        )}
                    </form>

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
                                                handleSelectParent({ id: u.id, name: u.name });
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
