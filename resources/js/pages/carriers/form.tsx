import { DataTable } from '@/components/data-table';
import { BadgeMultiSelect } from '@/components/ui/badge-multi-select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CountryFlag } from '@/components/ui/country-flag';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import InputError from '@/components/ui/input-error';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { StickyBar } from '@/components/ui/sticky-bar';
import { withAppLayout } from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import carriers from '@/routes/carriers';
import carrierZones from '@/routes/carriers/zones';
import type { BreadcrumbItem, Carrier, CarrierZone } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import {
    ArrowLeftCircle,
    ChevronDownIcon,
    ChevronUpIcon,
    DownloadIcon,
    Loader2Icon,
    PlusIcon,
    SaveIcon,
    TrashIcon,
} from 'lucide-react';
import { FormEvent, useCallback, useMemo, useRef, useState } from 'react';

interface ZoneTier {
    roll: string;
    price: string;
}

interface ZoneDraft {
    id?: number;
    name: string;
    mini: string;
    tiers: ZoneTier[];
}

type ZoneRow = ZoneDraft & { __index: number };

type Props = {
    carrier: Carrier;
    dbProducts: Array<{ id: number; name: string; country?: string | null }>;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Carriers',
        href: carriers.index().url,
    },
    {
        title: 'Edit',
        href: '#',
    },
];

const mapZones = (zones?: CarrierZone[]): ZoneDraft[] => {
    if (!zones || zones.length === 0) {
        return [];
    }

    return zones.map((zone) => {
        const tariffs = zone.tariffs ?? {};
        const tiers = Object.entries(tariffs)
            .filter(([key]) => key !== 'mini')
            .map(([roll, price]) => {
                const cleanRoll = String(roll).replace(/^roll:/, '');
                return {
                    roll: cleanRoll,
                    price: String(price ?? ''),
                };
            });

        return {
            id: zone.id,
            name: zone.name ?? '',
            mini: tariffs.mini ? String(tariffs.mini) : '',
            tiers,
        };
    });
};

const getUniqueRolls = (zones: ZoneDraft[]) => {
    const rolls = new Set<string>();
    zones.forEach((zone) => {
        zone.tiers.forEach((tier) => {
            const value = tier.roll.trim();
            if (value) {
                rolls.add(value);
            }
        });
    });

    return Array.from(rolls).sort((left, right) => {
        const leftNumber = Number(left);
        const rightNumber = Number(right);
        const leftIsNumber = Number.isFinite(leftNumber);
        const rightIsNumber = Number.isFinite(rightNumber);

        if (leftIsNumber && rightIsNumber) {
            return leftNumber - rightNumber;
        }

        return left.localeCompare(right);
    });
};

const normalizeDecimal = (value: string) => value.trim().replace(',', '.');

const WEEKDAYS = [
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
    { value: '7', label: 'Sunday' },
];

const DAY_MASKS: Record<string, number> = {
    '1': 1,
    '2': 2,
    '3': 4,
    '4': 8,
    '5': 16,
    '6': 32,
    '7': 64,
};

const maskToDays = (mask: number): string[] =>
    Object.entries(DAY_MASKS)
        .filter(([, bit]) => (mask & bit) === bit)
        .map(([day]) => day);

const parseDays = (
    days: string[] | number | string | null | undefined,
): string[] => {
    if (!days) return [];
    if (Array.isArray(days)) {
        return days
            .map((day) => String(day))
            .filter((day) => day >= '1' && day <= '7');
    }
    if (typeof days === 'number') {
        return maskToDays(days);
    }
    const str = String(days).trim();
    if (!str) return [];
    if (str.includes(',')) {
        return str
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean);
    }
    if (/^\d+$/.test(str)) {
        return maskToDays(Number(str));
    }
    return [];
};

export default withAppLayout<Props>(
    breadcrumbs,
    true,
    ({ carrier, dbProducts }) => {
        const { t } = useI18n();
        const isNew = !carrier || !carrier.id;
        const { data, setData, post, put, processing, errors, transform } =
            useForm({
                name: carrier?.name ?? '',
                db_products: (carrier?.db_products ?? []).map((db) => ({
                    id: db.id,
                    supplement_per_roll: String(db.supplement_per_roll),
                })),
                days: parseDays(carrier?.days),
                minimum_delay_hours: String(carrier?.minimum_delay_hours ?? 24),
                order_cutoff_time: String(
                    carrier?.order_cutoff_time ?? '12:00',
                ).slice(0, 5),
                taxgo:
                    carrier?.taxgo !== null && carrier?.taxgo !== undefined
                        ? String(carrier.taxgo)
                        : '',
                zones: mapZones(carrier?.zones),
            });
        const [importingZones, setImportingZones] = useState(false);
        const [importZonesError, setImportZonesError] = useState<string | null>(
            null,
        );
        const importInputRef = useRef<HTMLInputElement | null>(null);
        const errorBag = errors as Record<string, string>;

        const daysError = useMemo(() => {
            if (errors.days) {
                return errors.days as string;
            }
            const entry = Object.entries(errorBag).find(([key]) =>
                key.startsWith('days.'),
            );
            return entry ? entry[1] : undefined;
        }, [errorBag, errors.days]);

        const getZoneNameError = useCallback(
            (index: number) => {
                return errorBag[`zones.${index}.name`];
            },
            [errorBag],
        );

        const toggleDay = (day: string) => {
            setData((current) => {
                const days = current.days.includes(day)
                    ? current.days.filter((d) => d !== day)
                    : [...current.days, day].sort();

                return { ...current, days };
            });
        };

        const updateZone = useCallback(
            (index: number, updates: Partial<ZoneDraft>) => {
                setData((current) => {
                    const next = [...current.zones];
                    next[index] = { ...next[index], ...updates };
                    return { ...current, zones: next };
                });
            },
            [setData],
        );

        const updateTierPrice = useCallback(
            (zoneIndex: number, roll: string, price: string) => {
                setData((current) => {
                    const next = [...current.zones];
                    const zone = next[zoneIndex];
                    const tiers = [...zone.tiers];
                    const index = tiers.findIndex((tier) => tier.roll === roll);
                    if (index >= 0) {
                        tiers[index] = { ...tiers[index], price };
                    } else {
                        tiers.push({ roll, price });
                    }
                    next[zoneIndex] = { ...zone, tiers };
                    return { ...current, zones: next };
                });
            },
            [setData],
        );

        const insertZone = useCallback(
            (index: number | null, position: 'before' | 'after') => {
                setData((current) => {
                    const currentIndex =
                        index !== null &&
                        index >= 0 &&
                        index < current.zones.length
                            ? index
                            : -1;
                    const insertAt =
                        currentIndex < 0
                            ? current.zones.length
                            : currentIndex + (position === 'after' ? 1 : 0);
                    const next = [...current.zones];
                    next.splice(insertAt, 0, {
                        name: '',
                        mini: '',
                        tiers: [],
                    });
                    return { ...current, zones: next };
                });
            },
            [setData],
        );

        const removeZone = useCallback(
            (index: number) => {
                setData((current) => {
                    const next = [...current.zones];
                    next.splice(index, 1);
                    return { ...current, zones: next };
                });
            },
            [setData],
        );

        const insertRoll = useCallback(
            (roll: string) => {
                setData((current) => ({
                    ...current,
                    zones: current.zones.map((zone) => ({
                        ...zone,
                        tiers: [...zone.tiers, { roll, price: '' }],
                    })),
                }));
            },
            [setData],
        );

        const removeRoll = useCallback(
            (roll: string) => {
                setData((current) => {
                    const next = current.zones.map((zone) => ({
                        ...zone,
                        tiers: zone.tiers.filter((tier) => tier.roll !== roll),
                    }));

                    return { ...current, zones: next };
                });
            },
            [setData],
        );

        const buildPayload = () => {
            const rolls = getUniqueRolls(data.zones);

            return {
                ...data,
                days: data.days,
                db_products: data.db_products.map((db) => ({
                    ...db,
                    supplement_per_roll:
                        normalizeDecimal(db.supplement_per_roll) || '0',
                })),
                taxgo: normalizeDecimal(data.taxgo),
                zones: data.zones.map((zone) => {
                    const tariffs: Record<string, string | null> = {};
                    if (zone.mini.trim() !== '') {
                        tariffs.mini = normalizeDecimal(zone.mini);
                    }

                    rolls.forEach((roll) => {
                        const tier = zone.tiers.find(
                            (candidate) => candidate.roll === roll,
                        );
                        if (!tier) {
                            tariffs[`roll:${roll}`] = null;
                            return;
                        }

                        const price = normalizeDecimal(tier.price);
                        tariffs[`roll:${roll}`] = price === '' ? null : price;
                    });

                    return {
                        id: zone.id,
                        name: zone.name,
                        tariffs,
                    };
                }),
            };
        };

        const rollsRef = useRef<string[]>([]);
        const rolls = useMemo(() => {
            const next = getUniqueRolls(data.zones);
            if (
                next.length === rollsRef.current.length &&
                next.every((r, i) => r === rollsRef.current[i])
            ) {
                return rollsRef.current;
            }
            rollsRef.current = next;
            return next;
        }, [data.zones]);
        const [tierPrompt, setTierPrompt] = useState<{
            prev: number | null;
            next: number | null;
        } | null>(null);
        const [tierValue, setTierValue] = useState('');
        const [tierError, setTierError] = useState<string | null>(null);

        const canInsertRollBefore = useCallback(
            (columnId: string) => {
                if (columnId === 'actions') {
                    return true;
                }
                if (!columnId.startsWith('roll-')) {
                    return false;
                }

                const index = rolls.indexOf(columnId.replace(/^roll-/, ''));
                if (index < 0) {
                    return true;
                }

                const next = Number(rolls[index]);
                if (!Number.isFinite(next)) {
                    return true;
                }

                const prev = index > 0 ? Number(rolls[index - 1]) : null;
                if (prev === null || !Number.isFinite(prev)) {
                    return next >= 2;
                }

                return next - prev >= 2;
            },
            [rolls],
        );

        const openTierPrompt = useCallback(
            (columnIndex: number) => {
                const rollIndex = columnIndex - 2;
                if (rollIndex < 0 || rollIndex > rolls.length) {
                    return;
                }

                const toFinite = (value: number | null) =>
                    value !== null && Number.isFinite(value) ? value : null;
                const prev = toFinite(
                    rollIndex > 0 ? Number(rolls[rollIndex - 1]) : null,
                );
                const next = toFinite(
                    rollIndex < rolls.length ? Number(rolls[rollIndex]) : null,
                );

                const defaultValue =
                    prev !== null && next !== null
                        ? String(Math.floor((prev + next) / 2))
                        : next !== null
                          ? String(next - 1)
                          : prev !== null
                            ? String(prev + 1)
                            : '1';

                setTierValue(defaultValue);
                setTierError(null);
                setTierPrompt({ prev, next });
            },
            [rolls],
        );

        const submitTierPrompt = () => {
            if (!tierPrompt) {
                return;
            }

            const raw = tierValue.trim();
            const value = Number(raw);

            if (raw === '' || !Number.isInteger(value)) {
                setTierError(t('Enter a whole number'));
                return;
            }
            if (value < 1) {
                setTierError(t('The value must be at least 1'));
                return;
            }
            if (rolls.some((roll) => Number(roll) === value)) {
                setTierError(t('This tier already exists'));
                return;
            }
            if (tierPrompt.prev !== null && value <= tierPrompt.prev) {
                setTierError(
                    t('The value must be greater than :min').replace(
                        ':min',
                        String(tierPrompt.prev),
                    ),
                );
                return;
            }
            if (tierPrompt.next !== null && value >= tierPrompt.next) {
                setTierError(
                    t('The value must be less than :max').replace(
                        ':max',
                        String(tierPrompt.next),
                    ),
                );
                return;
            }

            insertRoll(String(value));
            setTierPrompt(null);
        };

        const tierRangeText = tierPrompt
            ? tierPrompt.prev !== null && tierPrompt.next !== null
                ? t('The value must be between :min and :max')
                      .replace(':min', String(tierPrompt.prev))
                      .replace(':max', String(tierPrompt.next))
                : tierPrompt.prev !== null
                  ? t('The value must be greater than :min').replace(
                        ':min',
                        String(tierPrompt.prev),
                    )
                  : t('The value must be less than :max').replace(
                        ':max',
                        String(tierPrompt.next ?? ''),
                    )
            : '';

        const zoneRows = useMemo<ZoneRow[]>(
            () =>
                data.zones.map((zone, index) => ({ ...zone, __index: index })),
            [data.zones],
        );

        const renameRoll = useCallback(
            (columnId: string, nextValue: string) => {
                const oldRoll = columnId.replace(/^roll-/, '');
                const nextRoll = nextValue.trim();
                if (!nextRoll || nextRoll === oldRoll) {
                    return;
                }

                setData((current) => {
                    const existing = getUniqueRolls(current.zones);
                    if (existing.includes(nextRoll)) {
                        return current;
                    }

                    const next = current.zones.map((zone) => ({
                        ...zone,
                        tiers: zone.tiers.map((tier) =>
                            tier.roll === oldRoll
                                ? { ...tier, roll: nextRoll }
                                : tier,
                        ),
                    }));

                    return { ...current, zones: next };
                });
            },
            [setData],
        );

        const getZoneRowId = useCallback(
            (row: ZoneRow) => (row.id ? `id-${row.id}` : `new-${row.__index}`),
            [],
        );

        const getCsrfToken = useCallback(() => {
            const meta = document.querySelector(
                'meta[name="csrf-token"]',
            ) as HTMLMetaElement | null;
            if (meta?.content) {
                return meta.content;
            }

            const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
            return match ? decodeURIComponent(match[1]) : '';
        }, []);

        const handleImportClick = () => {
            importInputRef.current?.click();
        };

        const handleImportFile = useCallback(
            async (event: React.ChangeEvent<HTMLInputElement>) => {
                const file = event.target.files?.[0];
                event.target.value = '';

                if (!file) {
                    return;
                }

                const formData = new FormData();
                formData.append('file', file);

                const url = carrier.id
                    ? carrierZones.import.url({
                          carrier: carrier.id as number,
                      })
                    : carrierZones.parse.url();

                setImportingZones(true);
                setImportZonesError(null);

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            Accept: 'application/json',
                            'X-CSRF-TOKEN': getCsrfToken(),
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        credentials: 'same-origin',
                        body: formData,
                    });

                    const payload = await response.json().catch(() => null);

                    if (!response.ok) {
                        const message =
                            typeof payload?.message === 'string'
                                ? payload.message
                                : (payload?.errors?.file?.[0] ??
                                  t('Import failed'));
                        throw new Error(message);
                    }

                    const nextZones = payload?.carrier?.zones ?? payload?.zones ?? [];
                    setData('zones', mapZones(nextZones));
                } catch (error) {
                    setImportZonesError(
                        error instanceof Error
                            ? error.message
                            : t('Import failed'),
                    );
                } finally {
                    setImportingZones(false);
                }
            },
            [carrier.id, getCsrfToken, setData, t],
        );

        const headerControls = useCallback(
            (columnId: string) => {
                if (!columnId.startsWith('roll-')) {
                    return null;
                }
                const roll = columnId.replace(/^roll-/, '');

                return {
                    editable: true,
                    deletable: true,
                    value: roll,
                    onChange: (value: string) => renameRoll(columnId, value),
                    onDelete: () => removeRoll(roll),
                };
            },
            [removeRoll, renameRoll],
        );

        const zonesHeader = t('Zones');
        const minimumPriceHeader = t('Minimum price');

        const columns = useMemo<ColumnDef<ZoneRow>[]>(() => {
            const rollColumns = rolls.map((roll) => ({
                id: `roll-${roll}`,
                header: roll,
                cell: ({ row }: CellContext<ZoneRow, unknown>) => {
                    const zone = row.original;
                    const price =
                        zone.tiers.find((tier) => tier.roll === roll)?.price ??
                        '';
                    return (
                        <Input
                            type="text"
                            inputMode="decimal"
                            value={price}
                            onChange={(e) =>
                                updateTierPrice(
                                    zone.__index,
                                    roll,
                                    e.target.value.replace(',', '.'),
                                )
                            }
                        />
                    );
                },
            }));

            return [
                {
                    id: 'name',
                    header: zonesHeader,
                    cell: ({ row }: CellContext<ZoneRow, unknown>) => (
                        <div className="space-y-1">
                            <Input
                                value={row.original.name}
                                onChange={(e) =>
                                    updateZone(row.original.__index, {
                                        name: e.target.value,
                                    })
                                }
                                aria-invalid={
                                    !!getZoneNameError(row.original.__index)
                                }
                            />
                            <InputError
                                message={getZoneNameError(row.original.__index)}
                            />
                        </div>
                    ),
                },
                {
                    id: 'mini',
                    header: minimumPriceHeader,
                    cell: ({ row }: CellContext<ZoneRow, unknown>) => (
                        <Input
                            type="text"
                            inputMode="decimal"
                            value={row.original.mini}
                            onChange={(e) =>
                                updateZone(row.original.__index, {
                                    mini: e.target.value.replace(',', '.'),
                                })
                            }
                        />
                    ),
                },
                ...rollColumns,
                {
                    id: 'actions',
                    header: () => null,
                    cell: ({ row }: CellContext<ZoneRow, unknown>) => (
                        <div className="flex items-center gap-0.5 whitespace-nowrap">
                            <div className="flex h-9 w-9 flex-col overflow-hidden rounded-md border border-border/60 bg-transparent">
                                <button
                                    type="button"
                                    className="flex h-1/2 w-full items-center justify-center border-b border-border/60 text-green-600 transition-colors hover:bg-green-500/10 hover:text-green-700 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-green-400"
                                    title={t('Insert a zone before')}
                                    aria-label={t('Insert a zone before')}
                                    onClick={() =>
                                        insertZone(row.original.__index, 'before')
                                    }
                                >
                                    <ChevronUpIcon className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    className="flex h-1/2 w-full items-center justify-center text-green-600 transition-colors hover:bg-green-500/10 hover:text-green-700 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-green-400"
                                    title={t('Insert a zone after')}
                                    aria-label={t('Insert a zone after')}
                                    onClick={() =>
                                        insertZone(row.original.__index, 'after')
                                    }
                                >
                                    <ChevronDownIcon className="h-4 w-4" />
                                </button>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                title={t('Delete zone')}
                                aria-label={t('Delete zone')}
                                onClick={() => removeZone(row.original.__index)}
                            >
                                <TrashIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    ),
                },
            ];
        }, [
            insertZone,
            minimumPriceHeader,
            rolls,
            removeZone,
            t,
            updateTierPrice,
            updateZone,
            zonesHeader,
            getZoneNameError,
        ]);

        const handleSubmit = (e: FormEvent) => {
            e.preventDefault();
            transform(() => buildPayload());
            if (isNew) {
                post(carriers.store.url(), {
                    onFinish: () => transform((payload) => payload),
                });
            } else {
                put(carriers.update.url({ carrier: carrier.id as number }), {
                    onFinish: () => transform((payload) => payload),
                });
            }
        };

        return (
            <form onSubmit={handleSubmit} className="m-0 space-y-6 p-0">
                <Head title={isNew ? t('Create carrier') : t('Edit carrier')} />
                <StickyBar className="w-full" borderBottom={false}>
                    <div className="flex w-full items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                            <Link
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.history.back();
                                }}
                                className="transition-colors duration-200 hover:text-gray-500"
                            >
                                <ArrowLeftCircle size={35} />
                            </Link>
                            <h2 className="text-xl font-semibold">
                                {isNew
                                    ? t('Create carrier')
                                    : t('Edit carrier')}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="submit"
                                disabled={processing || importingZones}
                            >
                                <SaveIcon className="mr-2 h-4 w-4" />{' '}
                                {t('Save')}
                            </Button>
                        </div>
                    </div>
                </StickyBar>

                <div className="flex w-full max-w-[1200px] flex-col gap-5 md:mx-auto">
                    <main className="space-y-6">
                        <Card className="p-4">
                            <div className="grid gap-4 md:grid-cols-3">
                                <FormField
                                    label={t('Name')}
                                    htmlFor="name"
                                    error={errors.name}
                                >
                                    <Input
                                        id="name"
                                        name="name"
                                        value={data.name}
                                        onChange={(e) =>
                                            setData('name', e.target.value)
                                        }
                                        aria-invalid={!!errors.name}
                                    />
                                </FormField>
                                <div className="min-w-0 md:col-span-2">
                                    <BadgeMultiSelect
                                        id="db_products"
                                        label={t('Deliverable bases')}
                                        placeholder={t('Add a base…')}
                                        options={dbProducts.map((db) => ({
                                            value: String(db.id),
                                            label: db.name,
                                        }))}
                                        value={data.db_products.map((db) =>
                                            String(db.id),
                                        )}
                                        onChange={(ids) =>
                                            setData(
                                                'db_products',
                                                ids.map(
                                                    (id) =>
                                                        data.db_products.find(
                                                            (db) =>
                                                                db.id ===
                                                                Number(id),
                                                        ) ?? {
                                                            id: Number(id),
                                                            supplement_per_roll:
                                                                '0',
                                                        },
                                                ),
                                            )
                                        }
                                        renderBadge={(option) => {
                                            const index =
                                                data.db_products.findIndex(
                                                    (db) =>
                                                        db.id ===
                                                        Number(option.value),
                                                );
                                            const base =
                                                data.db_products[index];
                                            return (
                                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                                                    <CountryFlag
                                                        countryCode={
                                                            dbProducts.find(
                                                                (db) =>
                                                                    db.id ===
                                                                    Number(
                                                                        option.value,
                                                                    ),
                                                            )?.country
                                                        }
                                                        title={option.label}
                                                        className="h-3 w-auto rounded-[2px]"
                                                    />
                                                    <span>{option.label}</span>
                                                    <span className="text-muted-foreground">
                                                        +
                                                    </span>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        aria-label={
                                                            t(
                                                                'HT supplement per roll for',
                                                            ) +
                                                            ' ' +
                                                            option.label
                                                        }
                                                        aria-invalid={
                                                            !!errorBag[
                                                                'db_products.' +
                                                                    index +
                                                                    '.supplement_per_roll'
                                                            ]
                                                        }
                                                        value={
                                                            base?.supplement_per_roll ??
                                                            '0'
                                                        }
                                                        className="h-6 w-16 rounded border border-input bg-background px-1 text-right text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                                                        onMouseDown={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                        onTouchEnd={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                        onKeyDown={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                        onChange={(event) =>
                                                            setData(
                                                                'db_products',
                                                                data.db_products.map(
                                                                    (db) =>
                                                                        db.id ===
                                                                        Number(
                                                                            option.value,
                                                                        )
                                                                            ? {
                                                                                  ...db,
                                                                                  supplement_per_roll:
                                                                                      event
                                                                                          .target
                                                                                          .value,
                                                                              }
                                                                            : db,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                    <span className="text-xs text-muted-foreground">
                                                        {t('€/roll')}
                                                    </span>
                                                </span>
                                            );
                                        }}
                                    />
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {t(
                                            'HT supplement per roll added to the grid. 0 = no supplement.',
                                        )}
                                    </p>
                                    {Object.entries(errorBag)
                                        .filter(
                                            ([key]) =>
                                                key === 'db_products' ||
                                                key.startsWith('db_products.'),
                                        )
                                        .map(([key, message]) => (
                                            <InputError
                                                key={key}
                                                message={message}
                                            />
                                        ))}
                                </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-4">
                                <div className="md:col-span-2">
                                    <FormField
                                        label={t('Delivery days')}
                                        htmlFor="days"
                                        error={daysError}
                                    >
                                        <div className="flex flex-wrap gap-3">
                                            {WEEKDAYS.map((day) => (
                                                <div
                                                    key={day.value}
                                                    className="flex items-center space-x-2"
                                                >
                                                    <Checkbox
                                                        id={`day-${day.value}`}
                                                        checked={data.days.includes(
                                                            day.value,
                                                        )}
                                                        onCheckedChange={() =>
                                                            toggleDay(day.value)
                                                        }
                                                    />
                                                    <Label
                                                        htmlFor={`day-${day.value}`}
                                                        className="cursor-pointer text-sm font-normal"
                                                    >
                                                        {t(day.label)}
                                                    </Label>
                                                </div>
                                            ))}
                                        </div>
                                    </FormField>
                                </div>

                                <div>
                                    <FormField
                                        label={t('Minimum delivery delay')}
                                        htmlFor="minimum_delay_hours"
                                        error={errors.minimum_delay_hours}
                                    >
                                        <Select
                                            value={data.minimum_delay_hours}
                                            onValueChange={(value) =>
                                                setData(
                                                    'minimum_delay_hours',
                                                    value,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                id="minimum_delay_hours"
                                                aria-invalid={
                                                    !!errors.minimum_delay_hours
                                                }
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {[24, 48, 72, 96, 120, 168].map(
                                                    (hours) => (
                                                        <SelectItem
                                                            key={hours}
                                                            value={String(
                                                                hours,
                                                            )}
                                                        >
                                                            {hours}h
                                                        </SelectItem>
                                                    ),
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                </div>

                                <div>
                                    <FormField
                                        label={t('Order cutoff time')}
                                        htmlFor="order_cutoff_time"
                                        error={errors.order_cutoff_time}
                                    >
                                        <Input
                                            id="order_cutoff_time"
                                            name="order_cutoff_time"
                                            type="time"
                                            value={data.order_cutoff_time}
                                            onChange={(event) =>
                                                setData(
                                                    'order_cutoff_time',
                                                    event.target.value,
                                                )
                                            }
                                            aria-invalid={
                                                !!errors.order_cutoff_time
                                            }
                                        />
                                    </FormField>
                                </div>
                            </div>
                        </Card>

                        <Card className="space-y-4 p-4">
                            <input
                                ref={importInputRef}
                                type="file"
                                accept=".csv,text/csv,application/csv"
                                className="hidden"
                                onChange={handleImportFile}
                            />
                            {importZonesError && (
                                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    {importZonesError}
                                </div>
                            )}
                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    <h3 className="text-sm font-semibold text-muted-foreground">
                                        {t('Delivery zones')}
                                    </h3>
                                    <div className="h-5 w-px bg-border" />
                                    <div className="flex items-center gap-2">
                                        <Label
                                            htmlFor="taxgo"
                                            className="text-xs font-normal text-muted-foreground"
                                        >
                                            {t('Taxgo')}
                                        </Label>
                                        <div className="flex flex-col">
                                            <Input
                                                id="taxgo"
                                                name="taxgo"
                                                type="text"
                                                inputMode="decimal"
                                                value={data.taxgo}
                                                onChange={(e) =>
                                                    setData(
                                                        'taxgo',
                                                        e.target.value.replace(
                                                            ',',
                                                            '.',
                                                        ),
                                                    )
                                                }
                                                aria-invalid={!!errors.taxgo}
                                                className="h-8 w-24 border-primary/60 bg-primary/5 text-right font-semibold focus-visible:border-primary focus-visible:ring-primary/30"
                                            />
                                            {errors.taxgo && (
                                                <InputError
                                                    message={errors.taxgo}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleImportClick}
                                    disabled={processing || importingZones}
                                >
                                    {importingZones ? (
                                        <>
                                            <Loader2Icon className="mr-2 h-3.5 w-3.5 animate-spin" />
                                            {t('Importing...')}
                                        </>
                                    ) : (
                                        <>
                                            <DownloadIcon className="mr-2 h-3.5 w-3.5" />
                                            {t('Import CSV')}
                                        </>
                                    )}
                                </Button>
                            </div>

                            <DataTable
                                columns={columns}
                                data={zoneRows}
                                emptyMessage={
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => insertZone(null, 'after')}
                                    >
                                        <PlusIcon className="mr-2 h-4 w-4" />{' '}
                                        {t('Add first zone')}
                                    </Button>
                                }
                                getRowId={getZoneRowId}
                                stickyEndColumnId="actions"
                                columnInsertLabel={t('Add a tier here')}
                                onColumnInsert={openTierPrompt}
                                canInsertBefore={canInsertRollBefore}
                                headerControls={headerControls}
                            />

                            <Dialog
                                open={tierPrompt !== null}
                                onOpenChange={(open) => {
                                    if (!open) {
                                        setTierPrompt(null);
                                    }
                                }}
                            >
                                <DialogContent className="sm:max-w-sm">
                                    <DialogHeader>
                                        <DialogTitle>
                                            {t('Add a tier')}
                                        </DialogTitle>
                                        <DialogDescription>
                                            {tierRangeText}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Input
                                        value={tierValue}
                                        inputMode="numeric"
                                        aria-invalid={!!tierError}
                                        onChange={(event) => {
                                            setTierValue(event.target.value);
                                            setTierError(null);
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault();
                                                submitTierPrompt();
                                            }
                                        }}
                                    />
                                    {tierError && (
                                        <p className="text-sm text-destructive">
                                            {tierError}
                                        </p>
                                    )}
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setTierPrompt(null)}
                                        >
                                            {t('Cancel')}
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={submitTierPrompt}
                                        >
                                            {t('Add')}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </Card>
                    </main>
                </div>
            </form>
        );
    },
);
