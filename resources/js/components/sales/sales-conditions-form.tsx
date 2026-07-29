import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useI18n } from '@/lib/i18n';
import type { SalesConditions } from '@/types';
import { ChevronDown, Check } from 'lucide-react';
import { useState, type ReactNode } from 'react';

type CarrierOption = {
    id: number;
    name: string;
    country?: string | null;
    zones?: Array<{
        id: number;
        carrier_id: number;
        name: string;
    }>;
};

type Props = {
    value: SalesConditions;
    onChange: (next: SalesConditions) => void;
    carriers: CarrierOption[];
    mode: 'defaults' | 'override' | 'client';
};

const DEFAULT_VALUES: SalesConditions = {
    m: 0,
    mm: 0,
    pd: 0,
    h: 1,
    l: 0,
    c: '',
    mc: 0,
    me: 0,
    mr: 0,
    tvap: 0,
    tvat: null,
    t: null,
    z: null,
    p: '-1',
};

const normalizePriceMode = (value: unknown): string => {
    if (value === null || value === undefined || value === '') {
        return '-1';
    }

    const raw = String(value).trim().toLowerCase();

    if (raw === 'price_depart' || raw === 'depart' || raw === 'departure' || raw === '0') {
        return 'price_depart';
    }

    if (raw === 'price_render' || raw === 'price_rendu' || raw === 'render' || raw === 'rendered' || raw === 'rendu' || raw === '1') {
        return 'price_render';
    }

    if (raw === 'price' || raw === 'price_floor' || raw === 'price_roll' || raw === 'price_promo') {
        return raw;
    }

    return raw === '-1' ? '-1' : '-1';
};

const toNumber = (value: string | number, fallback = 0): number => {
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
};

function AccordionVolet({
    title,
    summary,
    badge,
    children,
    defaultOpen = false,
    cols,
}: {
    title: string;
    summary?: string;
    badge?: ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
    cols?: number;
}) {
    const { t } = useI18n();
    const [open, setOpen] = useState(defaultOpen);

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="rounded-md border border-border bg-card"
        >
            <div className="flex items-center justify-between px-4 py-3">
                <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    {badge}
                    {title}
                    {summary ? <span className="text-xs text-muted-foreground font-normal">{summary}</span> : null}
                </h4>
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                        {/* {open ? t('Moins d\'options') : t('Plus d\'options')} */}
                        <ChevronDown
                            className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                        />
                    </button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="border-t border-border px-4 py-4 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1">
                <div className={`grid grid-cols-1 md:grid-cols-${cols ?? 2} gap-4`}>
                    {children}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

export default function SalesConditionsForm({ value, onChange, carriers, mode }: Props) {
    const { t } = useI18n();
    const [rawFloats, setRawFloats] = useState<Record<string, string>>({});

    const merged: SalesConditions = { ...DEFAULT_VALUES, ...(value ?? {}) };
    const currentCarrierId = merged.t !== null && merged.t !== undefined ? Number(merged.t) : null;
    const zones = carriers.find((carrier) => carrier.id === currentCarrierId)?.zones ?? [];

    const update = (key: keyof SalesConditions, nextValue: SalesConditions[keyof SalesConditions]) => {
        onChange({
            ...merged,
            [key]: nextValue,
        });
    };

    const floatValue = (key: string, fallback: number): string =>
        key in rawFloats ? rawFloats[key] : String(merged[key as keyof SalesConditions] ?? fallback);

    const handleFloatChange = (key: string, raw: string) => {
        setRawFloats((prev) => ({ ...prev, [key]: raw }));
        const num = toNumber(raw);
        if (Number.isFinite(num)) {
            update(key as keyof SalesConditions, num);
        }
    };

    const handleFloatBlur = (key: string) => {
        setRawFloats((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const summary = (parts: Array<{ value: number; suffix: string }>): string => {
        const nonZero = parts.filter((p) => p.value !== 0);
        if (nonZero.length === 0) return '';
        return nonZero.map((p) => `${p.value}${p.suffix}`).join(' / ');
    };

    return (
        <div className="space-y-3">
            <AccordionVolet title={t('TVA & Marge générale')} summary={summary([{ value: merged.m ?? 0, suffix: '%' }])} badge={Number(merged.tvap ?? 0) === 1 ? <Check className="size-3.5 text-green-600" /> : null}>
                <FormField label={t('Tva')}>
                    <Input
                        type="checkbox"
                        checked={Number(merged.tvap ?? 0) === 1}
                        onChange={(e) => update('tvap', toNumber(e.target.checked ? 1 : 0))}
                    />
                </FormField>
                <FormField label={t('General margin (%)')}>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={floatValue('m', 0)}
                        onChange={(e) => handleFloatChange('m', e.target.value)}
                        onBlur={() => handleFloatBlur('m')}
                    />
                </FormField>
            </AccordionVolet>

            <AccordionVolet title={t('Marges par unité')} cols={3} summary={summary([
                { value: merged.mc ?? 0, suffix: '%' },
                { value: merged.me ?? 0, suffix: '%' },
                { value: merged.mr ?? 0, suffix: '%' },
            ])}>
                <FormField label={t('Margin per carton (%)')}>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={floatValue('mc', 0)}
                        onChange={(e) => handleFloatChange('mc', e.target.value)}
                        onBlur={() => handleFloatBlur('mc')}
                    />
                </FormField>
                <FormField label={t('Margin per level (%)')}>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={floatValue('me', 0)}
                        onChange={(e) => handleFloatChange('me', e.target.value)}
                        onBlur={() => handleFloatBlur('me')}
                    />
                </FormField>
                <FormField label={t('Margin per roll (%)')}>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={floatValue('mr', 0)}
                        onChange={(e) => handleFloatChange('mr', e.target.value)}
                        onBlur={() => handleFloatBlur('mr')}
                    />
                </FormField>
            </AccordionVolet>

            <AccordionVolet title={t('Marges avancées')} summary={summary([
                { value: merged.mm ?? 0, suffix: '€' },
                { value: merged.pd ?? 0, suffix: '%' },
            ])}>
                <FormField label={t('Minimum margin per roll (€)')}>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={floatValue('mm', 0)}
                        onChange={(e) => handleFloatChange('mm', e.target.value)}
                        onBlur={() => handleFloatBlur('mm')}
                    />
                </FormField>
                <FormField label={t('Ponderation coefficient (%)')}>
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={floatValue('pd', 0)}
                        onChange={(e) => handleFloatChange('pd', e.target.value)}
                        onBlur={() => handleFloatBlur('pd')}
                    />
                </FormField>
            </AccordionVolet>

            {mode === 'override' ? (
                <p className="text-xs text-muted-foreground">{t('Only changed values are relevant for seller override.')}</p>
            ) : null}
        </div>
    );
}
