import { PromotionPageHeader } from '@/components/promotions/promotion-page-header';
import SearchSelect, { type Option as SearchOption } from '@/components/app/search-select';
import { PromotionWorkspaceNav } from '@/components/promotions/promotion-workspace-nav';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { withAppLayout } from '@/layouts/app-layout';
import { type PaginatedCollection, type Promotion, type PromotionAudienceMode, type PromotionAudienceUser } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { AlertCircle, Check, Mail, MailX, Plus, Trash2, Users } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

type Props = {
    promotion: Promotion;
    audienceMode: PromotionAudienceMode;
    audienceUpdatedAt?: string | null;
    selectedUsers: PromotionAudienceUser[];
    candidates: PaginatedCollection<PromotionAudienceUser>;
    counts: { eligible: number; eligible_mailing: number; selected: number; selected_mailing: number };
    filters: { q: string; mailing: string };
};

type AudienceForm = { audience_mode: PromotionAudienceMode; user_ids: number[] };
type RemovalTarget = { type: 'all' } | { type: 'single'; user: PromotionAudienceUser };

function ClientSummary({ user }: { user: PromotionAudienceUser }) {
    return <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
            {user.ref && <Badge variant="outline">{user.ref}</Badge>}
            {user.parent && <Badge variant="secondary">{user.parent.name}</Badge>}
            {user.address_town && <span className="text-xs text-muted-foreground">{user.address_town}</span>}
        </div>
    </div>;
}

export default withAppLayout<Props>(
    [{ title: 'Promotions', href: '/promotions' }, { title: 'Audience', href: '/promotions' }],
    false,
    ({ promotion, audienceMode, audienceUpdatedAt, selectedUsers, candidates, counts, filters }) => {
        const { data, setData, put, processing, errors, isDirty, setDefaults } = useForm<AudienceForm>({
            audience_mode: audienceMode,
            user_ids: selectedUsers.map((user) => user.id),
        });
        const [selectedDetails, setSelectedDetails] = useState(selectedUsers);
        const [q, setQ] = useState('');
        const [mailing, setMailing] = useState(filters.mailing || 'all');
        const [propositions, setPropositions] = useState<SearchOption[]>([]);
        const [fetchingPropositions, setFetchingPropositions] = useState(false);
        const [propositionsError, setPropositionsError] = useState(false);
        const [pendingRemoval, setPendingRemoval] = useState<RemovalTarget | null>(null);
        const [removalConfirmation, setRemovalConfirmation] = useState({ single: true, all: true });

        useEffect(() => {
            const search = q.trim();
            const controller = new AbortController();
            setPropositions([]);
            setPropositionsError(false);
            setFetchingPropositions(search.length >= 2);
            if (search.length < 2) return;

            const timer = window.setTimeout(async () => {
                try {
                    const params = new URLSearchParams({ q: search, mailing });
                    const response = await fetch(`/promotions/${promotion.id}/audience/propositions?${params}`, {
                        signal: controller.signal,
                        headers: { Accept: 'application/json' },
                    });
                    if (!response.ok) throw new Error('Suggestions indisponibles');
                    const result = await response.json() as { propositions: SearchOption[] };
                    if (!controller.signal.aborted) setPropositions(result.propositions);
                } catch {
                    if (!controller.signal.aborted) setPropositionsError(true);
                } finally {
                    if (!controller.signal.aborted) setFetchingPropositions(false);
                }
            }, 300);

            return () => {
                window.clearTimeout(timer);
                controller.abort();
            };
        }, [q, mailing, promotion.id]);

        useEffect(() => {
            const warn = (event: BeforeUnloadEvent) => {
                if (!isDirty) return;
                event.preventDefault();
            };
            window.addEventListener('beforeunload', warn);
            return () => window.removeEventListener('beforeunload', warn);
        }, [isDirty]);

        useEffect(() => {
            if (!isDirty) setSelectedDetails(selectedUsers);
        }, [selectedUsers, isDirty]);

        const add = (user: PromotionAudienceUser) => {
            if (data.user_ids.includes(user.id)) return;
            setData('user_ids', [...data.user_ids, user.id]);
            setSelectedDetails((current) => [...current, { ...user, selected: true }].sort((a, b) => a.name.localeCompare(b.name)));
        };
        const remove = (target: RemovalTarget) => {
            setData('user_ids', target.type === 'all' ? [] : data.user_ids.filter((id) => id !== target.user.id));
            setSelectedDetails((current) => target.type === 'all' ? [] : current.filter((user) => user.id !== target.user.id));
            setPendingRemoval(null);
        };
        const requestRemoval = (target: RemovalTarget) => {
            if (removalConfirmation[target.type]) setPendingRemoval(target);
            else remove(target);
        };
        const save = () => put(`/promotions/${promotion.id}/audience`, { preserveScroll: true, onSuccess: () => setDefaults() });
        const applyFilters = (event?: FormEvent, search = q.trim() || filters.q) => {
            event?.preventDefault();
            setQ('');
            router.get(`/promotions/${promotion.id}/edit/audience`, {
                q: search.trim() || undefined,
                mailing: mailing === 'all' ? undefined : mailing,
            }, { preserveState: true, preserveScroll: true, replace: true, only: ['candidates', 'filters'] });
        };
        const visitPage = (url: string | null) => {
            if (!url) return;
            router.visit(url, { preserveState: true, preserveScroll: true, only: ['candidates', 'filters'] });
        };

        return <>
            <Head title={`Audience — ${promotion.title}`} />
            <PromotionPageHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">{promotion.title}</h1>
                    <p className="text-sm text-muted-foreground">Définissez les utilisateurs autorisés à voir une promotion ciblée.</p>
                </div>
                <div className="flex items-center gap-2">{isDirty && <span className="text-sm text-amber-600">Modifications non enregistrées</span>}<Button onClick={save} disabled={processing}><Check />{processing ? 'Enregistrement…' : 'Enregistrer l’audience'}</Button></div>
            </div></PromotionPageHeader>

            <div className="promotion-workspace grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                <PromotionWorkspaceNav promotionId={promotion.id} active="audience" />
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-4">
                        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{counts.eligible}</div><div className="text-xs text-muted-foreground">utilisateurs accessibles</div></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{counts.eligible_mailing}</div><div className="text-xs text-muted-foreground">acceptent les mailings</div></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{data.audience_mode === 'selected' ? data.user_ids.length : counts.eligible}</div><div className="text-xs text-muted-foreground">dans l’audience</div></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{data.audience_mode === 'selected' ? selectedDetails.filter((user) => user.mailing).length : counts.eligible_mailing}</div><div className="text-xs text-muted-foreground">dans l’audience et opt-in</div></CardContent></Card>
                    </div>

                    <Card><CardHeader><CardTitle>Mode de ciblage</CardTitle><CardDescription>Le mode « tous » est matérialisé au moment de l’enregistrement pour garantir une audience stable et auditable.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
                        <button type="button" onClick={() => setData('audience_mode', 'all_accessible')} className={`rounded-lg border p-4 text-left ${data.audience_mode === 'all_accessible' ? 'border-primary ring-1 ring-primary' : ''}`}><div className="flex items-center gap-2 font-medium"><Users className="size-4" />Tous les utilisateurs accessibles</div><p className="mt-1 text-xs text-muted-foreground">Inclut tout le périmètre autorisé. Responsable utilisateur 1 ou administrateur : tous les utilisateurs actifs, sans restriction de branche ni de rôle.</p></button>
                        <button type="button" onClick={() => setData('audience_mode', 'selected')} className={`rounded-lg border p-4 text-left ${data.audience_mode === 'selected' ? 'border-primary ring-1 ring-primary' : ''}`}><div className="flex items-center gap-2 font-medium"><Check className="size-4" />Sélection explicite</div><p className="mt-1 text-xs text-muted-foreground">Vous choisissez précisément chaque utilisateur.</p></button>
                        {audienceUpdatedAt && <p className="text-xs text-muted-foreground md:col-span-2">Dernière matérialisation : {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(audienceUpdatedAt))}</p>}
                    </CardContent></Card>

                    {errors.user_ids && <Alert variant="destructive"><AlertCircle /><AlertTitle>Audience invalide</AlertTitle><AlertDescription>{errors.user_ids}</AlertDescription></Alert>}

                    {data.audience_mode === 'selected' && <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                        <Card className="h-fit">
                            <CardHeader><CardTitle>Utilisateurs accessibles</CardTitle></CardHeader>
                            <CardContent>
                                <form onSubmit={applyFilters} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                                    <SearchSelect
                                        value={q}
                                        onChange={setQ}
                                        onSubmit={(value) => { setQ(''); applyFilters(undefined, value); }}
                                        selection={filters.q ? [{ value: filters.q, label: filters.q }] : []}
                                        propositions={propositions}
                                        loading={fetchingPropositions}
                                        count={candidates.meta.total}
                                        multiple={false}
                                        minQueryLength={2}
                                        placeholder="Nom, email, référence, ville"
                                    />
                                    <Select value={mailing} onValueChange={setMailing}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Tous</SelectItem>
                                            <SelectItem value="yes">Mailing accepté</SelectItem>
                                            <SelectItem value="no">Mailing refusé</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button variant="outline">Filtrer</Button>
                                </form>
                                {propositionsError && <p className="mt-2 text-xs text-muted-foreground">Suggestions indisponibles. Vous pouvez toujours saisir une recherche et la valider.</p>}
                                <div className="mt-4 space-y-2">{candidates.data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucun utilisateur trouvé.</p>}{candidates.data.map((user) => { const selected = data.user_ids.includes(user.id); return <div key={user.id} className="flex items-center gap-3 rounded-lg border p-3"><div className={`rounded-full p-2 ${user.mailing ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{user.mailing ? <Mail className="size-4" /> : <MailX className="size-4" />}</div><ClientSummary user={user} /><Button type="button" size="icon" variant={selected ? 'secondary' : 'outline'} disabled={selected} onClick={() => add(user)}>{selected ? <Check /> : <Plus />}</Button></div>; })}</div>
                                {(candidates.links.prev || candidates.links.next) && <div className="mt-4 flex justify-between gap-2"><Button type="button" variant="outline" disabled={!candidates.links.prev} onClick={() => visitPage(candidates.links.prev)}>Précédent</Button><Button type="button" variant="outline" disabled={!candidates.links.next} onClick={() => visitPage(candidates.links.next)}>Suivant</Button></div>}
                            </CardContent>
                        </Card>

                        <div>
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2"><h2 className="font-semibold">Utilisateurs sélectionnés</h2><Badge variant="outline">{data.user_ids.length}</Badge></div>
                                <Button type="button" variant="outline" size="sm" disabled={processing || data.user_ids.length === 0} onClick={() => requestRemoval({ type: 'all' })}>
                                    <Trash2 />Vider la sélection
                                </Button>
                            </div>
                            {selectedDetails.length === 0 ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Ajoutez des utilisateurs depuis la liste.</div> : <div className="space-y-2">{selectedDetails.map((user) => <div key={user.id} className="flex items-center gap-3 rounded-lg border bg-card p-3"><div className={`rounded-full p-2 ${user.mailing ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{user.mailing ? <Mail className="size-4" /> : <MailX className="size-4" />}</div><ClientSummary user={user} /><Button type="button" variant="ghost" size="icon" disabled={processing} aria-label={`Retirer ${user.name} de la sélection`} onClick={() => requestRemoval({ type: 'single', user })}><Trash2 /></Button></div>)}</div>}
                        </div>
                    </div>}
                </div>
            </div>
            <ConfirmationDialog
                open={pendingRemoval !== null}
                title={pendingRemoval?.type === 'all' ? 'Vider la sélection ?' : 'Retirer cet utilisateur ?'}
                description={pendingRemoval?.type === 'all'
                    ? `Les ${data.user_ids.length} utilisateurs seront retirés de la sélection, y compris ceux hors des filtres actuels. Aucun compte utilisateur ne sera supprimé. Enregistrez l’audience pour appliquer ce changement.`
                    : `${pendingRemoval?.type === 'single' ? pendingRemoval.user.name : 'Cet utilisateur'} sera retiré de la sélection. Son compte ne sera pas supprimé. Enregistrez l’audience pour appliquer ce changement.`}
                confirmLabel={pendingRemoval?.type === 'all' ? 'Vider la sélection' : 'Retirer l’utilisateur'}
                confirmationEnabled={removalConfirmation[pendingRemoval?.type ?? 'single']}
                onConfirmationEnabledChange={(enabled) => {
                    if (pendingRemoval) setRemovalConfirmation((current) => ({ ...current, [pendingRemoval.type]: enabled }));
                }}
                onCancel={() => setPendingRemoval(null)}
                onConfirm={() => { if (pendingRemoval) remove(pendingRemoval); }}
            />
        </>;
    },
);
