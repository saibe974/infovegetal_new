import { PromotionPageHeader } from '@/components/promotions/promotion-page-header';
import { PromotionWorkspaceNav } from '@/components/promotions/promotion-workspace-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { withAppLayout } from '@/layouts/app-layout';
import { type Promotion, type SharedData } from '@/types';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

type Content = { name: string; subject: string; preheader: string; heading: string; body: string; cta_label: string; cta_url: string };
type Mailing = Content & {
    id: number; status: 'draft' | 'ready' | 'sending' | 'sent' | 'cancelled';
    scheduled_at: string | null; recipient_count: number; sent_count: number;
    skipped_count: number; failed_count: number; pending_count: number; processing_count: number;
};
type Props = { promotion: Promotion; mailings: Mailing[]; mailTransport: string };
const empty: Content = { name: '', subject: '', preheader: '', heading: '', body: '', cta_label: '', cta_url: '' };
const labels = { draft: 'Brouillon', ready: 'Prêt à lancer', sending: 'Envoi commencé', sent: 'Traitement terminé', cancelled: 'Annulé' };
const fields: Array<[keyof Content, string]> = [
    ['name', 'Nom interne'], ['subject', 'Objet du message'], ['preheader', 'Texte d’aperçu (facultatif)'],
    ['heading', 'Titre (facultatif)'], ['body', 'Message'], ['cta_label', 'Texte du bouton (facultatif)'], ['cta_url', 'Lien du bouton (https://…)'],
];

function MailingEditor({ promotionId, mailing, onClose }: { promotionId: number; mailing: Mailing | null; onClose: () => void }) {
    const initial = Object.fromEntries(fields.map(([key]) => [key, mailing?.[key] ?? ''])) as Content;
    const form = useForm<Content>(mailing ? initial : empty);
    const [preview, setPreview] = useState(false);
    return <Card><CardHeader><CardTitle>{mailing ? 'Modifier le brouillon' : 'Nouveau mailing'}</CardTitle></CardHeader><CardContent>
        <form className="space-y-4" onSubmit={(event) => {
            event.preventDefault();
            const options = { preserveScroll: true, onSuccess: onClose };
            if (mailing) form.put(`/promotions/${promotionId}/mailings/${mailing.id}`, options);
            else form.post(`/promotions/${promotionId}/mailings`, options);
        }}>
            {fields.map(([key, label]) => <div key={key} className="space-y-1">
                <Label htmlFor={`mailing-${key}`}>{label}</Label>
                {key === 'body' ? <textarea className="w-full rounded-md border bg-background p-3 text-sm" id={`mailing-${key}`} rows={8} value={form.data[key]} onChange={(event) => form.setData(key, event.target.value)} required /> :
                    <Input id={`mailing-${key}`} value={form.data[key]} onChange={(event) => form.setData(key, event.target.value)} required={key === 'name' || key === 'subject'} type={key === 'cta_url' ? 'url' : 'text'} />}
                {form.errors[key] && <p className="text-sm text-destructive">{form.errors[key]}</p>}
            </div>)}
            <p className="text-xs text-muted-foreground">Texte simple, sans HTML. Le lien de désinscription est ajouté automatiquement. Le bouton est facultatif.</p>
            <div className="flex flex-wrap gap-2"><Button disabled={form.processing}>Enregistrer le brouillon</Button><Button type="button" variant="outline" onClick={() => setPreview(!preview)}>Aperçu</Button><Button type="button" variant="ghost" onClick={onClose}>Fermer</Button></div>
            {preview && <div className="space-y-4 rounded-lg border bg-muted/30 p-6">
                <p className="text-xs text-muted-foreground">{form.data.preheader}</p><h2 className="text-xl font-semibold">{form.data.heading || form.data.subject}</h2>
                <p className="whitespace-pre-wrap">{form.data.body}</p>
                {form.data.cta_label && <span className="inline-block rounded bg-primary px-4 py-2 text-primary-foreground">{form.data.cta_label}</span>}
                <p className="text-xs underline">Se désinscrire des mailings</p>
            </div>}
        </form>
    </CardContent></Card>;
}

function MailingCard({ promotionId, mailing, onEdit }: { promotionId: number; mailing: Mailing; onEdit: () => void }) {
    const csrf = usePage<SharedData>().props.csrf_token ?? '';
    const [progress, setProgress] = useState(mailing);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState('');
    const stop = useRef(true);
    const busy = useRef(false);
    const alive = useRef(true);
    const preparation = useForm({ scheduled_at: '' });
    const base = `/promotions/${promotionId}/mailings/${mailing.id}`;
    useEffect(() => setProgress(mailing), [mailing]);
    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; stop.current = true; };
    }, []);
    useEffect(() => {
        const warn = (event: BeforeUnloadEvent) => { if (busy.current) event.preventDefault(); };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, []);

    const send = async () => {
        if (busy.current) return;
        busy.current = true;
        stop.current = false;
        setRunning(true);
        setError('');
        try {
            while (!stop.current) {
                const response = await fetch(`${base}/send-batch`, {
                    method: 'POST', credentials: 'same-origin',
                    headers: { Accept: 'application/json', 'X-CSRF-TOKEN': csrf },
                });
                const result = await response.json().catch(() => null) as (Mailing & { message?: string; errors?: Record<string, string[]> }) | null;
                if (!response.ok || !result) throw new Error(result?.errors?.mailing?.[0] || result?.message || 'Envoi interrompu. Rechargez la page pour consulter la progression avant de reprendre.');
                if (alive.current) setProgress(result);
                if (result.pending_count === 0 || result.status === 'cancelled') break;
                // Pace requests to stay below the server's per-minute limit.
                await new Promise((resolve) => window.setTimeout(resolve, 1100));
            }
        } catch (exception) {
            if (alive.current) setError(exception instanceof Error ? exception.message : 'Envoi interrompu.');
        } finally {
            busy.current = false;
            if (alive.current) setRunning(false);
        }
    };

    return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{mailing.name}</CardTitle><span className="text-sm text-muted-foreground">{labels[progress.status]}</span></div></CardHeader><CardContent className="space-y-4">
        <p className="font-medium">{mailing.subject}</p>
        {progress.status === 'draft' ? <>
            <div className="flex gap-2"><Button variant="outline" onClick={onEdit}>Modifier</Button><Button variant="ghost" onClick={() => { if (window.confirm('Supprimer ce brouillon ?')) router.delete(base, { preserveScroll: true }); }}>Supprimer</Button></div>
            <form className="space-y-2 border-t pt-4" onSubmit={(event) => {
                event.preventDefault();
                if (!window.confirm('Figer le contenu et les destinataires actuels ? Le mailing ne sera plus modifiable. Aucun email ne sera envoyé avant votre lancement manuel.')) return;
                preparation.transform((data) => ({ scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null }));
                preparation.post(`${base}/prepare`, { preserveScroll: true });
            }}>
                <Label htmlFor={`schedule-${mailing.id}`}>Disponible à partir du (facultatif)</Label>
                <Input id={`schedule-${mailing.id}`} type="datetime-local" value={preparation.data.scheduled_at} onChange={(event) => preparation.setData('scheduled_at', event.target.value)} />
                <p className="text-xs text-muted-foreground">Sans date : lancement possible immédiatement. Aucun démarrage automatique à la date indiquée.</p>
                {Object.values(preparation.errors).map((message, index) => <p key={index} className="text-sm text-destructive">{message}</p>)}
                <Button variant="secondary" disabled={preparation.processing}>Préparer les destinataires</Button>
            </form>
        </> : <>
            {progress.scheduled_at && <p className="text-sm">Disponible à partir du {new Date(progress.scheduled_at).toLocaleString('fr-FR')}</p>}
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><span>{progress.recipient_count} destinataires</span><span>{progress.sent_count} envoyés</span><span>{progress.skipped_count} ignorés</span><span>{progress.failed_count} non confirmés</span></div>
            <progress className="h-3 w-full" max={Math.max(1, progress.recipient_count)} value={progress.sent_count + progress.skipped_count + progress.failed_count} aria-label="Progression du mailing" />
            <p className="text-sm text-muted-foreground">{progress.pending_count} en attente. « Envoyé » signifie accepté par le transport, pas nécessairement livré en boîte de réception.</p>
            {progress.processing_count > 0 && <p className="text-sm text-amber-700">{progress.processing_count} en cours ou à vérifier après une interruption. Ils ne seront pas renvoyés automatiquement.</p>}
            {progress.failed_count > 0 && <p className="text-sm text-amber-700">Des envois n’ont pas été confirmés. Vérifiez les journaux du transport avant tout nouvel envoi.</p>}
            {['ready', 'sending'].includes(progress.status) && <div className="flex flex-wrap gap-2">
                {running ? <Button variant="outline" onClick={() => { stop.current = true; }}>Mettre en pause après le message courant</Button> : <Button onClick={send}>{progress.status === 'ready' ? 'Lancer l’envoi' : 'Reprendre / actualiser'}</Button>}
                <Button variant="ghost" disabled={running} onClick={() => { if (window.confirm('Annuler les messages encore en attente ? Les messages déjà envoyés ne peuvent pas être rappelés.')) router.post(`${base}/cancel`, {}, { preserveScroll: true }); }}>Annuler les envois restants</Button>
            </div>}
        </>}
        {running && <p role="status" className="text-sm">Envoi en cours… Gardez cette page ouverte.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </CardContent></Card>;
}

export default withAppLayout<Props>(
    [{ title: 'Promotions', href: '/promotions' }, { title: 'Mailing', href: '/promotions' }], false,
    ({ promotion, mailings, mailTransport }) => {
        const [editing, setEditing] = useState<Mailing | null | undefined>(undefined);
        return <>
            <Head title={`Mailing — ${promotion.title}`} />
            <PromotionPageHeader><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">{promotion.title}</h1><p className="text-sm text-muted-foreground">Mailings promotionnels</p></div><Button onClick={() => setEditing(null)}>Nouveau mailing</Button></div></PromotionPageHeader>
            <div className="promotion-workspace grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><PromotionWorkspaceNav promotionId={promotion.id} active="mailing" /><div className="space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">L’envoi se fait depuis cette page, sans jobs ni cron. Préparez l’audience, puis lancez l’envoi manuellement. Une fermeture arrête les requêtes suivantes ; la progression reste enregistrée. Les clients inactifs ou désinscrits sont ignorés au moment de l’envoi.</div>
                {['log', 'array'].includes(mailTransport) && <p className="rounded-lg border border-amber-500 p-4 text-sm">Mode de test ({mailTransport}) : aucun email ne sera livré. Configurez le transport email de l’hébergeur avant de lancer un mailing réel.</p>}
                {editing !== undefined && <MailingEditor key={editing?.id ?? 'new'} promotionId={promotion.id} mailing={editing} onClose={() => setEditing(undefined)} />}
                {mailings.length === 0 && editing === undefined && <p className="py-8 text-center text-muted-foreground">Aucun mailing. Vous pouvez publier une promotion sans en créer.</p>}
                {mailings.map((mailing) => <MailingCard key={mailing.id} promotionId={promotion.id} mailing={mailing} onEdit={() => setEditing(mailing)} />)}
            </div></div>
        </>;
    },
);
