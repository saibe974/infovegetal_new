import { DataTable } from '@/components/data-table';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { StickyBar } from '@/components/ui/sticky-bar';
import { withAppLayout } from '@/layouts/app-layout';
import carriers from '@/routes/carriers';
import type { BreadcrumbItem, Carrier, CarrierZone } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { ArrowLeftCircle, PlusIcon, SaveIcon, TrashIcon } from 'lucide-react';
import { FormEvent, useCallback, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import type { CellContext, ColumnDef } from '@tanstack/react-table';

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
        return [{ name: '', mini: '', tiers: [] }];
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

const getNextRoll = (zones: ZoneDraft[]) => {
    const rolls = getUniqueRolls(zones);
    const numericRolls = rolls
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
    let next = numericRolls.length > 0 ? Math.max(...numericRolls) + 1 : 1;
    let candidate = String(next);

    while (rolls.includes(candidate)) {
        next += 1;
        candidate = String(next);
    }

    return candidate;
};

const normalizeDecimal = (value: string) => value.trim().replace(',', '.');

export default withAppLayout<Props>(breadcrumbs, false, ({ carrier }) => {
    const { t } = useI18n();
    const isNew = !carrier || !carrier.id;
    const { data, setData, post, put, processing, errors, transform } = useForm({
        name: carrier?.name ?? '',
        country: carrier?.country ?? '',
        days: carrier?.days !== null && carrier?.days !== undefined ? String(carrier.days) : '',
        minimum: carrier?.minimum !== null && carrier?.minimum !== undefined ? String(carrier.minimum) : '',
        taxgo: carrier?.taxgo !== null && carrier?.taxgo !== undefined ? String(carrier.taxgo) : '',
        zones: mapZones(carrier?.zones),
    });
    const [newRoll, setNewRoll] = useState('');

    const updateZone = useCallback((index: number, updates: Partial<ZoneDraft>) => {
        setData((current) => {
            const next = [...current.zones];
            next[index] = { ...next[index], ...updates };
            return { ...current, zones: next };
        });
    }, [setData]);

    const updateTierPrice = useCallback((zoneIndex: number, roll: string, price: string) => {
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
    }, [setData]);

    const addZone = () => {
        setData('zones', [...data.zones, { name: '', mini: '', tiers: [] }]);
    };

    const removeZone = useCallback((index: number) => {
        setData((current) => {
            const next = [...current.zones];
            next.splice(index, 1);
            return {
                ...current,
                zones: next.length > 0 ? next : [{ name: '', mini: '', tiers: [] }],
            };
        });
    }, [setData]);

    const addRoll = () => {
        let roll = newRoll.trim();
        const rolls = getUniqueRolls(data.zones);
        if (!roll) {
            roll = getNextRoll(data.zones);
        } else if (rolls.includes(roll)) {
            setNewRoll('');
            return;
        }

        const next = data.zones.map((zone) => {
            if (zone.tiers.some((tier) => tier.roll === roll)) {
                return zone;
            }
            return { ...zone, tiers: [...zone.tiers, { roll, price: '' }] };
        });

        setData('zones', next);
        setNewRoll('');
    };

    const removeRoll = useCallback((roll: string) => {
        setData((current) => {
            const next = current.zones.map((zone) => ({
                ...zone,
                tiers: zone.tiers.filter((tier) => tier.roll !== roll),
            }));

            return { ...current, zones: next };
        });
    }, [setData]);

    const buildPayload = () => {
        const rolls = getUniqueRolls(data.zones);

        return {
            ...data,
            taxgo: normalizeDecimal(data.taxgo),
            zones: data.zones.map((zone) => {
                const tariffs: Record<string, string | null> = {};
                if (zone.mini.trim() !== '') {
                    tariffs.mini = normalizeDecimal(zone.mini);
                }

                rolls.forEach((roll) => {
                    const tier = zone.tiers.find((candidate) => candidate.roll === roll);
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

    const rollsSignature = useMemo(
        () =>
            data.zones
                .map((zone) =>
                    zone.tiers
                        .map((tier) => tier.roll.trim())
                        .sort()
                        .join(','),
                )
                .join('|'),
        [data.zones],
    );
    const rolls = useMemo(() => getUniqueRolls(data.zones), [rollsSignature]);
    const zoneRows = useMemo<ZoneRow[]>(
        () => data.zones.map((zone, index) => ({ ...zone, __index: index })),
        [data.zones],
    );

    const renameRoll = useCallback((columnId: string, nextValue: string) => {
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
                    tier.roll === oldRoll ? { ...tier, roll: nextRoll } : tier,
                ),
            }));

            return { ...current, zones: next };
        });
    }, [setData]);

    const getZoneRowId = useCallback((row: ZoneRow) => (row.id ? `id-${row.id}` : `new-${row.__index}`), []);

    const headerControls = useCallback((columnId: string) => {
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
    }, [removeRoll, renameRoll]);

    const zonesHeader = t('Zones');
    const minimumPriceHeader = t('Minimum price');

    const columns = useMemo<ColumnDef<ZoneRow>[]>(() => {
        const rollColumns = rolls.map((roll) => ({
            id: `roll-${roll}`,
            header: roll,
            cell: ({ row }: CellContext<ZoneRow, unknown>) => {
                const zone = row.original;
                const price = zone.tiers.find((tier) => tier.roll === roll)?.price ?? '';
                return (
                    <Input
                        type="text"
                        inputMode="decimal"
                        value={price}
                        onChange={(e) =>
                            updateTierPrice(zone.__index, roll, e.target.value.replace(',', '.'))
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
                    <Input
                        value={row.original.name}
                        onChange={(e) => updateZone(row.original.__index, { name: e.target.value })}
                    />
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
                            updateZone(row.original.__index, { mini: e.target.value.replace(',', '.') })
                        }
                    />
                ),
            },
            ...rollColumns,
            {
                id: 'actions',
                header: '',
                cell: ({ row }: CellContext<ZoneRow, unknown>) => (
                    <Button
                        type="button"
                        variant="destructive-outline"
                        size="icon"
                        onClick={() => removeZone(row.original.__index)}
                    >
                        <TrashIcon size={16} />
                    </Button>
                ),
            },
        ];
    }, [minimumPriceHeader, rolls, removeZone, updateTierPrice, updateZone, zonesHeader]);

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
        <form onSubmit={handleSubmit} className="space-y-6 p-0 m-0">
            <Head title={isNew ? t('Create carrier') : t('Edit carrier')} />
            <StickyBar className="w-full" borderBottom={false}>
                <div className="flex items-center justify-between w-full py-2">
                    <div className="flex items-center gap-2">
                        <Link
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                window.history.back();
                            }}
                            className="hover:text-gray-500 transition-colors duration-200"
                        >
                            <ArrowLeftCircle size={35} />
                        </Link>
                        <h2 className="text-xl font-semibold">
                            {isNew ? t('Create carrier') : t('Edit carrier')}
                        </h2>
                    </div>
                    <Button type="submit" disabled={processing}>
                        <SaveIcon className="mr-2 h-4 w-4" /> {t('Save')}
                    </Button>
                </div>
            </StickyBar>

            <div className="grid items-start gap-8 xl:grid-cols-[2fr_1fr]">
                <main className="space-y-6">
                    <Card className="p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField label={t('Name')} htmlFor="name" error={errors.name}>
                                <Input
                                    id="name"
                                    name="name"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    aria-invalid={!!errors.name}
                                />
                            </FormField>
                            <FormField label={t('Country')} htmlFor="country" error={errors.country}>
                                <Input
                                    id="country"
                                    name="country"
                                    value={data.country}
                                    onChange={(e) => setData('country', e.target.value)}
                                    aria-invalid={!!errors.country}
                                />
                            </FormField>
                            <FormField label={t('Delivery days')} htmlFor="days" error={errors.days}>
                                <Input
                                    id="days"
                                    name="days"
                                    type="number"
                                    min="0"
                                    value={data.days}
                                    onChange={(e) => setData('days', e.target.value)}
                                    aria-invalid={!!errors.days}
                                />
                            </FormField>
                            <FormField label={t('Minimum rolls')} htmlFor="minimum" error={errors.minimum}>
                                <Input
                                    id="minimum"
                                    name="minimum"
                                    type="number"
                                    min="0"
                                    value={data.minimum}
                                    onChange={(e) => setData('minimum', e.target.value)}
                                    aria-invalid={!!errors.minimum}
                                />
                            </FormField>
                            <FormField label={t('Taxgo')} htmlFor="taxgo" error={errors.taxgo}>
                                <Input
                                    id="taxgo"
                                    name="taxgo"
                                    type="text"
                                    inputMode="decimal"
                                    value={data.taxgo}
                                    onChange={(e) => setData('taxgo', e.target.value.replace(',', '.'))}
                                    aria-invalid={!!errors.taxgo}
                                />
                            </FormField>
                        </div>
                    </Card>

                    <Card className="p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-sm font-semibold text-muted-foreground">{t('Delivery zones')}</h3>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={newRoll}
                                        onChange={(e) => setNewRoll(e.target.value)}
                                        placeholder={t('Rolls')}
                                        className="w-24"
                                    />
                                    <Button type="button" variant="outline" size="sm" onClick={addRoll}>
                                        <PlusIcon className="mr-2 h-4 w-4" /> {t('Add tier')}
                                    </Button>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addZone}>
                                    <PlusIcon className="mr-2 h-4 w-4" /> {t('Add zone')}
                                </Button>
                            </div>
                        </div>

                        <DataTable
                            columns={columns}
                            data={zoneRows}
                            emptyMessage={t('No zones yet')}
                            getRowId={getZoneRowId}
                            headerControls={headerControls}
                        />
                    </Card>
                </main>
            </div>
        </form>
    );
});
