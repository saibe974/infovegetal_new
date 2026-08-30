import { Button } from '@/components/ui/button';
import { withAppLayout } from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Leaf } from 'lucide-react';

type Offer = {
    title: string; body: string | null; terms: string | null; url: string; ends_at: string | null;
    products: Array<{ id: number; title: string; description: string | null; image: string | null; featured: boolean; available_from: string | null; orderable: boolean; url: string | null }>;
    coupons: Array<{ code: string; discount_type: string; discount_value: string; scope: string; minimum_order_ht: string; maximum_discount_ht: string | null; stackable_with_promo_price: boolean; usage_limit_per_customer: number; ends_at: string | null }>;
};
type Props = { offer: Offer; preview: boolean; manageUrl: string | null; noIndex: boolean };
const date = (value: string) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export default withAppLayout<Props>([{ title: 'Offres et sélections', href: '/offres' }], false,
    ({ offer, preview, manageUrl, noIndex }) => <>
        <Head title={offer.title}>{noIndex && <meta name="robots" content="noindex,nofollow" />}{!preview && <link rel="canonical" href={offer.url} />}</Head>
        <div className="mx-auto max-w-6xl space-y-8 pb-8">
            {preview && <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500 bg-amber-50 p-4 text-sm text-amber-950"><p>Aperçu de gestion : contenu enregistré et disponibilité actuelle. La page n’est pas nécessairement publiée.</p>{manageUrl && <a className="underline" href={manageUrl}>Retour à la publication</a>}</div>}
            <section className="relative overflow-hidden rounded-2xl bg-emerald-950 px-6 py-12 text-white sm:px-12 sm:py-16">
                <Leaf className="pointer-events-none absolute -right-8 -top-8 size-64 rotate-12 text-emerald-800/40" aria-hidden="true" />
                <div className="relative max-w-3xl"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Offres & sélections</p><h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">{offer.title}</h1>
                    {offer.body && <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-emerald-50 sm:text-lg">{offer.body}</p>}
                    {offer.ends_at && <p className="mt-6 text-sm text-emerald-200">Jusqu’au {date(offer.ends_at)}</p>}
                </div>
            </section>
            {offer.products.length > 0 && <section aria-labelledby="selection-title"><div className="mb-5 flex flex-wrap items-end justify-between gap-2"><h2 id="selection-title" className="text-2xl font-semibold">Notre sélection</h2><p className="text-sm text-muted-foreground">Tarifs et commande sur les fiches produits.</p></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {offer.products.map((product) => <article key={product.id} className={`flex overflow-hidden rounded-xl border bg-card flex-col ${product.featured ? 'ring-2 ring-emerald-600/50' : ''}`}>
                    <div className="relative aspect-[4/3] bg-muted">{product.image ? <img src={product.image} alt={product.title} loading="lazy" className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center"><Leaf className="size-14 text-muted-foreground/40" /></div>}{product.featured && <span className="absolute left-3 top-3 rounded-full bg-emerald-900 px-3 py-1 text-xs font-medium text-white">À découvrir</span>}</div>
                    <div className="flex flex-1 flex-col items-start gap-3 p-5"><h3 className="text-lg font-semibold">{product.title}</h3>{product.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{product.description}</p>}
                        <div className="mt-auto pt-3">{product.orderable && product.url ? <Button asChild variant="outline"><Link href={product.url}>Voir le produit<ArrowRight className="size-4" /></Link></Button> : <p className="text-sm font-medium text-amber-700">{product.available_from ? `Disponible à partir du ${date(product.available_from)}` : 'Prochainement disponible'}<span className="mt-1 block text-xs font-normal">Commande non ouverte.</span></p>}</div>
                    </div>
                </article>)}
            </div></section>}
            {offer.products.length === 0 && <p className="text-sm text-muted-foreground">Aucun produit disponible dans cette sélection pour le moment.</p>}
            {offer.coupons.length > 0 && <section aria-labelledby="coupons-title"><h2 id="coupons-title" className="mb-4 text-2xl font-semibold">Vos codes de réduction</h2><div className="grid gap-4 md:grid-cols-2">{offer.coupons.map((coupon) => <article key={coupon.code} className="space-y-3 rounded-xl border border-dashed border-emerald-600 p-6">
                <p className="text-xl font-semibold">{coupon.discount_value}{coupon.discount_type === 'percent' ? ' %' : ' HT'} de réduction</p><p className="select-all rounded bg-muted px-4 py-3 font-mono text-lg tracking-wider">{coupon.code}</p>
                <p className="text-sm text-muted-foreground">À saisir dans le panier. {coupon.scope === 'promotion_products' ? 'Sur les produits de cette sélection.' : 'Sur le panier éligible.'} Minimum : {coupon.minimum_order_ht} HT. {coupon.maximum_discount_ht && `Remise plafonnée à ${coupon.maximum_discount_ht} HT.`} {coupon.usage_limit_per_customer} utilisation(s) par client. {!coupon.stackable_with_promo_price && 'Non cumulable avec les prix promotionnels.'} {coupon.ends_at && `Jusqu’au ${date(coupon.ends_at)}.`}</p>
                <p className="text-xs text-muted-foreground">Sous réserve d’éligibilité et des quotas disponibles. La remise est vérifiée au panier et à la validation de commande.</p>
            </article>)}</div></section>}
            {offer.terms && <section className="rounded-xl bg-muted/50 p-6"><h2 className="mb-3 font-semibold">Conditions de l’offre</h2><p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{offer.terms}</p></section>}
            <Link href="/offres" className="inline-flex items-center gap-2 text-sm underline">Toutes les offres et sélections<ArrowRight className="size-4" /></Link>
        </div>
    </>, { showRightSidebar: false },
);
