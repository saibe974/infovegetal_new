import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';
import type { SalesConditions } from '@/types';

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

const toNumber = (value: string, fallback = 0): number => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
};

export default function SalesConditionsForm({ value, onChange, carriers, mode }: Props) {
    const { t } = useI18n();

    const merged: SalesConditions = { ...DEFAULT_VALUES, ...(value ?? {}) };
    const currentCarrierId = merged.t !== null && merged.t !== undefined ? Number(merged.t) : null;
    const zones = carriers.find((carrier) => carrier.id === currentCarrierId)?.zones ?? [];

    const update = (key: keyof SalesConditions, nextValue: SalesConditions[keyof SalesConditions]) => {
        onChange({
            ...merged,
            [key]: nextValue,
        });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* <FormField label={t('Margin category')}>
                    <Input value={String(merged.c ?? '')} onChange={(e) => update('c', e.target.value)} />
                </FormField> */}
                <FormField label={t('General margin (%)')}>
                    <Input type="number" step="0.01" value={String(merged.m ?? 0)} onChange={(e) => update('m', toNumber(e.target.value))} />
                </FormField>
                <FormField label={t('Minimum margin per roll (€)')}>
                    <Input type="number" step="0.01" value={String(merged.mm ?? 0)} onChange={(e) => update('mm', toNumber(e.target.value))} />
                </FormField>
                <FormField label={t('Ponderation coefficient (%)')}>
                    <Input type="number" step="0.01" value={String(merged.pd ?? 0)} onChange={(e) => update('pd', toNumber(e.target.value))} />
                </FormField>
                <FormField label={t('Margin per carton (%)')}>
                    <Input type="number" step="0.01" value={String(merged.mc ?? 0)} onChange={(e) => update('mc', toNumber(e.target.value))} />
                </FormField>
                <FormField label={t('Margin per level (%)')}>
                    <Input type="number" step="0.01" value={String(merged.me ?? 0)} onChange={(e) => update('me', toNumber(e.target.value))} />
                </FormField>
                <FormField label={t('Margin per roll (%)')}>
                    <Input type="number" step="0.01" value={String(merged.mr ?? 0)} onChange={(e) => update('mr', toNumber(e.target.value))} />
                </FormField>
            </div>

            {/* <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label={t('Price mode')}>
                    <Select value={normalizePriceMode(merged.p)} onValueChange={(v) => update('p', v)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="-1">{t('Auto (inherits from parent)')}</SelectItem>
                            <SelectItem value="price_depart">{t('Departure price')}</SelectItem>
                            <SelectItem value="price_render">{t('Rendered price')}</SelectItem>
                            <SelectItem value="price">{t('Base price')}</SelectItem>
                            <SelectItem value="price_floor">{t('Floor price')}</SelectItem>
                            <SelectItem value="price_roll">{t('Roll price')}</SelectItem>
                            <SelectItem value="price_promo">{t('Promo price')}</SelectItem>
                        </SelectContent>
                    </Select>
                </FormField>

            </div> */}

            {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField label={t('Higher roll')}>
                    <Input
                        type="checkbox"
                        checked={Number(merged.h ?? 0) === 1}
                        onChange={(e) => update('h', e.target.checked ? 1 : 0)}
                    />
                </FormField>
                <FormField label={t('Carrier')}>
                    <Select
                        value={currentCarrierId !== null ? String(currentCarrierId) : 'none'}
                        onValueChange={(v) => {
                            const nextCarrierId = v === 'none' ? null : Number(v);
                            update('t', nextCarrierId);
                            if (!nextCarrierId) {
                                update('z', null);
                            }
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t('Select a carrier')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">{t('None')}</SelectItem>
                            {carriers.map((carrier) => (
                                <SelectItem key={carrier.id} value={String(carrier.id)}>
                                    {carrier.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </FormField>
                <FormField label={t('Zone')}>
                    <Select
                        value={merged.z !== null && merged.z !== undefined ? String(merged.z) : 'none'}
                        onValueChange={(v) => update('z', v === 'none' ? null : Number(v))}
                        disabled={!currentCarrierId}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder={t('Select a zone')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">{t('None')}</SelectItem>
                            {zones.map((zone) => (
                                <SelectItem key={zone.id} value={String(zone.id)}>
                                    {zone.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </FormField>
                <FormField label={t('Delivery (€)')}>
                    <Input type="number" step="0.01" value={String(merged.l ?? 0)} onChange={(e) => update('l', toNumber(e.target.value))} />
                </FormField>
                <FormField label={t('Product VAT (%)')}>
                    <Input type="number" step="0.01" value={String(merged.tvap ?? 0)} onChange={(e) => update('tvap', toNumber(e.target.value))} />
                </FormField>
                <FormField label={t('Transport VAT (%)')}>
                    <Input
                        type="number"
                        step="0.01"
                        value={merged.tvat === null || merged.tvat === undefined ? '' : String(merged.tvat)}
                        onChange={(e) => update('tvat', e.target.value === '' ? null : toNumber(e.target.value))}
                    />
                </FormField>
            </div> */}

            {mode === 'override' ? (
                <p className="text-xs text-muted-foreground">{t('Only changed values are relevant for seller override.')}</p>
            ) : null}
        </div>
    );
}
