import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SearchSelect from '@/components/app/search-select';
import { withAppLayout } from '@/layouts/app-layout';
import users from '@/routes/users';
import type { BreadcrumbItem, User } from '@/types';
import { Form, Head, Link } from '@inertiajs/react';
import { ArrowLeftCircle, SaveIcon, Users2Icon } from 'lucide-react';
import { useMemo, useState, useRef } from 'react';

type Role = { id: number; name: string };

type TreeUser = {
    id: number;
    name: string;
    email: string;
    parent_id: number | null;
    depth: number;
    has_children: boolean;
};

type Props = {
    user?: User;
    allRoles?: Role[];
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: users.index().url,
    },
    {
        title: 'Créer',
        href: '#',
    },
];


export default withAppLayout<Props>(breadcrumbs, false, ({ user, allRoles = [] }) => {
    const isNew = !user || !user.id;

    // ── Rôles ────────────────────────────────────────────────────────────────
    const [roleSearch, setRoleSearch] = useState('');
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

    const isGroup = useMemo(
        () => selectedRoleIds.some((id) => allRoles.find((r) => r.id === id)?.name === 'group'),
        [selectedRoleIds, allRoles],
    );

    // ── Parent (modale) ───────────────────────────────────────────────────────
    const [parentModalOpen, setParentModalOpen] = useState(false);
    const [parentSearch, setParentSearch] = useState('');
    const [parentSearchItems, setParentSearchItems] = useState<TreeUser[]>([]);
    const [parentSearchLoading, setParentSearchLoading] = useState(false);
    const [selectedParent, setSelectedParent] = useState<{ id: number; name: string } | null>(null);
    const parentSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const searchParents = (q: string) => {
        setParentSearch(q);
        if (parentSearchTimer.current) clearTimeout(parentSearchTimer.current);
        if (!q || q.trim().length < 2) {
            setParentSearchItems([]);
            return;
        }
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
                            ...item,
                            parent_id: item.parent_id ?? null,
                            depth: Number(item.depth ?? 0),
                            has_children: Boolean(item.has_children),
                        })),
                    );
                }
            } finally {
                setParentSearchLoading(false);
            }
        }, 300);
    };

    // ── Form action ──────────────────────────────────────────────────────────
    const action = isNew
        ? users.store.form()
        : users.update.form({ user: user!.id });

    return (
        <Form {...action} className="space-y-4">
            <Head title={isNew ? 'Créer un utilisateur' : `Editer l'utilisateur #${user?.id ?? ''}`} />
            <div className="flex items-center py-2 gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <Link
                        href="#"
                        onClick={(e) => { e.preventDefault(); window.history.back(); }}
                        className="hover:text-gray-500 transition-colors duration-200"
                    >
                        <ArrowLeftCircle size={35} />
                    </Link>
                    <h2>{isNew ? 'Créer un utilisateur' : 'Editer un utilisateur'}</h2>
                </div>
            </div>

            <div className="grid items-start gap-8 md:grid-cols-[1fr_350px]">
                <main className="space-y-4">
                    {/* Nom */}
                    <FormField label="Nom" htmlFor="name">
                        <Input id="name" name="name" defaultValue={user?.name ?? ''} required />
                    </FormField>

                    {/* Rôles (search-select, même pattern que profile.tsx) */}
                    {isNew && (
                        <FormField label="Rôles" htmlFor="role-search">
                            <SearchSelect
                                value={roleSearch}
                                onChange={(v) => setRoleSearch(v)}
                                onSubmit={(s) => {
                                    const names = s && s.trim() ? s.trim().split(/\s+/) : [];
                                    const ids = names
                                        .map((name) => allRoles.find((r) => r.name === name)?.id ?? null)
                                        .filter((v): v is number => v !== null);
                                    setSelectedRoleIds(ids);
                                }}
                                propositions={allRoles.map((r) => r.name)}
                                selection={selectedRoleIds.map((id) => {
                                    const r = allRoles.find((x) => x.id === id);
                                    return r ? { value: r.name, label: r.name } : { value: String(id), label: String(id) };
                                })}
                                loading={false}
                                minQueryLength={0}
                            />
                            {selectedRoleIds.map((id) => (
                                <input key={id} type="hidden" name="roles[]" value={id} />
                            ))}
                            <div className="mt-2 flex flex-wrap gap-1">
                                {selectedRoleIds.map((id) => {
                                    const r = allRoles.find((x) => x.id === id);
                                    return r ? <Badge key={id} variant="secondary">{r.name}</Badge> : null;
                                })}
                            </div>
                            {isGroup && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Rôle group : email et mot de passe optionnels.
                                </p>
                            )}
                        </FormField>
                    )}

                    {/* Checkbox group — masque email + password */}
                    {isNew && (
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="is_group"
                                checked={isGroup}
                                onChange={() => {
                                    const groupRole = allRoles.find((r) => r.name === 'group');
                                    if (!groupRole) return;
                                    setSelectedRoleIds((prev) =>
                                        isGroup
                                            ? prev.filter((id) => id !== groupRole.id)
                                            : [...prev.filter((id) => id !== groupRole.id), groupRole.id],
                                    );
                                }}
                                className="h-4 w-4"
                            />
                            <Label htmlFor="is_group">Compte groupe (sans email ni mot de passe)</Label>
                        </div>
                    )}

                    {/* Email */}
                    {!isGroup && (
                        <FormField label="Email" htmlFor="email">
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                defaultValue={user?.email ?? ''}
                                required={!isGroup}
                            />
                        </FormField>
                    )}

                    {/* Mot de passe */}
                    {isNew && !isGroup && (
                        <FormField label="Mot de passe" htmlFor="password">
                            <Input id="password" name="password" type="password" required />
                        </FormField>
                    )}

                    {/* Parent */}
                    <FormField label="Parent" htmlFor="parent_id">
                        <div className="flex items-center gap-2">
                            {selectedParent ? (
                                <Badge variant="outline" className="text-sm py-1 px-3">
                                    {selectedParent.name}
                                </Badge>
                            ) : (
                                <span className="text-sm text-muted-foreground">Aucun parent sélectionné</span>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setParentModalOpen(true)}
                            >
                                <Users2Icon className="mr-1 h-4 w-4" />
                                {selectedParent ? 'Changer' : 'Sélectionner'}
                            </Button>
                            {selectedParent && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedParent(null)}
                                >
                                    Retirer
                                </Button>
                            )}
                        </div>
                        {selectedParent && (
                            <input type="hidden" name="parent_id" value={selectedParent.id} />
                        )}
                    </FormField>

                    <Button type="submit" className="mt-4">
                        <SaveIcon className="mr-2" />
                        {isNew ? 'Créer' : 'Enregistrer'}
                    </Button>
                </main>
            </div>

            {/* Modale sélection parent */}
            <Dialog open={parentModalOpen} onOpenChange={setParentModalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Sélectionner un parent</DialogTitle>
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
                        <p className="mt-2 text-sm text-muted-foreground">Aucun résultat.</p>
                    )}
                </DialogContent>
            </Dialog>
        </Form>
    );
});