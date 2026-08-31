import { PromotionPageHeader } from '@/components/promotions/promotion-page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PromotionWorkspaceNav } from '@/components/promotions/promotion-workspace-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { withAppLayout } from '@/layouts/app-layout';
import { type Promotion, type PromotionVisibility } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { AlertCircle, Check } from 'lucide-react';
import { FormEvent, useEffect } from 'react';

type ManagerOption = { id: number; name: string; email: string };

type Props = {
    promotion: Promotion | null;
    managerOptions: ManagerOption[];
};

type PromotionForm = {
    title: string;
    slug: string;
    description: string;
    responsible_user_id: string;
    visibility: PromotionVisibility;
    starts_at: string;
    ends_at: string;
};

const visibilityHelp: Record<PromotionVisibility, string> = {
    public: 'La page pourra être consultée sans connexion.',
    authenticated: 'Tous les utilisateurs connectés pourront consulter la page.',
    targeted: 'Seuls les clients présents dans l’audience pourront consulter la page.',
    unlisted: 'Toute personne possédant le lien pourra consulter la page, sans référencement dans les listes.',
};

export default withAppLayout<Props>(
    () => [
        { title: 'Promotions', href: '/promotions' },
        { title: 'Informations générales', href: '/promotions' },
    ],
    false,
    ({ promotion, managerOptions }) => {
        const { data, setData, post, put, processing, errors, isDirty } = useForm<PromotionForm>({
            title: promotion?.title ?? '',
            slug: promotion?.slug ?? '',
            description: promotion?.description ?? '',
            responsible_user_id: String(promotion?.responsible_user_id ?? managerOptions[0]?.id ?? ''),
            visibility: promotion?.visibility ?? 'targeted',
            starts_at: promotion?.starts_at ?? '',
            ends_at: promotion?.ends_at ?? '',
        });

        useEffect(() => {
            const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
                if (!isDirty) return;
                event.preventDefault();
            };
            window.addEventListener('beforeunload', warnBeforeLeaving);
            return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
        }, [isDirty]);

        const submit = (event: FormEvent) => {
            event.preventDefault();
            if (promotion) {
                put(`/promotions/${promotion.id}`, { preserveScroll: true });
                return;
            }
            post('/promotions');
        };

        return (
            <>
                <Head title={promotion ? promotion.title : 'Créer une promotion'} />

                <PromotionPageHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-semibold">{promotion?.title || 'Nouvelle promotion'}</h1>
                            <Badge variant="secondary">{({ draft: 'Brouillon', ready: 'Prête', scheduled: 'Programmée', active: 'Active', suspended: 'Suspendue', ended: 'Terminée', cancelled: 'Annulée' })[promotion?.status ?? 'draft']}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Configurez le cadre général, puis validez la mise en ligne dans Publication. Les modifications d’une promotion publiée prennent effet immédiatement.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isDirty && <span className="text-sm text-amber-600">Modifications non enregistrées</span>}
                        <Button form="promotion-general-form" type="submit" disabled={processing}>
                            <Check />{processing ? 'Enregistrement…' : 'Enregistrer'}
                        </Button>
                    </div>
                </div></PromotionPageHeader>

                <div className="promotion-workspace grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <PromotionWorkspaceNav promotionId={promotion?.id} active="general" />

                    <form id="promotion-general-form" onSubmit={submit} className="space-y-6">
                        {Object.keys(errors).length > 0 && (
                            <Alert variant="destructive">
                                <AlertCircle />
                                <AlertTitle>Le formulaire contient des erreurs</AlertTitle>
                                <AlertDescription>Vérifiez les champs signalés avant d’enregistrer.</AlertDescription>
                            </Alert>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>Informations générales</CardTitle>
                                <CardDescription>Ces informations identifient la promotion dans l’administration et sur sa future page.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-5">
                                <FormField htmlFor="title" label="Titre" error={errors.title}>
                                    <Input id="title" value={data.title} onChange={(event) => setData('title', event.target.value)} autoFocus required />
                                </FormField>

                                <FormField htmlFor="slug" label="Adresse de la page" error={errors.slug} help="Laissez vide lors de la création pour la générer automatiquement à partir du titre.">
                                    <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/50">
                                        <span className="border-r px-3 py-2 text-sm text-muted-foreground">/offres/</span>
                                        <Input id="slug" value={data.slug} onChange={(event) => setData('slug', event.target.value)} className="border-0 shadow-none focus-visible:ring-0" placeholder="offre-printemps" />
                                    </div>
                                </FormField>

                                <FormField htmlFor="description" label="Description interne" error={errors.description} help="Ce texte sert au cadrage. Le contenu visible par les clients sera préparé dans Présentation.">
                                    <textarea
                                        id="description"
                                        value={data.description}
                                        onChange={(event) => setData('description', event.target.value)}
                                        rows={5}
                                        className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                    />
                                </FormField>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Responsabilité et accès</CardTitle>
                                <CardDescription>Le responsable pilote la promotion dans le périmètre qui lui est autorisé.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-5 md:grid-cols-2">
                                <FormField label="Responsable" error={errors.responsible_user_id}>
                                    <Select value={data.responsible_user_id} onValueChange={(value) => setData('responsible_user_id', value)}>
                                        <SelectTrigger><SelectValue placeholder="Choisir un responsable" /></SelectTrigger>
                                        <SelectContent>
                                            {managerOptions.map((manager) => (
                                                <SelectItem key={manager.id} value={String(manager.id)}>{manager.name} — {manager.email}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormField>

                                <FormField label="Visibilité" error={errors.visibility} help={visibilityHelp[data.visibility]}>
                                    <Select value={data.visibility} onValueChange={(value) => setData('visibility', value as PromotionVisibility)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="targeted">Clients ciblés</SelectItem>
                                            <SelectItem value="authenticated">Utilisateurs connectés</SelectItem>
                                            <SelectItem value="public">Publique</SelectItem>
                                            <SelectItem value="unlisted">Lien uniquement</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormField>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Période</CardTitle>
                                <CardDescription>Après validation de la publication, ces dates contrôlent l’ouverture et la fermeture de la page sans job. Elles bornent également l’utilisation des coupons.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-5 md:grid-cols-2">
                                <FormField htmlFor="starts_at" label="Début" error={errors.starts_at}>
                                    <Input id="starts_at" type="datetime-local" value={data.starts_at} onChange={(event) => setData('starts_at', event.target.value)} />
                                </FormField>
                                <FormField htmlFor="ends_at" label="Fin" error={errors.ends_at}>
                                    <Input id="ends_at" type="datetime-local" value={data.ends_at} min={data.starts_at || undefined} onChange={(event) => setData('ends_at', event.target.value)} />
                                </FormField>
                            </CardContent>
                        </Card>
                    </form>
                </div>
            </>
        );
    },
);
