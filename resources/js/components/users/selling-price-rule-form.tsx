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
import {
    computeSellingPrice,
    DEFAULT_SELLING_PRICE_RULE,
    type SellingPriceRule,
} from '@/lib/selling-price';
import { useEffect, useState } from 'react';

const parseDecimal = (raw: string): number | null => {
    const normalized = raw.trim().replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
    return Number(normalized);
};

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

    // Saisie libre (virgule ou point) : la valeur n'est propagée que si elle
    // est un nombre complet, pour pouvoir taper « 1, » puis « 1,35 ».
    const [rawValue, setRawValue] = useState(String(rule.value));
    useEffect(() => {
        if (parseDecimal(rawValue) !== rule.value) {
            setRawValue(String(rule.value));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rule.value]);

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
                            [
                                'excluding_transport',
                                t("Prix d'achat hors transport"),
                            ],
                            [
                                'including_transport',
                                t("Prix d'achat transport inclus"),
                            ],
                        ],
                        'w-64',
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
                        type="text"
                        inputMode="decimal"
                        className="w-24"
                        disabled={disabled}
                        value={rawValue}
                        onChange={(event) => {
                            const raw = event.target.value;
                            setRawValue(raw);
                            const parsed = parseDecimal(raw);
                            if (parsed !== null) update({ value: parsed });
                        }}
                        onBlur={() => setRawValue(String(rule.value))}
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
