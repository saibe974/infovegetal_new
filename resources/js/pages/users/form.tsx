import SearchSelect from '@/components/app/search-select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import { UserFormToolbar } from '@/components/users/user-form-toolbar';
import {
    UserMetaFields,
    type UserMetaDraft,
} from '@/components/users/user-meta-fields';
import { withAppLayout } from '@/layouts/app-layout';
import users from '@/routes/users';
import type { BreadcrumbItem, User } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftCircle, KeyRound, Mail } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';

type Role = { id: number; name: string };
type MetaOption = { value: string; label: string };
type MetaConfig = Record<string, { input: string; fields: string[] }>;
type Props = {
    user?: User;
    allRoles?: Role[];
    metaKeyOptions?: MetaOption[];
    metaKeyConfig?: MetaConfig;
};
type UserFormPayload = {
    name: string;
    email: string;
    password: string;
    alias: string;
    ref: string;
    phone: string;
    address_road: string;
    address_zip: string;
    address_town: string;
    active: boolean;
    mailing: boolean;
    roles: number[];
    parent_id: number | null;
    sync_metas: boolean;
    metas: UserMetaDraft[];
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Users', href: users.index().url },
    { title: 'Créer', href: '#' },
];

export default withAppLayout<Props>(
    breadcrumbs,
    false,
    ({ user, allRoles = [], metaKeyOptions = [], metaKeyConfig = {} }) => {
        const isNew = !user?.id;
        const form = useForm<UserFormPayload>({
            name: user?.name ?? '',
            email: user?.email ?? '',
            password: '',
            alias: user?.alias ?? '',
            ref: user?.ref ?? '',
            phone: user?.phone ?? '',
            address_road: user?.address_road ?? '',
            address_zip: user?.address_zip ?? '',
            address_town: user?.address_town ?? '',
            active: true,
            mailing: false,
            roles: [],
            parent_id: null,
            sync_metas: true,
            metas: [],
        });
        const [roleSearch, setRoleSearch] = useState('');
        const isGroup = useMemo(
            () =>
                form.data.roles.some(
                    (id) =>
                        allRoles.find((role) => role.id === id)?.name ===
                        'group',
                ),
            [form.data.roles, allRoles],
        );
        const [selectedParent, setSelectedParent] = useState<{
            id: number;
            name: string;
        } | null>(null);

        const save = () => {
            const url = isNew
                ? users.store().url
                : users.update({ user: user!.id }).url;
            form.transform((data) => ({
                ...data,
                ...(isNew ? {} : { _method: 'put' }),
            }));
            form.post(url, { forceFormData: true, preserveScroll: true });
        };
        const submit = (event: FormEvent) => {
            event.preventDefault();
            save();
        };
        const setGroup = () => {
            const groupRole = allRoles.find((role) => role.name === 'group');
            if (!groupRole) return;
            form.setData(
                'roles',
                isGroup
                    ? form.data.roles.filter((id) => id !== groupRole.id)
                    : [
                          ...form.data.roles.filter(
                              (id) => id !== groupRole.id,
                          ),
                          groupRole.id,
                      ],
            );
        };

        return (
            <div className="space-y-6 p-2 lg:p-4">
                <Head
                    title={
                        isNew
                            ? 'Créer un utilisateur'
                            : `Éditer l'utilisateur #${user?.id ?? ''}`
                    }
                />
                <div className="flex items-center gap-4 py-2">
                    <Link
                        href="#"
                        onClick={(event) => {
                            event.preventDefault();
                            window.history.back();
                        }}
                        className="transition-colors duration-200 hover:text-gray-500"
                    >
                        <ArrowLeftCircle size={35} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold">
                            {isNew
                                ? 'Créer un utilisateur'
                                : 'Éditer un utilisateur'}
                        </h1>
                        <p className="text-muted-foreground">
                            {isNew
                                ? 'Créer et configurer un nouvel utilisateur'
                                : "Modifier les informations de l'utilisateur"}
                        </p>
                    </div>
                </div>

                <UserFormToolbar
                    parent={selectedParent}
                    onParentChange={(parent) => {
                        setSelectedParent(parent);
                        form.setData('parent_id', parent?.id ?? null);
                    }}
                    user={user ?? null}
                    canView={Boolean(user?.abilities?.view)}
                    canDelete={Boolean(user?.abilities?.delete)}
                    onSave={save}
                    saving={form.processing}
                />

                <form onSubmit={submit} className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                        <div className="space-y-6 xl:col-span-5">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <KeyRound size={20} />
                                        Rôles et accès
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {isNew && (
                                        <div className="grid gap-2">
                                            <Label>Rôles</Label>
                                            <SearchSelect
                                                value={roleSearch}
                                                onChange={setRoleSearch}
                                                onSubmit={(selection) => {
                                                    const ids = (
                                                        selection
                                                            ?.trim()
                                                            .split(/\s+/) ?? []
                                                    )
                                                        .map(
                                                            (name) =>
                                                                allRoles.find(
                                                                    (role) =>
                                                                        role.name ===
                                                                        name,
                                                                )?.id,
                                                        )
                                                        .filter(
                                                            (
                                                                id,
                                                            ): id is number =>
                                                                id !==
                                                                undefined,
                                                        );
                                                    form.setData('roles', ids);
                                                }}
                                                propositions={allRoles.map(
                                                    (role) => role.name,
                                                )}
                                                selection={form.data.roles.map(
                                                    (id) => {
                                                        const role =
                                                            allRoles.find(
                                                                (candidate) =>
                                                                    candidate.id ===
                                                                    id,
                                                            );
                                                        return role
                                                            ? {
                                                                  value: role.name,
                                                                  label: role.name,
                                                              }
                                                            : {
                                                                  value: String(
                                                                      id,
                                                                  ),
                                                                  label: String(
                                                                      id,
                                                                  ),
                                                              };
                                                    },
                                                )}
                                                loading={false}
                                                minQueryLength={0}
                                            />
                                            <div className="flex flex-wrap gap-1">
                                                {form.data.roles.map((id) => {
                                                    const role = allRoles.find(
                                                        (candidate) =>
                                                            candidate.id === id,
                                                    );
                                                    return role ? (
                                                        <Badge
                                                            key={id}
                                                            variant="secondary"
                                                        >
                                                            {role.name}
                                                        </Badge>
                                                    ) : null;
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    {isNew && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="is_group"
                                                checked={isGroup}
                                                onChange={setGroup}
                                                className="h-4 w-4"
                                            />
                                            <Label htmlFor="is_group">
                                                Compte groupe
                                            </Label>
                                        </div>
                                    )}
                                    {isGroup && (
                                        <p className="text-sm text-muted-foreground">
                                            Email et mot de passe optionnels
                                            pour un compte groupe.
                                        </p>
                                    )}
                                    {isNew && !isGroup && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="password">
                                                Mot de passe
                                            </Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                value={form.data.password}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'password',
                                                        event.target.value,
                                                    )
                                                }
                                                required
                                                autoComplete="new-password"
                                            />
                                            <InputError
                                                message={form.errors.password}
                                            />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        <div className="space-y-6 xl:col-span-7">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-lg">
                                        <Mail size={20} />
                                        Informations du profil
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label htmlFor="name">Nom</Label>
                                            <Input
                                                id="name"
                                                value={form.data.name}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'name',
                                                        event.target.value,
                                                    )
                                                }
                                                required
                                                autoComplete="name"
                                            />
                                            <InputError
                                                message={form.errors.name}
                                            />
                                        </div>
                                        {!isGroup && (
                                            <div className="grid gap-2">
                                                <Label htmlFor="email">
                                                    Adresse email
                                                </Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    value={form.data.email}
                                                    onChange={(event) =>
                                                        form.setData(
                                                            'email',
                                                            event.target.value,
                                                        )
                                                    }
                                                    required
                                                    autoComplete="email"
                                                />
                                                <InputError
                                                    message={form.errors.email}
                                                />
                                            </div>
                                        )}
                                        <div className="grid gap-2">
                                            <Label htmlFor="alias">Alias</Label>
                                            <Input
                                                id="alias"
                                                value={form.data.alias}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'alias',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={form.errors.alias}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="ref">
                                                Référence
                                            </Label>
                                            <Input
                                                id="ref"
                                                value={form.data.ref}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'ref',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={form.errors.ref}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="phone">
                                                Téléphone
                                            </Label>
                                            <Input
                                                id="phone"
                                                value={form.data.phone}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'phone',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={form.errors.phone}
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="address_road">
                                                Adresse
                                            </Label>
                                            <Input
                                                id="address_road"
                                                value={form.data.address_road}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'address_road',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={
                                                    form.errors.address_road
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="address_zip">
                                                Code postal
                                            </Label>
                                            <Input
                                                id="address_zip"
                                                value={form.data.address_zip}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'address_zip',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={
                                                    form.errors.address_zip
                                                }
                                            />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="address_town">
                                                Ville
                                            </Label>
                                            <Input
                                                id="address_town"
                                                value={form.data.address_town}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'address_town',
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <InputError
                                                message={
                                                    form.errors.address_town
                                                }
                                            />
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-6 pt-4">
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="active"
                                                type="checkbox"
                                                checked={form.data.active}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'active',
                                                        event.target.checked,
                                                    )
                                                }
                                            />
                                            <Label htmlFor="active">
                                                Actif
                                            </Label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="mailing"
                                                type="checkbox"
                                                checked={form.data.mailing}
                                                onChange={(event) =>
                                                    form.setData(
                                                        'mailing',
                                                        event.target.checked,
                                                    )
                                                }
                                            />
                                            <Label htmlFor="mailing">
                                                Accepte le mailing
                                            </Label>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                            <UserMetaFields
                                value={form.data.metas}
                                onChange={(metas) =>
                                    form.setData('metas', metas)
                                }
                                metaKeyOptions={metaKeyOptions}
                                metaKeyConfig={metaKeyConfig}
                            />
                        </div>
                    </div>
                </form>
            </div>
        );
    },
);
