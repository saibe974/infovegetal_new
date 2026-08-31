import { PromotionPageHeader } from '@/components/promotions/promotion-page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { withAppLayout } from '@/layouts/app-layout';
import { type PaginatedCollection, type Promotion, type PromotionStatus, type PromotionVisibility } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit3, Plus, Search } from 'lucide-react';
import { FormEvent, useState } from 'react';

type Props = {
    collection: PaginatedCollection<Promotion>;
    filters: {
        q: string;
        status: string;
        visibility: string;
    };
    canCreate: boolean;
};

const statusLabels: Record<PromotionStatus, string> = {
    draft: 'Brouillon',
    ready: 'Prête',
    scheduled: 'Programmée',
    active: 'Active',
    suspended: 'Suspendue',
    ended: 'Terminée',
    cancelled: 'Annulée',
};

const visibilityLabels: Record<PromotionVisibility, string> = {
    public: 'Publique',
    authenticated: 'Utilisateurs connectés',
    targeted: 'Clients ciblés',
    unlisted: 'Lien uniquement',
};

const formatDate = (value?: string | null) => {
    if (!value) return '—';
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
};

export default withAppLayout(
    [{ title: 'Promotions', href: '/promotions' }],
    false,
    ({ collection, filters, canCreate }: Props) => {
        const [q, setQ] = useState(filters.q ?? '');
        const [status, setStatus] = useState(filters.status || 'all');
        const [visibility, setVisibility] = useState(filters.visibility || 'all');

        const applyFilters = (event?: FormEvent) => {
            event?.preventDefault();
            router.get('/promotions', {
                q: q.trim() || undefined,
                status: status === 'all' ? undefined : status,
                visibility: visibility === 'all' ? undefined : visibility,
            }, { preserveState: true, replace: true });
        };

        return (
            <>
                <Head title="Promotions" />

                <PromotionPageHeader><div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">Promotions</h1>
                        <p className="text-sm text-muted-foreground">Préparez les sélections, coupons et campagnes destinés à vos clients.</p>
                    </div>
                    {canCreate && (
                        <Button asChild>
                            <Link href="/promotions/create"><Plus />Créer une promotion</Link>
                        </Button>
                    )}
                </div></PromotionPageHeader>

                <form onSubmit={applyFilters} className="mb-4 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-[minmax(220px,1fr)_220px_220px_auto]">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                        <Input value={q} onChange={(event) => setQ(event.target.value)} className="pl-9" placeholder="Titre, URL ou responsable" />
                    </div>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Tous les statuts</SelectItem>
                            {Object.entries(statusLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={visibility} onValueChange={setVisibility}>
                        <SelectTrigger><SelectValue placeholder="Toutes les visibilités" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes les visibilités</SelectItem>
                            {Object.entries(visibilityLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button type="submit" variant="outline">Filtrer</Button>
                </form>

                {collection.data.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-12 text-center">
                        <p className="font-medium">Aucune promotion trouvée</p>
                        <p className="mt-1 text-sm text-muted-foreground">Créez un brouillon ou modifiez les filtres.</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Promotion</TableHead>
                                <TableHead>Responsable</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Visibilité</TableHead>
                                <TableHead>Période</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {collection.data.map((promotion) => (
                                <TableRow key={promotion.id}>
                                    <TableCell>
                                        <Link className="font-medium hover:underline" href={`/promotions/${promotion.id}/edit/general`}>{promotion.title}</Link>
                                        <div className="text-xs text-muted-foreground">/{promotion.slug}</div>
                                    </TableCell>
                                    <TableCell>{promotion.responsible?.name ?? '—'}</TableCell>
                                    <TableCell><Badge variant={promotion.status === 'draft' ? 'secondary' : 'outline'}>{statusLabels[promotion.status]}</Badge></TableCell>
                                    <TableCell>{visibilityLabels[promotion.visibility]}</TableCell>
                                    <TableCell>
                                        <div>{formatDate(promotion.starts_at)}</div>
                                        {promotion.ends_at && <div className="text-xs text-muted-foreground">au {formatDate(promotion.ends_at)}</div>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild size="icon" variant="outline">
                                            <Link aria-label={`Modifier ${promotion.title}`} href={`/promotions/${promotion.id}/edit/general`}><Edit3 /></Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                {(collection.links.prev || collection.links.next) && (
                    <div className="mt-4 flex justify-end gap-2">
                        <Button asChild={Boolean(collection.links.prev)} variant="outline" disabled={!collection.links.prev}>
                            {collection.links.prev ? <Link href={collection.links.prev}>Précédent</Link> : <span>Précédent</span>}
                        </Button>
                        <Button asChild={Boolean(collection.links.next)} variant="outline" disabled={!collection.links.next}>
                            {collection.links.next ? <Link href={collection.links.next}>Suivant</Link> : <span>Suivant</span>}
                        </Button>
                    </div>
                )}
            </>
        );
    },
);
