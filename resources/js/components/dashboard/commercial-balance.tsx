import {
    ArrowUpRight,
    BadgeEuro,
    Scale,
    Sparkles,
    TrendingUp,
    WalletCards,
} from 'lucide-react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const metrics = [
    {
        label: "Chiffre d'affaires",
        value: '48 750 €',
        change: '+12,4 %',
        detail: 'vs. période précédente',
        icon: BadgeEuro,
        iconStyle:
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
        label: 'Coûts estimés',
        value: '31 420 €',
        change: '+4,1 %',
        detail: 'achats et frais inclus',
        icon: WalletCards,
        iconStyle:
            'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    {
        label: 'Marge commerciale',
        value: '17 330 €',
        change: '+28,7 %',
        detail: 'résultat estimé',
        icon: TrendingUp,
        iconStyle: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    },
    {
        label: 'Rentabilité',
        value: '35,5 %',
        change: '+4,5 pts',
        detail: 'objectif fixé à 30 %',
        icon: Scale,
        iconStyle:
            'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    },
];

const months = ['Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août'];
const revenuePoints = '20,152 164,130 308,138 452,88 596,104 740,44';
const costPoints = '20,184 164,168 308,174 452,142 596,151 740,124';

export function CommercialBalance() {
    return (
        <section aria-labelledby="commercial-balance-title">
            <Card className="relative gap-0 overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-0 text-white shadow-xl shadow-emerald-950/10">
                <div className="pointer-events-none absolute -top-24 right-8 size-72 rounded-full bg-emerald-400/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-32 left-1/3 size-80 rounded-full bg-sky-500/10 blur-3xl" />

                <div className="relative border-b border-white/10 px-5 py-6 sm:px-7 lg:flex lg:items-center lg:justify-between">
                    <div>
                        <div className="mb-2 flex flex-wrap items-center gap-3">
                            <h2
                                id="commercial-balance-title"
                                className="text-xl font-bold tracking-tight sm:text-2xl"
                            >
                                Balance commerciale
                            </h2>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-amber-200 uppercase">
                                <Sparkles className="size-3" />
                                Données de démonstration
                            </span>
                        </div>
                        <p className="text-sm text-slate-300">
                            Une vue instantanée de la performance et de la
                            rentabilité de votre activité.
                        </p>
                    </div>

                    <div className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/5 p-1 lg:mt-0">
                        {['30 jours', '3 mois', '6 mois'].map((period) => (
                            <button
                                key={period}
                                type="button"
                                className={cn(
                                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                                    period === '6 mois'
                                        ? 'bg-white text-slate-950 shadow-sm'
                                        : 'text-slate-300 hover:bg-white/10 hover:text-white',
                                )}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.map((metric) => {
                        const Icon = metric.icon;

                        return (
                            <div
                                key={metric.label}
                                className="bg-slate-950/65 p-5 backdrop-blur-sm sm:p-6"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-medium text-slate-400">
                                            {metric.label}
                                        </p>
                                        <p className="mt-2 text-2xl font-bold tracking-tight">
                                            {metric.value}
                                        </p>
                                    </div>
                                    <span
                                        className={cn(
                                            'flex size-10 shrink-0 items-center justify-center rounded-xl',
                                            metric.iconStyle,
                                        )}
                                    >
                                        <Icon className="size-5" />
                                    </span>
                                </div>
                                <div className="mt-4 flex items-center gap-2 text-xs">
                                    <span className="inline-flex items-center font-semibold text-emerald-400">
                                        <ArrowUpRight className="mr-0.5 size-3.5" />
                                        {metric.change}
                                    </span>
                                    <span className="truncate text-slate-500">
                                        {metric.detail}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.75fr)]">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-semibold">
                                    Évolution sur 6 mois
                                </h3>
                                <p className="mt-1 text-xs text-slate-400">
                                    Revenus comparés aux coûts estimés
                                </p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-300">
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-emerald-400" />
                                    Revenus
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full bg-amber-300" />
                                    Coûts
                                </span>
                            </div>
                        </div>

                        <div className="overflow-hidden">
                            <svg
                                viewBox="0 0 760 220"
                                className="h-auto min-h-48 w-full"
                                role="img"
                                aria-label="Courbes fictives des revenus et des coûts sur six mois"
                            >
                                <defs>
                                    <linearGradient
                                        id="revenue-area"
                                        x1="0"
                                        x2="0"
                                        y1="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor="#34d399"
                                            stopOpacity="0.28"
                                        />
                                        <stop
                                            offset="100%"
                                            stopColor="#34d399"
                                            stopOpacity="0"
                                        />
                                    </linearGradient>
                                </defs>

                                {[44, 84, 124, 164].map((y) => (
                                    <line
                                        key={y}
                                        x1="20"
                                        x2="740"
                                        y1={y}
                                        y2={y}
                                        stroke="rgba(255,255,255,0.09)"
                                        strokeDasharray="4 6"
                                    />
                                ))}

                                <polygon
                                    points={`20,200 ${revenuePoints} 740,200`}
                                    fill="url(#revenue-area)"
                                />
                                <polyline
                                    points={costPoints}
                                    fill="none"
                                    stroke="#fcd34d"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <polyline
                                    points={revenuePoints}
                                    fill="none"
                                    stroke="#34d399"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />

                                {months.map((month, index) => (
                                    <text
                                        key={month}
                                        x={20 + index * 144}
                                        y="216"
                                        fill="#94a3b8"
                                        fontSize="12"
                                        textAnchor={
                                            index === 0
                                                ? 'start'
                                                : index === months.length - 1
                                                  ? 'end'
                                                  : 'middle'
                                        }
                                    >
                                        {month}
                                    </text>
                                ))}

                                {revenuePoints.split(' ').map((point) => {
                                    const [x, y] = point.split(',');

                                    return (
                                        <circle
                                            key={point}
                                            cx={x}
                                            cy={y}
                                            r="5"
                                            fill="#0f172a"
                                            stroke="#34d399"
                                            strokeWidth="3"
                                        />
                                    );
                                })}
                            </svg>
                        </div>
                    </div>

                    <div className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold">
                                    Répartition du CA
                                </h3>
                                <p className="mt-1 text-xs text-slate-400">
                                    Estimation de la période
                                </p>
                            </div>
                            <Scale className="size-5 text-emerald-400" />
                        </div>

                        <div className="my-auto py-8 text-center">
                            <div className="relative mx-auto flex size-40 items-center justify-center rounded-full bg-[conic-gradient(#34d399_0_35.5%,#fbbf24_35.5%_100%)] shadow-[0_0_40px_rgba(52,211,153,0.12)]">
                                <div className="flex size-28 flex-col items-center justify-center rounded-full bg-slate-900 shadow-inner">
                                    <span className="text-3xl font-black">
                                        35,5 %
                                    </span>
                                    <span className="mt-1 text-[11px] text-slate-400">
                                        de marge
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <div className="mb-1.5 flex justify-between">
                                    <span className="text-slate-300">
                                        Marge commerciale
                                    </span>
                                    <span className="font-semibold text-emerald-300">
                                        17 330 €
                                    </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full w-[35.5%] rounded-full bg-emerald-400" />
                                </div>
                            </div>
                            <div>
                                <div className="mb-1.5 flex justify-between">
                                    <span className="text-slate-300">
                                        Coûts estimés
                                    </span>
                                    <span className="font-semibold text-amber-200">
                                        31 420 €
                                    </span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full w-[64.5%] rounded-full bg-amber-300" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </section>
    );
}
