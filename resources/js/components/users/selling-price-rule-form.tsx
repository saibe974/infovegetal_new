import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';

export type SellingPriceRule = {
    /** Prix de base : prix départ ou prix de vente (rendu). */
    base: 'departure' | 'selling';
    operator: 'add' | 'multiply';
    value: number;
    unit: 'amount' | 'percent';
    rounding: 'unit' | 'tenth' | 'hundredth';
    direction: 'up' | 'down';
};

export const DEFAULT_SELLING_PRICE_RULE: SellingPriceRule = {
    base: 'departure',
    operator: 'multiply',
    value: 1,
    unit: 'amount',
    rounding: 'hundredth',
    direction: 'up',
};

const ROUNDING_FACTOR: Record<SellingPriceRule['rounding'], number> = {
    unit: 1,
    tenth: 10,
    hundredth: 100,
};

/**
 * + : base + valeur (ou base × valeur %)
 * × : base × valeur (ou base × valeur / 100)
 * puis arrondi à l'unité / dixième / centième, supérieur ou inférieur.
 */
export function computeSellingPrice(
    basePrice: number,
    rule: SellingPriceRule,
): number {
    const amount =
        rule.unit === 'percent' ? (basePrice * rule.value) / 100 : rule.value;
    const raw =
        rule.operator === 'add'
            ? basePrice + amount
            : rule.unit === 'percent'
              ? amount
              : basePrice * amount;
    const factor = ROUNDING_FACTOR[rule.rounding];
    // Correction des erreurs de flottant avant ceil/floor (ex. 1.1 * 100)
    const scaled = Math.round(raw * factor * 1e6) / 1e6;

    return (
        (rule.direction === 'up' ? Math.ceil(scaled) : Math.floor(scaled)) /
        factor
    );
}

type Props = {
    value: SellingPriceRule;
    onChange: (value: SellingPriceRule) => void;
    disabled?: boolean;
};

export function SellingPriceRuleForm({ value, onChange, disabled }: Props) {
    const { t } = useI18n();
    const rule = { ...DEFAULT_SELLING_PRICE_RULE, ...value };
    const update = (patch: Partial<SellingPriceRule>) =>
        onChange({ ...rule, ...patch });

    const choice = <K extends keyof SellingPriceRule>(
        key: K,
        options: Array<[SellingPriceRule[K], string]>,
        className?: string,
    ) => (
        <Select
            value={String(rule[key])}
            onValueChange={(next) =>
                update({ [key]: next } as Partial<SellingPriceRule>)
            }
            disabled={disabled}
        >
            <SelectTrigger className={className}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map(([optionValue, label]) => (
                    <SelectItem
                        key={String(optionValue)}
                        value={String(optionValue)}
                    >
                        {label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );

    const example = 10;

    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label>{t('Calcul')}</Label>
                <div className="flex flex-wrap items-center gap-2">
                    {choice(
                        'base',
                        [
                            ['departure', t('Prix départ')],
                            ['selling', t('Prix de vente')],
                        ],
                        'w-36',
                    )}
                    {choice(
                        'operator',
                        [
                            ['multiply', '×'],
                            ['add', '+'],
                        ],
                        'w-16',
                    )}
                    <Input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        className="w-24"
                        disabled={disabled}
                        value={rule.value}
                        onChange={(event) =>
                            update({ value: Number(event.target.value) })
                        }
                    />
                    {choice(
                        'unit',
                        [
                            ['amount', t('nb')],
                            ['percent', '%'],
                        ],
                        'w-20',
                    )}
                </div>
            </div>

            <div className="grid gap-2">
                <Label>{t('Arrondi')}</Label>
                <div className="flex flex-wrap items-center gap-2">
                    {choice(
                        'rounding',
                        [
                            ['unit', t('Unité')],
                            ['tenth', t('Dixième')],
                            ['hundredth', t('Centième')],
                        ],
                        'w-32',
                    )}
                    {choice(
                        'direction',
                        [
                            ['up', t('Supérieur')],
                            ['down', t('Inférieur')],
                        ],
                        'w-32',
                    )}
                </div>
            </div>

            <p className="text-sm text-muted-foreground">
                {t('Exemple')} : {example.toFixed(2)} € →{' '}
                {computeSellingPrice(example, rule).toFixed(2)} €
            </p>
        </div>
    );
}
