import { Button } from '@/components/ui/button';
import { withAppLayout } from '@/layouts/app-layout';
import { Head, Link } from '@inertiajs/react';
import { ArrowRight, Leaf } from 'lucide-react';

type Props = { offers: { data: Array<{ title: string; summary: string; url: string; ends_at: string | null }>; prev_page_url: string | null; next_page_url: string | null } };

export default withAppLayout<Props>([{ title: 'Offres et sélections', href: '/offres' }], false,
    ({ offers }) => <>
        <Head title="Offres et sélections" />
        <div className="mx-auto max-w-6xl space-y-8 py-6"><div><p className="mb-3 text-sm font-medium text-emerald-700">À découvrir</p><h1 className="text-3xl font-semibold sm:text-4xl">Offres et sélections</h1><p className="mt-3 text-muted-foreground">Découvrez les sélections actuellement ouvertes à votre compte ou au public.</p></div>
            {offers.data.length === 0 ? <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Aucune offre disponible pour le moment.</p> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{offers.data.map((offer) => <article key={offer.url} className="flex flex-col items-start gap-4 rounded-xl border bg-card p-6"><Leaf className="size-8 text-emerald-700" /><h2 className="text-xl font-semibold">{offer.title}</h2>{offer.summary && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{offer.summary}</p>}{offer.ends_at && <p className="text-xs text-muted-foreground">Jusqu’au {new Date(offer.ends_at).toLocaleDateString('fr-FR')}</p>}<Button asChild variant="outline" className="mt-auto"><Link href={offer.url}>Découvrir<ArrowRight className="size-4" /></Link></Button></article>)}</div>}
            <div className="flex justify-between gap-3">{offers.prev_page_url ? <Button asChild variant="outline"><Link href={offers.prev_page_url}>Précédent</Link></Button> : <span />}{offers.next_page_url && <Button asChild variant="outline"><Link href={offers.next_page_url}>Suivant</Link></Button>}</div>
        </div>
    </>, { showRightSidebar: false },
);
