import { PromotionPageHeader } from '@/components/promotions/promotion-page-header';
import { PromotionWorkspaceNav } from '@/components/promotions/promotion-workspace-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { withAppLayout } from '@/layouts/app-layout';
import { type Promotion, type PromotionStatus, type PromotionVisibility } from '@/types';
import { Head, useForm } from '@inertiajs/react';

type Props = { promotion: Promotion; publicationErrors: string[]; visibleProductCount: number; publishedAt: string | null };
const statusLabels: Record<PromotionStatus, string> = { draft: 'Brouillon', ready: 'Prête', scheduled: 'Programmée', active: 'Active', suspended: 'Suspendue', ended: 'Terminée', cancelled: 'Annulée' };
const visibilityLabels: Record<PromotionVisibility, string> = { public: 'Publique', authenticated: 'Utilisateurs connectés actifs', targeted: 'Clients actifs de l’audience uniquement', unlisted: 'Toute personne possédant le lien, sans présence dans les listes' };

export default withAppLayout<Props>(
    [{ title: 'Promotions', href: '/promotions' }, { title: 'Publication', href: '/promotions' }], false,
    ({ promotion, publicationErrors, visibleProductCount, publishedAt }) => {
        const form = useForm<{ action: string }>({ action: '' });
        const act = (action: string) => {
            const confirmation = action === 'publish' ? 'Valider la publication avec cette visibilité et ces dates ? Aucun mailing ne sera envoyé.' : 'Retirer la page de la consultation client et désactiver ses coupons ?';
            if (!window.confirm(confirmation)) return;
            form.transform(() => ({ action }));
            form.post(`/promotions/${promotion.id}/publication`, { preserveScroll: true });
        };
        return <>
            <Head title={`Publication — ${promotion.title}`} />
            <PromotionPageHeader><h1 className="text-2xl font-semibold">{promotion.title}</h1></PromotionPageHeader>
            <div className="promotion-workspace grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><PromotionWorkspaceNav promotionId={promotion.id} active="publication" /><div className="space-y-6">
                <Card><CardHeader><CardTitle>Publication : {statusLabels[promotion.status]}</CardTitle></CardHeader><CardContent className="space-y-4">
                    <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Accès</dt><dd>{visibilityLabels[promotion.visibility]}</dd></div><div><dt className="text-sm text-muted-foreground">Produits visibles maintenant</dt><dd>{visibleProductCount}</dd></div><div><dt className="text-sm text-muted-foreground">Début</dt><dd>{promotion.starts_at ? new Date(promotion.starts_at).toLocaleString('fr-FR') : 'Dès validation'}</dd></div><div><dt className="text-sm text-muted-foreground">Fin</dt><dd>{promotion.ends_at ? new Date(promotion.ends_at).toLocaleString('fr-FR') : 'Sans date de fin'}</dd></div></dl>
                    <div className="space-y-2"><p className="text-sm font-medium">Lien client à partager ou à utiliser dans un mailing</p><a className="break-all text-sm underline" href={promotion.public_url} target="_blank" rel="noopener noreferrer">{promotion.public_url}</a><p className="text-xs text-muted-foreground">Ce lien ne donne accès qu’à une offre ouverte et aux visiteurs autorisés. L’aperçu de gestion n’est pas un lien de partage.</p></div>
                    <Button asChild variant="outline"><a href={`/promotions/${promotion.id}/preview`} target="_blank" rel="noopener noreferrer">Vérifier l’aperçu enregistré</a></Button>
                    {visibleProductCount === 0 && <p className="text-sm text-amber-700">Aucun produit visible actuellement. Vérifiez les dates et l’option d’aperçu des produits futurs.</p>}
                    {publicationErrors.length > 0 && <div role="alert" className="rounded-lg border border-destructive p-4 text-sm"><p className="font-medium">À corriger avant publication</p><ul className="mt-2 list-disc pl-5">{publicationErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
                    {Object.values(form.errors).map((error, index) => <p key={index} className="text-sm text-destructive">{error}</p>)}
                    <div className="flex flex-wrap gap-2"><Button onClick={() => act('publish')} disabled={form.processing || publicationErrors.length > 0 || promotion.status === 'active' || promotion.status === 'scheduled'}>{promotion.status === 'suspended' ? 'Reprendre la publication' : 'Valider la publication'}</Button>{['active', 'scheduled'].includes(promotion.status) && <Button variant="outline" disabled={form.processing} onClick={() => act('suspend')}>Suspendre</Button>}{!['draft', 'cancelled'].includes(promotion.status) && <Button variant="ghost" disabled={form.processing} onClick={() => act('draft')}>Repasser en brouillon</Button>}</div>
                    {publishedAt && <p className="text-xs text-muted-foreground">Dernière validation : {new Date(publishedAt).toLocaleString('fr-FR')}</p>}
                </CardContent></Card>
            </div></div>
        </>;
    },
);
