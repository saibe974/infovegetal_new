import { Head, usePage } from '@inertiajs/react';
import {
    BadgePercent,
    CalendarDays,
    Check,
    Crown,
    Layers3,
    Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';

const contracts = [
    {
        name: 'Essentiel',
        eyebrow: 'Budget maîtrisé',
        description:
            'Une formule simple et prévisible pour travailler sereinement.',
        price: '99 €',
        suffix: '/ mois',
        yearly: 'ou 990 € / an',
        icon: CalendarDays,
        features: [
            'Coût fixe et sans surprise',
            'Facturation mensuelle ou annuelle',
            'Idéal pour un volume régulier',
        ],
        accent: 'from-emerald-500 to-teal-600',
        iconStyle:
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
        name: 'Performance',
        eyebrow: 'Paiement au résultat',
        description:
            "Une formule qui évolue au même rythme que votre chiffre d'affaires.",
        price: '8 %',
        suffix: 'des ventes',
        yearly: 'aucun abonnement fixe',
        icon: BadgePercent,
        features: [
            'Aucun coût fixe mensuel',
            "Indexé sur le chiffre d'affaires",
            'Idéal pour démarrer rapidement',
        ],
        accent: 'from-sky-500 to-indigo-600',
        iconStyle: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    },
    {
        name: 'Équilibre',
        eyebrow: 'Le meilleur des deux',
        description:
            'Un fixe réduit associé à une commission plus légère sur les ventes.',
        price: '49 €',
        suffix: '/ mois',
        yearly: '+ 4 % sur les ventes',
        icon: Layers3,
        features: [
            'Engagement fixe plus léger',
            'Commission réduite sur les ventes',
            'Un partage du risque équilibré',
        ],
        accent: 'from-violet-500 to-fuchsia-600',
        iconStyle:
            'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
        featured: true,
    },
];

export default function Contracts() {
    const pageProps = usePage<SharedData & { editingUser?: User }>().props;
    const { auth, editingUser } = pageProps;
    const isSelf = !editingUser || editingUser.id === auth.user?.id;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Profile settings',
            href: isSelf
                ? '/settings/profile'
                : `/admin/users/${editingUser?.id}/edit`,
        },
        {
            title: 'Contract settings',
            href: isSelf
                ? '/settings/contracts'
                : `/admin/users/${editingUser?.id}/contracts`,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Contract settings" />

            <SettingsLayout>
                <section className="mx-auto w-full max-w-7xl px-2 py-8 sm:px-4 lg:py-12">
                    <div className="relative overflow-hidden rounded-3xl border bg-card px-5 py-8 shadow-sm sm:px-8 lg:px-10 lg:py-10">
                        <div className="pointer-events-none absolute -top-28 right-0 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />

                        <div className="relative mx-auto mb-10 max-w-2xl text-center">
                            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-xs font-semibold tracking-wide text-amber-800 uppercase dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                <Sparkles className="size-3.5" />
                                Simulation commerciale
                            </span>
                            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                                Choisissez le modèle qui vous ressemble
                            </h2>
                            <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                                Trois approches simples, pensées pour s'adapter
                                à votre activité et à vos objectifs.
                            </p>
                        </div>

                        <div className="relative grid gap-6 lg:grid-cols-3 lg:items-stretch">
                            {contracts.map((contract) => {
                                const Icon = contract.icon;

                                return (
                                    <Card
                                        key={contract.name}
                                        className={cn(
                                            'group relative gap-0 overflow-hidden p-0 transition duration-300 hover:-translate-y-1 hover:shadow-xl',
                                            contract.featured &&
                                                'border-violet-300 shadow-lg shadow-violet-500/10 dark:border-violet-700',
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'h-1.5 bg-gradient-to-r',
                                                contract.accent,
                                            )}
                                        />

                                        {contract.featured && (
                                            <div className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                                <Crown className="size-3.5" />
                                                Recommandé
                                            </div>
                                        )}

                                        <div className="flex h-full flex-col p-6 sm:p-7">
                                            <div
                                                className={cn(
                                                    'mb-5 flex size-12 items-center justify-center rounded-2xl',
                                                    contract.iconStyle,
                                                )}
                                            >
                                                <Icon className="size-6" />
                                            </div>

                                            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                                {contract.eyebrow}
                                            </p>
                                            <h3 className="mt-1 text-2xl font-bold">
                                                {contract.name}
                                            </h3>
                                            <p className="mt-3 min-h-12 text-sm leading-6 text-muted-foreground">
                                                {contract.description}
                                            </p>

                                            <div className="my-6 border-y py-5">
                                                <div className="flex items-end gap-2">
                                                    <span className="text-4xl font-black tracking-tight">
                                                        {contract.price}
                                                    </span>
                                                    <span className="pb-1 text-sm font-medium text-muted-foreground">
                                                        {contract.suffix}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm font-medium text-muted-foreground">
                                                    {contract.yearly}
                                                </p>
                                            </div>

                                            <ul className="flex-1 space-y-3">
                                                {contract.features.map(
                                                    (feature) => (
                                                        <li
                                                            key={feature}
                                                            className="flex items-start gap-3 text-sm"
                                                        >
                                                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                                <Check className="size-3.5" />
                                                            </span>
                                                            {feature}
                                                        </li>
                                                    ),
                                                )}
                                            </ul>

                                            <label
                                                htmlFor={`infovegetal-${contract.name}`}
                                                className="mt-6 flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 transition-colors hover:bg-emerald-100/80 dark:border-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                                            >
                                                <Checkbox
                                                    id={`infovegetal-${contract.name}`}
                                                    defaultChecked
                                                    className="size-5 border-emerald-500 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                                                />
                                                <span className="flex-1">
                                                    <span className="block text-sm font-semibold">
                                                        Option Infovegetal
                                                    </span>
                                                    <span className="block text-xs text-muted-foreground">
                                                        Accompagnement dédié
                                                    </span>
                                                </span>
                                                <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-bold text-emerald-700 shadow-sm dark:bg-emerald-950 dark:text-emerald-300">
                                                    3 %
                                                </span>
                                            </label>

                                            <Button
                                                type="button"
                                                variant={
                                                    contract.featured
                                                        ? 'default'
                                                        : 'outline'
                                                }
                                                className="mt-4 h-11 w-full rounded-xl"
                                            >
                                                Présenter cette formule
                                            </Button>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>

                        <p className="relative mt-7 text-center text-xs text-muted-foreground">
                            Tarifs et conditions présentés à titre d'exemple —
                            aucune sélection n'est enregistrée.
                        </p>
                    </div>
                </section>
            </SettingsLayout>
        </AppLayout>
    );
}
