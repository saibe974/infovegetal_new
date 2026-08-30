import { PromotionWorkspaceNav } from '@/components/promotions/promotion-workspace-nav';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { withAppLayout } from '@/layouts/app-layout';
import { type PaginatedCollection, type Promotion, type PromotionAudienceMode, type PromotionAudienceUser } from '@/types';
import { Head, router, useForm } from '@inertiajs/react';
import { AlertCircle, Check, Mail, MailX, Plus, Search, Trash2, Users } from 'lucide-react';
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
        const [q, setQ] = useState(filters.q ?? '');
        const [mailing, setMailing] = useState(filters.mailing || 'all');

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
        const remove = (id: number) => {
            setData('user_ids', data.user_ids.filter((userId) => userId !== id));
            setSelectedDetails((current) => current.filter((user) => user.id !== id));
        };
        const save = () => put(`/promotions/${promotion.id}/audience`, { preserveScroll: true, onSuccess: () => setDefaults() });
        const applyFilters = (event?: FormEvent) => {
            event?.preventDefault();
            router.get(`/promotions/${promotion.id}/edit/audience`, {
                q: q.trim() || undefined,
                mailing: mailing === 'all' ? undefined : mailing,
            }, { preserveState: true, preserveScroll: true, replace: true, only: ['candidates', 'filters'] });
        };
        const visitPage = (url: string | null) => {
            if (!url) return;
            router.visit(url, { preserveState: true, preserveScroll: true, only: ['candidates', 'filters'] });
        };

        return <>
            <Head title={`Audience — ${promotion.title}`} />
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div><h1 className="text-2xl font-semibold">{promotion.title}</h1><p className="text-sm text-muted-foreground">Définissez les clients autorisés à voir une promotion ciblée.</p></div>
                <div className="flex items-center gap-2">{isDirty && <span className="text-sm text-amber-600">Modifications non enregistrées</span>}<Button onClick={save} disabled={processing}><Check />{processing ? 'Enregistrement…' : 'Enregistrer l’audience'}</Button></div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                <PromotionWorkspaceNav promotionId={promotion.id} active="audience" />
                <div className="space-y-6">
                    <div className="grid gap-3 sm:grid-cols-4">
                        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{counts.eligible}</div><div className="text-xs text-muted-foreground">clients accessibles</div></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{counts.eligible_mailing}</div><div className="text-xs text-muted-foreground">acceptent les mailings</div></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{data.audience_mode === 'selected' ? data.user_ids.length : counts.eligible}</div><div className="text-xs text-muted-foreground">dans l’audience</div></CardContent></Card>
                        <Card><CardContent className="pt-6"><div className="text-2xl font-semibold">{data.audience_mode === 'selected' ? selectedDetails.filter((user) => user.mailing).length : counts.eligible_mailing}</div><div className="text-xs text-muted-foreground">dans l’audience et opt-in</div></CardContent></Card>
                    </div>

                    <Card><CardHeader><CardTitle>Mode de ciblage</CardTitle><CardDescription>Le mode « tous » est matérialisé au moment de l’enregistrement pour garantir une audience stable et auditable.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">
                        <button type="button" onClick={() => setData('audience_mode', 'all_accessible')} className={`rounded-lg border p-4 text-left ${data.audience_mode === 'all_accessible' ? 'border-primary ring-1 ring-primary' : ''}`}><div className="flex items-center gap-2 font-medium"><Users className="size-4" />Tous les clients accessibles</div><p className="mt-1 text-xs text-muted-foreground">Inclut automatiquement tout votre périmètre lors de l’enregistrement.</p></button>
                        <button type="button" onClick={() => setData('audience_mode', 'selected')} className={`rounded-lg border p-4 text-left ${data.audience_mode === 'selected' ? 'border-primary ring-1 ring-primary' : ''}`}><div className="flex items-center gap-2 font-medium"><Check className="size-4" />Sélection explicite</div><p className="mt-1 text-xs text-muted-foreground">Vous choisissez précisément chaque client.</p></button>
                        {audienceUpdatedAt && <p className="text-xs text-muted-foreground md:col-span-2">Dernière matérialisation : {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(audienceUpdatedAt))}</p>}
                    </CardContent></Card>

                    {errors.user_ids && <Alert variant="destructive"><AlertCircle /><AlertTitle>Audience invalide</AlertTitle><AlertDescription>{errors.user_ids}</AlertDescription></Alert>}

                    {data.audience_mode === 'selected' && <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                        <Card className="h-fit"><CardHeader><CardTitle>Clients accessibles</CardTitle></CardHeader><CardContent>
                            <form onSubmit={applyFilters} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={q} onChange={(event) => setQ(event.target.value)} className="pl-9" placeholder="Nom, email, référence, ville" /></div><Select value={mailing} onValueChange={setMailing}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="yes">Mailing accepté</SelectItem><SelectItem value="no">Mailing refusé</SelectItem></SelectContent></Select><Button variant="outline">Filtrer</Button></form>
                            <div className="mt-4 space-y-2">{candidates.data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucun client trouvé.</p>}{candidates.data.map((user) => { const selected = data.user_ids.includes(user.id); return <div key={user.id} className="flex items-center gap-3 rounded-lg border p-3"><div className={`rounded-full p-2 ${user.mailing ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{user.mailing ? <Mail className="size-4" /> : <MailX className="size-4" />}</div><ClientSummary user={user} /><Button type="button" size="icon" variant={selected ? 'secondary' : 'outline'} disabled={selected} onClick={() => add(user)}>{selected ? <Check /> : <Plus />}</Button></div>; })}</div>
                            {(candidates.links.prev || candidates.links.next) && <div className="mt-4 flex justify-between gap-2"><Button type="button" variant="outline" disabled={!candidates.links.prev} onClick={() => visitPage(candidates.links.prev)}>Précédent</Button><Button type="button" variant="outline" disabled={!candidates.links.next} onClick={() => visitPage(candidates.links.next)}>Suivant</Button></div>}
                        </CardContent></Card>

                        <div><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Clients sélectionnés</h2><Badge variant="outline">{data.user_ids.length}</Badge></div>{selectedDetails.length === 0 ? <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Ajoutez des clients depuis la liste.</div> : <div className="space-y-2">{selectedDetails.map((user) => <div key={user.id} className="flex items-center gap-3 rounded-lg border bg-card p-3"><div className={`rounded-full p-2 ${user.mailing ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>{user.mailing ? <Mail className="size-4" /> : <MailX className="size-4" />}</div><ClientSummary user={user} /><Button type="button" variant="ghost" size="icon" onClick={() => remove(user.id)}><Trash2 /></Button></div>)}</div>}</div>
                    </div>}
                </div>
            </div>
        </>;
    },
);
