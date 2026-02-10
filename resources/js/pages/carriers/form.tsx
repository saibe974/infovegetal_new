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
import { FormEvent } from 'react';
import { useI18n } from '@/lib/i18n';

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
        return [{ name: '', mini: '', tiers: [{ roll: '', price: '' }] }];
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
            tiers: tiers.length > 0 ? tiers : [{ roll: '', price: '' }],
        };
    });
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

    const updateZone = (index: number, updates: Partial<ZoneDraft>) => {
        const next = [...data.zones];
        next[index] = { ...next[index], ...updates };
        setData('zones', next);
    };

    const updateTier = (zoneIndex: number, tierIndex: number, updates: Partial<ZoneTier>) => {
        const next = [...data.zones];
        const zone = next[zoneIndex];
        const tiers = [...zone.tiers];
        tiers[tierIndex] = { ...tiers[tierIndex], ...updates };
        next[zoneIndex] = { ...zone, tiers };
        setData('zones', next);
    };

    const addZone = () => {
        setData('zones', [...data.zones, { name: '', mini: '', tiers: [{ roll: '', price: '' }] }]);
    };

    const removeZone = (index: number) => {
        const next = [...data.zones];
        next.splice(index, 1);
        setData('zones', next.length > 0 ? next : [{ name: '', mini: '', tiers: [{ roll: '', price: '' }] }]);
    };

    const addTier = (zoneIndex: number) => {
        const next = [...data.zones];
        const zone = next[zoneIndex];
        next[zoneIndex] = { ...zone, tiers: [...zone.tiers, { roll: '', price: '' }] };
        setData('zones', next);
    };

    const removeTier = (zoneIndex: number, tierIndex: number) => {
        const next = [...data.zones];
        const zone = next[zoneIndex];
        const tiers = [...zone.tiers];
        tiers.splice(tierIndex, 1);
        next[zoneIndex] = { ...zone, tiers: tiers.length > 0 ? tiers : [{ roll: '', price: '' }] };
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
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-muted-foreground">{t('Delivery zones')}</h3>
                            <Button type="button" variant="outline" size="sm" onClick={addZone}>
                                <PlusIcon className="mr-2 h-4 w-4" /> {t('Add zone')}
                            </Button>
                        </div>

                        {data.zones.map((zone, zoneIndex) => (
                            <div key={zoneIndex} className="rounded-md border border-border p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold">{t('Zone')} {zoneIndex + 1}</h4>
                                    <Button
                                        type="button"
                                        variant="destructive-outline"
                                        size="sm"
                                        onClick={() => removeZone(zoneIndex)}
                                    >
                                        <TrashIcon className="mr-2 h-4 w-4" /> {t('Remove zone')}
                                    </Button>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormField label={t('Zone name')} htmlFor={`zone-name-${zoneIndex}`}>
                                        <Input
                                            id={`zone-name-${zoneIndex}`}
                                            value={zone.name}
                                            onChange={(e) => updateZone(zoneIndex, { name: e.target.value })}
                                        />
                                    </FormField>
                                    <FormField label={t('Minimum price')} htmlFor={`zone-mini-${zoneIndex}`}>
                                        <Input
                                            id={`zone-mini-${zoneIndex}`}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={zone.mini}
                                            onChange={(e) => updateZone(zoneIndex, { mini: e.target.value })}
                                        />
                                    </FormField>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h5 className="text-xs font-semibold text-muted-foreground">{t('Tariffs by rolls')}</h5>
                                        <Button type="button" variant="outline" size="sm" onClick={() => addTier(zoneIndex)}>
                                            <PlusIcon className="mr-2 h-4 w-4" /> {t('Add tier')}
                                        </Button>
                                    </div>
                                    {zone.tiers.map((tier, tierIndex) => (
                                        <div key={`${zoneIndex}-${tierIndex}`} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
                                            <FormField label={t('Rolls')} htmlFor={`tier-roll-${zoneIndex}-${tierIndex}`}>
                                                <Input
                                                    id={`tier-roll-${zoneIndex}-${tierIndex}`}
                                                    value={tier.roll}
                                                    onChange={(e) => updateTier(zoneIndex, tierIndex, { roll: e.target.value })}
                                                />
                                            </FormField>
                                            <FormField label={t('Price')} htmlFor={`tier-price-${zoneIndex}-${tierIndex}`}>
                                                <Input
                                                    id={`tier-price-${zoneIndex}-${tierIndex}`}
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={tier.price}
                                                    onChange={(e) => updateTier(zoneIndex, tierIndex, { price: e.target.value })}
                                                />
                                            </FormField>
                                            <Button
                                                type="button"
                                                variant="destructive-outline"
                                                size="icon"
                                                onClick={() => removeTier(zoneIndex, tierIndex)}
                                            >
                                                <TrashIcon size={16} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </Card>
                </main>
            </div>
        </form>
    );
});
