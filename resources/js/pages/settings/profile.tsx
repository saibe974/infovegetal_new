import { send } from '@/routes/verification';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Form, Head, Link, usePage } from '@inertiajs/react';
import { useState, useMemo, useRef } from 'react';
import { Mail, AlertCircle, Users2Icon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import DeleteUser from '@/components/users/delete-user';
import InputError from '@/components/ui/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import SearchSelect from '@/components/app/search-select';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAdminUser, update as updateAdminUser } from '@/routes/users';
import { edit as editProfile, update as updateProfile } from '@/routes/profile';
import { useI18n } from '@/lib/i18n';
import { getEffectiveUser, isAdmin } from '@/lib/roles';

export default function Profile({
    mustVerifyEmail,
    status,
    editingUser,
}: {
    mustVerifyEmail: boolean;
    status?: string;
    // Optional user being edited (when an admin edits another user)
    editingUser?: User;
}) {
    const page = usePage<SharedData>();
    const { auth, locale } = page.props as SharedData & { locale?: string };
    const pageProps = page.props as any;
    const errors = pageProps.errors ?? {};
    const { t } = useI18n();
    const targetUser = editingUser ?? auth.user;
    const isSelf = !editingUser || editingUser.id === auth.user?.id;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Profile settings'),
            href: (isSelf ? editProfile() : editAdminUser(targetUser!.id)).url,
        },
    ];

    const effectiveUser = getEffectiveUser(auth);
    const isAdminUser = isAdmin(effectiveUser);
    const userAbilities = (usePage().props as any).userAbilities ?? {};
    const canManageParent = !!userAbilities.move;
    const isAdminEditContext = page.url.startsWith('/admin/users/') || isAdminUser;
    const formAction = isAdminEditContext
        ? updateAdminUser.form({ user: targetUser!.id })
        : updateProfile.form();

    const isGroup = useMemo(
        () => (targetUser?.roles ?? []).some((role: any) => role?.name === 'group'),
        [targetUser?.roles],
    );

    // ── Parent ────────────────────────────────────────────────────────────────
    const [parentModalOpen, setParentModalOpen] = useState(false);
    const [parentSearch, setParentSearch] = useState('');
    const [parentSearchItems, setParentSearchItems] = useState<{ id: number; name: string; email: string; depth: number }[]>([]);
    const [parentSearchLoading, setParentSearchLoading] = useState(false);
    const initialParent = (targetUser as any)?.parent_id
        ? { id: (targetUser as any).parent_id, name: (targetUser as any).parent?.name ?? `#${(targetUser as any).parent_id}` }
        : null;
    const [selectedParent, setSelectedParent] = useState<{ id: number; name: string } | null>(initialParent);
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
                        ((payload.items || []) as any[]).map((item) => ({
                            id: item.id,
                            name: item.name,
                            email: item.email,
                            depth: Number(item.depth ?? 0),
                        })),
                    );
                }
            } finally {
                setParentSearchLoading(false);
            }
        }, 300);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Profile settings')} />

            <SettingsLayout>
                <div className="space-y-6">
                    {/* Vérification d'email non vérifiée */}
                    {mustVerifyEmail &&
                        (targetUser as any)?.email_verified_at === null && (
                            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm text-amber-900">
                                        {t('The user email address is unverified.')}{' '}
                                        {/* Only allow resend for own profile */}
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
                                    {status ===
                                        'verification-link-sent' && (
                                            <div className="mt-2 text-sm font-medium text-green-600">{t('A new verification link has been sent to the email address.')}</div>
                                        )}
                                </div>
                            </div>
                        )}

                    <Form {...formAction} className='space-y-6'>

                        {/* Informations Personnelles */}
                        <Card className="p-6">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <Mail size={20} />
                                {t('Profile information')}
                            </h2>

                            <div className="grid gap-2">
                                <Label htmlFor="name">{t('Name')}</Label>

                                <Input
                                    id="name"
                                    className="mt-1 block w-full"
                                    defaultValue={(targetUser as any)?.name || ''}
                                    name="name"
                                    required
                                    autoComplete="name"
                                    placeholder={t('Full name')}
                                />

                                <InputError
                                    className="mt-2"
                                    message={errors.name}
                                />
                            </div>

                            {!isGroup && (
                                <div className="grid gap-2">
                                    <Label htmlFor="email">{t('Email address')}</Label>

                                    <Input
                                        id="email"
                                        type="email"
                                        className="mt-1 block w-full"
                                        defaultValue={(targetUser as any)?.email || ''}
                                        name="email"
                                        required
                                        autoComplete="username"
                                        placeholder={t('Email address')}
                                    />

                                    <InputError
                                        className="mt-2"
                                        message={errors.email}
                                    />
                                </div>
                            )}

                        </Card>

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
                                        <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedParent(null)}>
                                            {t('Remove')}
                                        </Button>
                                    )}
                                </div>
                                <input type="hidden" name="parent_id" value={selectedParent?.id ?? ''} />
                            </Card>
                        )}

                        <div className="flex items-center gap-4 pt-4">
                            <Button type="submit">{t('Save')}</Button>
                        </div>
                    </Form>

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
                                                setSelectedParent({ id: u.id, name: u.name });
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
