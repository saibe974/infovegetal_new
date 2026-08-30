import { PromotionWorkspaceNav } from '@/components/promotions/promotion-workspace-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { withAppLayout } from '@/layouts/app-layout';
import { type Promotion } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useEffect } from 'react';

export default withAppLayout<{ promotion: Promotion }>(
    [{ title: 'Promotions', href: '/promotions' }, { title: 'Présentation', href: '/promotions' }], false,
    ({ promotion }) => {
        const form = useForm({ presentation_title: promotion.presentation_title ?? '', presentation_body: promotion.presentation_body ?? '', terms: promotion.terms ?? '', show_coupons: promotion.show_coupons ?? false });
        useEffect(() => {
            const warn = (event: BeforeUnloadEvent) => { if (form.isDirty) event.preventDefault(); };
            window.addEventListener('beforeunload', warn);
            return () => window.removeEventListener('beforeunload', warn);
        }, [form.isDirty]);
        return <>
            <Head title={`Présentation — ${promotion.title}`} />
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-semibold">{promotion.title}</h1><Button asChild variant="outline"><a href={`/promotions/${promotion.id}/preview`} target="_blank" rel="noopener noreferrer">Aperçu enregistré</a></Button></div>
            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><PromotionWorkspaceNav promotionId={promotion.id} active="presentation" /><Card><CardHeader><CardTitle>Contenu visible par les clients</CardTitle></CardHeader><CardContent>
                <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); form.put(`/promotions/${promotion.id}/presentation`, { preserveScroll: true, onSuccess: () => form.setDefaults() }); }}>
                    {['active', 'scheduled'].includes(promotion.status) && <p className="rounded border border-amber-500 p-3 text-sm">Cette promotion est publiée. Les modifications enregistrées s’appliquent immédiatement. Suspendez-la dans Publication si nécessaire.</p>}
                    <div className="space-y-2"><Label htmlFor="presentation_title">Titre de la page</Label><Input id="presentation_title" placeholder={promotion.title} value={form.data.presentation_title} onChange={(event) => form.setData('presentation_title', event.target.value)} /><p className="text-xs text-muted-foreground">Laissez vide pour reprendre le titre général.</p></div>
                    <div className="space-y-2"><Label htmlFor="presentation_body">Texte de présentation</Label><textarea id="presentation_body" rows={8} className="w-full rounded-md border bg-background p-3 text-sm" value={form.data.presentation_body} onChange={(event) => form.setData('presentation_body', event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="terms">Conditions de l’offre</Label><textarea id="terms" rows={5} className="w-full rounded-md border bg-background p-3 text-sm" value={form.data.terms} onChange={(event) => form.setData('terms', event.target.value)} /></div>
                    <label className="flex items-start gap-3 rounded-lg border p-4"><input type="checkbox" className="mt-1" checked={form.data.show_coupons} onChange={(event) => form.setData('show_coupons', event.target.checked)} /><span><span className="font-medium">Afficher les codes des coupons actifs</span><span className="mt-1 block text-sm text-muted-foreground">Les visiteurs autorisés verront les codes et leurs conditions. Désactivé par défaut : une sélection simple n’a pas besoin de coupon.</span></span></label>
                    <p className="text-sm text-muted-foreground">Texte simple, sans HTML. Les images, titres personnalisés et mises en avant des produits viennent de la section Produits. La description interne n’est jamais publiée.</p>
                    {Object.values(form.errors).map((error, index) => <p key={index} className="text-sm text-destructive">{error}</p>)}
                    <div className="flex items-center gap-3"><Button disabled={form.processing}>Enregistrer la présentation</Button>{form.isDirty && <span className="text-sm text-amber-700">Modifications non enregistrées</span>}</div>
                </form>
            </CardContent></Card></div>
        </>;
    },
);
