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
import { FormEvent, useMemo, useState } from 'react';
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
            .map(([roll, price]) => ({
                roll: String(roll),
                price: String(price ?? ''),
            }));

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

    const updateZone = (index: number, updates: Partial<ZoneDraft>) => {
        const next = [...data.zones];
        next[index] = { ...next[index], ...updates };
        setData('zones', next);
    };

    const updateTierPrice = (zoneIndex: number, roll: string, price: string) => {
        const next = [...data.zones];
        const zone = next[zoneIndex];
        const tiers = [...zone.tiers];
        const index = tiers.findIndex((tier) => tier.roll === roll);
        if (index >= 0) {
            tiers[index] = { ...tiers[index], price };
        } else {
            tiers.push({ roll, price });
        }
        next[zoneIndex] = { ...zone, tiers };
        setData('zones', next);
    };

    const addZone = () => {
        setData('zones', [...data.zones, { name: '', mini: '', tiers: [] }]);
    };

    const removeZone = (index: number) => {
        const next = [...data.zones];
        next.splice(index, 1);
        setData('zones', next.length > 0 ? next : [{ name: '', mini: '', tiers: [] }]);
    };

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

    const removeRoll = (roll: string) => {
        const next = data.zones.map((zone) => ({
            ...zone,
            tiers: zone.tiers.filter((tier) => tier.roll !== roll),
        }));
        setData('zones', next);
    };

    const buildPayload = () => ({
        ...data,
        zones: data.zones.map((zone) => {
            const tariffs: Record<string, string> = {};
            if (zone.mini.trim() !== '') {
                tariffs.mini = zone.mini.trim();
            }
            zone.tiers.forEach((tier) => {
                const roll = tier.roll.trim();
                const price = tier.price.trim();
                if (roll && price) {
                    tariffs[roll] = price;
                }
            });
            return {
                id: zone.id,
                name: zone.name,
                tariffs,
            };
        }),
    });

    const rolls = useMemo(() => getUniqueRolls(data.zones), [data.zones]);
    const zoneRows = useMemo<ZoneRow[]>(
        () => data.zones.map((zone, index) => ({ ...zone, __index: index })),
        [data.zones],
    );

    const renameRoll = (columnId: string, nextValue: string) => {
        const oldRoll = columnId.replace(/^roll-/, '');
        const nextRoll = nextValue.trim();
        if (!nextRoll || nextRoll === oldRoll) {
            return;
        }

        const existing = getUniqueRolls(data.zones);
        if (existing.includes(nextRoll)) {
            return;
        }

        const next = data.zones.map((zone) => ({
            ...zone,
            tiers: zone.tiers.map((tier) =>
                tier.roll === oldRoll ? { ...tier, roll: nextRoll } : tier,
            ),
        }));

        setData('zones', next);
    };

    const columns = useMemo<ColumnDef<ZoneRow>[]>(() => {
        const rollColumns = rolls.map((roll) => ({
            id: `roll-${roll}`,
            header: roll,
            cell: ({ row }: CellContext<ZoneRow, unknown>) => {
                const zone = row.original;
                const price = zone.tiers.find((tier) => tier.roll === roll)?.price ?? '';
                return (
                    <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={(e) => updateTierPrice(zone.__index, roll, e.target.value)}
                    />
                );
            },
        }));

        return [
            {
                id: 'name',
                header: t('Zones'),
                cell: ({ row }: CellContext<ZoneRow, unknown>) => (
                    <Input
                        value={row.original.name}
                        onChange={(e) => updateZone(row.original.__index, { name: e.target.value })}
                    />
                ),
            },
            {
                id: 'mini',
                header: t('Minimum price'),
                cell: ({ row }: CellContext<ZoneRow, unknown>) => (
                    <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.original.mini}
                        onChange={(e) => updateZone(row.original.__index, { mini: e.target.value })}
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
    }, [rolls, removeZone, t, updateTierPrice, updateZone]);

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
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.taxgo}
                                    onChange={(e) => setData('taxgo', e.target.value)}
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
                            getRowId={(row) => (row.id ? `id-${row.id}` : `new-${row.__index}`)}
                            headerControls={(columnId) => {
                                if (!columnId.startsWith('roll-')) {
                                    return null;
                                }
                                const roll = columnId.replace(/^roll-/, '');

                                return {
                                    editable: true,
                                    deletable: true,
                                    value: roll,
                                    onChange: (value) => renameRoll(columnId, value),
                                    onDelete: () => removeRoll(roll),
                                };
                            }}
                        />
                    </Card>
                </main>
            </div>
        </form>
    );
});
