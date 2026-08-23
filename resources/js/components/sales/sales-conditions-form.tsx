import EditableProfileTitle from '@/components/sales/EditableProfileTitle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import type { SalesConditions } from '@/types';
import { CirclePlus, TrashIcon } from 'lucide-react';
import { useState } from 'react';

type CarrierOption = {
    id: number;
    name: string;
    country?: string | null;
    zones?: Array<{ id: number; carrier_id: number; name: string }>;
};

type Props = {
    value: SalesConditions;
    onChange: (next: SalesConditions) => void;
    carriers: CarrierOption[];
    mode: 'defaults' | 'override' | 'client';
    profileName?: string;
    canRenameProfile?: boolean;
    onRenameProfile?: (name: string) => void;
    hideTitle?: boolean;
    embedded?: boolean;
};

const DEFAULT_VALUES: SalesConditions = {
    m: 0,
    mm: 0,
    pd: 0,
    h: 1,
    l: 0,
    lm: 0,
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

type ConditionKey = 'tvap' | 'm' | 'mc' | 'me' | 'mr' | 'mm' | 'pd';

const CONDITION_OPTIONS: Array<{
    key: ConditionKey;
    label: string;
    suffix: string;
    input?: 'boolean' | 'number';
}> = [
    { key: 'tvap', label: 'Tva', suffix: '', input: 'boolean' },
    { key: 'm', label: 'General margin', suffix: '%' },
    { key: 'mc', label: 'Margin per carton', suffix: '%' },
    { key: 'me', label: 'Margin per level', suffix: '%' },
    { key: 'mr', label: 'Margin per roll', suffix: '%' },
    { key: 'mm', label: 'Minimum margin per roll', suffix: '€' },
    { key: 'pd', label: 'Ponderation coefficient', suffix: '%' },
];

const toNumber = (value: string | number, fallback = 0): number => {
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
};

export default function SalesConditionsForm({
    value,
    onChange,
    mode,
    profileName,
    canRenameProfile = false,
    onRenameProfile,
    hideTitle = false,
    embedded = false,
}: Props) {
    const { t } = useI18n();
    const [rawFloats, setRawFloats] = useState<Record<string, string>>({});
    const merged: SalesConditions = { ...DEFAULT_VALUES, ...(value ?? {}) };
    const activeKeys = CONDITION_OPTIONS.filter(
        ({ key }) => value?.[key] !== null && value?.[key] !== undefined,
    ).map(({ key }) => key);
    const availableOptions = CONDITION_OPTIONS.filter(
        ({ key }) => !activeKeys.includes(key),
    );

    const update = (patch: Partial<SalesConditions>) => {
        onChange({ ...(value ?? {}), ...patch });
    };

    const floatValue = (key: ConditionKey): string =>
        key in rawFloats ? rawFloats[key] : String(merged[key] ?? 0);

    const handleFloatChange = (key: ConditionKey, raw: string) => {
        setRawFloats((previous) => ({ ...previous, [key]: raw }));
        const parsed = Number(raw.replace(',', '.'));
        if (Number.isFinite(parsed)) update({ [key]: parsed });
    };

    const clearRawFloat = (key: ConditionKey) => {
        setRawFloats((previous) => {
            const next = { ...previous };
            delete next[key];
            return next;
        });
    };

    const addCondition = () => {
        const nextOption = availableOptions[0];
        if (nextOption) update({ [nextOption.key]: 0 });
    };

    const removeCondition = (key: ConditionKey) => {
        clearRawFloat(key);
        update({ [key]: null });
    };

    const changeConditionType = (
        currentKey: ConditionKey,
        nextKey: ConditionKey,
    ) => {
        if (currentKey === nextKey) return;
        const currentValue = toNumber(merged[currentKey] as number, 0);
        const nextValue =
            CONDITION_OPTIONS.find((option) => option.key === nextKey)
                ?.input === 'boolean'
                ? currentValue !== 0
                    ? 1
                    : 0
                : currentValue;
        clearRawFloat(currentKey);
        update({ [currentKey]: null, [nextKey]: nextValue });
    };

    const header = (
        <>
            {hideTitle ? null : profileName && onRenameProfile ? (
                <EditableProfileTitle
                    name={profileName}
                    canEdit={canRenameProfile}
                    onRename={onRenameProfile}
                    className="text-lg"
                />
            ) : (
                <CardTitle className="text-lg">
                    {t('Sales conditions')}
                </CardTitle>
            )}
            {availableOptions.length > 0 && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-green-600 hover:bg-green-500/10 hover:text-green-700"
                    title={t('Add condition')}
                    onClick={addCondition}
                >
                    <CirclePlus />
                </Button>
            )}
        </>
    );

    const content = (
        <>
            {activeKeys.map((key) => {
                const option = CONDITION_OPTIONS.find(
                    (candidate) => candidate.key === key,
                );
                if (!option) return null;

                const rowOptions = CONDITION_OPTIONS.filter(
                    (candidate) =>
                        candidate.key === key ||
                        !activeKeys.includes(candidate.key),
                );

                return (
                    <div
                        key={key}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,0.55fr)_auto] items-center gap-2 rounded-md border p-2"
                    >
                        <select
                            aria-label={t('Condition type')}
                            className="h-10 min-w-0 rounded-md border bg-card px-3 text-sm"
                            value={key}
                            onChange={(event) =>
                                changeConditionType(
                                    key,
                                    event.target.value as ConditionKey,
                                )
                            }
                        >
                            {rowOptions.map((candidate) => (
                                <option
                                    key={candidate.key}
                                    value={candidate.key}
                                >
                                    {t(candidate.label)}
                                </option>
                            ))}
                        </select>
                        {option.input === 'boolean' ? (
                            <div className="flex h-10 items-center rounded-md border px-3">
                                <Input
                                    aria-label={t(option.label)}
                                    className="size-4"
                                    type="checkbox"
                                    checked={Number(merged[key] ?? 0) === 1}
                                    onChange={(event) =>
                                        update({
                                            [key]: event.target.checked ? 1 : 0,
                                        })
                                    }
                                />
                            </div>
                        ) : (
                            <div className="relative">
                                <Input
                                    aria-label={t(option.label)}
                                    className="pr-8"
                                    type="text"
                                    inputMode="decimal"
                                    value={floatValue(key)}
                                    onChange={(event) =>
                                        handleFloatChange(
                                            key,
                                            event.target.value,
                                        )
                                    }
                                    onBlur={() => clearRawFloat(key)}
                                />
                                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                                    {option.suffix}
                                </span>
                            </div>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title={t('Delete condition')}
                            onClick={() => removeCondition(key)}
                        >
                            <TrashIcon />
                        </Button>
                    </div>
                );
            })}

            {activeKeys.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t('No sales condition.')}
                </p>
            )}

            {mode === 'override' && (
                <p className="text-xs text-muted-foreground">
                    {t('Only changed values are relevant for seller override.')}
                </p>
            )}
        </>
    );

    if (embedded) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-end">{header}</div>
                {content}
            </div>
        );
    }

    return (
        <Card className="gap-0 shadow-none">
            <CardHeader className="flex-row items-center justify-between pb-3">
                {header}
            </CardHeader>
            <CardContent className="space-y-3">{content}</CardContent>
        </Card>
    );
}
