import { CategoryAccordion } from '@/components/products/category-accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCountryLabel, normalizeCountry } from '@/lib/country';
import type { ProductCategory, SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import * as Flags from 'country-flag-icons/react/3x2';
import { Zap } from 'lucide-react';
import { useEffect, useState, type ComponentType } from 'react';

type Option = { id: number; name: string };

export type PromotionProductFilterValues = {
    database: string;
    category: string;
    availability: string;
    country: string[];
    pot: string[];
    height: string[];
    image: 'all' | 'with' | 'without';
    promo: boolean;
};

type Props = {
    categories: ProductCategory[];
    categoryOptions: number[];
    databaseOptions: Option[];
    countryOptions: string[];
    potOptions: string[];
    heightOptions: string[];
    database: string;
    category: string;
    availability: string;
    country: string[];
    pot: string[];
    height: string[];
    image: 'all' | 'with' | 'without';
    promo: boolean;
    hideDatabase?: boolean;
    hideCategory?: boolean;
    onApply: (values: PromotionProductFilterValues) => void;
    closeFilters?: () => void;
};

const ALL = 'all';

export function PromotionProductFilters({
    categories,
    categoryOptions,
    databaseOptions,
    countryOptions,
    potOptions,
    heightOptions,
    database,
    category,
    availability,
    country,
    pot,
    height,
    image,
    promo,
    hideDatabase = false,
    hideCategory = false,
    onApply,
    closeFilters,
}: Props) {
    const { locale } = usePage<SharedData>().props;
    const [localDatabase, setLocalDatabase] = useState(database || ALL);
    const [localCategory, setLocalCategory] = useState(category || ALL);
    const [localAvailability, setLocalAvailability] = useState(availability || ALL);
    const [localCountry, setLocalCountry] = useState<string[]>(country ?? []);
    const [localPot, setLocalPot] = useState<string[]>(pot ?? []);
    const [localHeight, setLocalHeight] = useState<string[]>(height ?? []);
    const [localImage, setLocalImage] = useState<'all' | 'with' | 'without'>(image === 'with' || image === 'without' ? image : ALL);
    const [localPromo, setLocalPromo] = useState(Boolean(promo));

    useEffect(() => {
        setLocalDatabase(database || ALL);
        setLocalCategory(category || ALL);
        setLocalAvailability(availability || ALL);
        setLocalCountry(country ?? []);
        setLocalPot(pot ?? []);
        setLocalHeight(height ?? []);
        setLocalImage(image === 'with' || image === 'without' ? image : ALL);
        setLocalPromo(Boolean(promo));
    }, [database, category, availability, country, pot, height, image, promo]);

    const buildValues = (overrides: Partial<PromotionProductFilterValues> = {}): PromotionProductFilterValues => ({
        database: localDatabase,
        category: localCategory,
        availability: localAvailability,
        country: localCountry,
        pot: localPot,
        height: localHeight,
        image: localImage,
        promo: localPromo,
        ...overrides,
    });

    const hasFilters = localDatabase !== ALL
        || localCategory !== ALL
        || localAvailability !== ALL
        || localCountry.length > 0
        || localPot.length > 0
        || localHeight.length > 0
        || localImage !== ALL
        || localPromo;

    const apply = () => {
        onApply(buildValues());
        closeFilters?.();
    };

    const reset = () => {
        setLocalDatabase(ALL);
        setLocalCategory(ALL);
        setLocalAvailability(ALL);
        setLocalCountry([]);
        setLocalPot([]);
        setLocalHeight([]);
        setLocalImage(ALL);
        setLocalPromo(false);
        onApply(buildValues({ database: ALL, category: ALL, availability: ALL, country: [], pot: [], height: [], image: ALL, promo: false }));
        closeFilters?.();
    };

    const applyMultiFilter = (key: 'country' | 'pot' | 'height', values: string[]) => {
        if (key === 'country') setLocalCountry(values);
        if (key === 'pot') setLocalPot(values);
        if (key === 'height') setLocalHeight(values);
        onApply(buildValues({ [key]: values } as Partial<PromotionProductFilterValues>));
    };

    const countries = Array.from(
        new Set(
            [...(countryOptions || []), ...localCountry]
                .map((value) => normalizeCountry(value))
                .filter((value): value is string => Boolean(value)),
        ),
    ).sort((a, b) => a.localeCompare(b));
    const availablePotOptions = Array.from(
        new Set([...(potOptions || []), ...localPot].map((value) => String(value))),
    ).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
    const availableHeightOptions = Array.from(
        new Set([...(heightOptions || []), ...localHeight].map((value) => String(value))),
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return (
        <div className="w-full space-y-4 text-left">
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:border-r md:pr-6">
                    {!hideCategory && (
                        <CategoryAccordion
                            categories={categories}
                            categoryOptions={categoryOptions}
                            value={localCategory}
                            onChange={setLocalCategory}
                            title="Catégorie"
                            allLabel="Toutes les catégories"
                        />
                    )}
                </div>

                <div className="space-y-4">
                    {!hideDatabase && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Base</p>
                            <Select value={localDatabase} onValueChange={setLocalDatabase}>
                                <SelectTrigger className="w-full"><SelectValue placeholder="Toutes les bases" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ALL}>Toutes les bases</SelectItem>
                                    {databaseOptions.map((option) => (
                                        <SelectItem key={option.id} value={String(option.id)}>{option.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Disponibilité</p>
                        <Select value={localAvailability} onValueChange={setLocalAvailability}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>Toutes les disponibilités</SelectItem>
                                <SelectItem value="available">Disponibles maintenant</SelectItem>
                                <SelectItem value="upcoming">À venir</SelectItem>
                                <SelectItem value="ended">Disponibilité terminée</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Image</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                    checked={localImage === 'with'}
                                    onCheckedChange={(checked) => {
                                        setLocalImage(checked ? 'with' : localImage === 'with' ? ALL : localImage);
                                    }}
                                />
                                <span>Avec image</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                    checked={localImage === 'without'}
                                    onCheckedChange={(checked) => {
                                        setLocalImage(checked ? 'without' : localImage === 'without' ? ALL : localImage);
                                    }}
                                />
                                <span>Sans image</span>
                            </label>
                        </div>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={localPromo} onCheckedChange={(checked) => setLocalPromo(checked === true)} />
                        <Zap className="size-4" />
                        <span>PROMO</span>
                    </label>

                    {countries.length >= 2 && (
                        <MultiSelectDropdown
                            label="Pays"
                            allLabel="Tous les pays"
                            options={countries.map((code) => {
                                const countryLabel = getCountryLabel(code, locale);
                                const Flag = (Flags as Record<string, ComponentType<{ title?: string; className?: string }>>)[code];
                                return {
                                    value: code,
                                    text: countryLabel,
                                    label: (
                                        <span className="flex items-center gap-2">
                                            {Flag ? <Flag title={countryLabel} className="w-4" /> : null}
                                            {countryLabel}
                                        </span>
                                    ),
                                };
                            })}
                            selected={localCountry}
                            onApply={(values) => applyMultiFilter('country', values)}
                            applyLabel="Appliquer"
                            clearLabel="Réinitialiser"
                        />
                    )}

                    {availablePotOptions.length >= 2 && (
                        <MultiSelectDropdown
                            label="Pot"
                            allLabel="Tous les diamètres"
                            options={availablePotOptions.map((value) => ({
                                value: String(value),
                                text: String(value),
                                label: String(value),
                            }))}
                            selected={localPot}
                            onApply={(values) => applyMultiFilter('pot', values)}
                            applyLabel="Appliquer"
                            clearLabel="Réinitialiser"
                        />
                    )}

                    {availableHeightOptions.length >= 2 && (
                        <MultiSelectDropdown
                            label="Hauteur"
                            allLabel="Toutes les hauteurs"
                            options={availableHeightOptions.map((value) => ({
                                value: String(value),
                                text: String(value),
                                label: String(value),
                            }))}
                            selected={localHeight}
                            onApply={(values) => applyMultiFilter('height', values)}
                            applyLabel="Appliquer"
                            clearLabel="Réinitialiser"
                        />
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={reset} disabled={!hasFilters}>
                            Réinitialiser
                        </Button>
                        <Button size="sm" onClick={apply}>
                            Appliquer
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}