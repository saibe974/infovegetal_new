import { useEffect, useRef, useState, type ComponentType } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { SelectWithItems, type SelectOption } from "../ui/select-with-items";
import { usePage } from "@inertiajs/react";
import { SharedData } from "@/types";
import * as Flags from "country-flag-icons/react/3x2";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { type ProductCategory } from "@/types";
import { CheckIcon, XIcon } from "lucide-react";

type FilterActive = 'all' | 'active' | 'inactive';

type ProductsFiltersProps = {
    categories: ProductCategory[];
    categoryOptions: number[];
    countryOptions: string[];
    potOptions: string[];
    heightOptions: string[];
    active: FilterActive;
    categoryId: number | null;
    country?: string | null;
    pot?: string | null;
    height?: string | null;
    onApply: (filters: { active: FilterActive; category: number | null; country: string | null; pot: string | null; height: string | null }) => void;
    onFilterAdd?: (filter: { key: string; label: string; value: string }) => void;
    closeFilters?: () => void;
};

export function ProductsFilters({
    active,
    categories,
    categoryOptions,
    countryOptions,
    potOptions,
    heightOptions,
    categoryId,
    country,
    pot,
    height,
    onApply,
    onFilterAdd,
    closeFilters,
}: ProductsFiltersProps) {
    const { t } = useI18n();
    const { locale } = usePage<SharedData>().props;
    const [localActive, setLocalActive] = useState<FilterActive>(active);
    const ALL_CATEGORIES = "all";
    const [localCategory, setLocalCategory] = useState<string>(categoryId ? String(categoryId) : ALL_CATEGORIES);
    const ALL_COUNTRIES = "all";
    const [localCountry, setLocalCountry] = useState<string>(country ? String(country) : ALL_COUNTRIES);
    const ALL_POTS = "all";
    const [localPot, setLocalPot] = useState<string>(pot ? String(pot) : ALL_POTS);
    const ALL_HEIGHTS = "all";
    const [localHeight, setLocalHeight] = useState<string>(height ? String(height) : ALL_HEIGHTS);
    const didInitRef = useRef(false);
    const lastAppliedRef = useRef<string>(
        `${localActive}|${localCategory}|${localCountry}|${localPot}|${localHeight}`
    );

    useEffect(() => {
        setLocalActive(active);
        setLocalCategory(categoryId ? String(categoryId) : ALL_CATEGORIES);
        setLocalCountry(country ? String(country) : ALL_COUNTRIES);
        setLocalPot(pot ? String(pot) : ALL_POTS);
        setLocalHeight(height ? String(height) : ALL_HEIGHTS);
    }, [active, categoryId, country, pot, height]);

    useEffect(() => {
        if (!didInitRef.current) {
            didInitRef.current = true;
            return;
        }

        const nextKey = `${localActive}|${localCategory}|${localCountry}|${localPot}|${localHeight}`;
        if (nextKey === lastAppliedRef.current) {
            return;
        }
        lastAppliedRef.current = nextKey;

        onApply({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: localCountry !== ALL_COUNTRIES ? localCountry : null,
            pot: localPot !== ALL_POTS ? localPot : null,
            height: localHeight !== ALL_HEIGHTS ? localHeight : null,
        });
    }, [localActive, localCategory, localCountry, localPot, localHeight, onApply]);

    const hasFilters = localActive !== 'all'
        || localCategory !== ALL_CATEGORIES
        || localCountry !== ALL_COUNTRIES
        || localPot !== ALL_POTS
        || localHeight !== ALL_HEIGHTS;


    const apply = () => {
        onApply({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: localCountry !== ALL_COUNTRIES ? localCountry : null,
            pot: localPot !== ALL_POTS ? localPot : null,
            height: localHeight !== ALL_HEIGHTS ? localHeight : null,
        });
        closeFilters?.();
    };

    const reset = () => {
        setLocalActive('all');
        setLocalCategory(ALL_CATEGORIES);
        setLocalCountry(ALL_COUNTRIES);
        setLocalPot(ALL_POTS);
        setLocalHeight(ALL_HEIGHTS);
        onApply({ active: 'all', category: null, country: null, pot: null, height: null });
        closeFilters?.();
    };

    const renderCategoryLabel = (category: ProductCategory) => {
        const depth = category.depth ?? 0;
        const prefix = depth > 0 ? `${' '.repeat(depth * 2)} ` : "";
        return `${prefix}${category.name}`;
    };

    const normalizeCountry = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return null;
        return trimmed.length === 2 ? trimmed.toUpperCase() : trimmed;
    };

    const getCountryLabel = (value: string) => {
        const normalized = normalizeCountry(value) ?? value;
        if (normalized.length === 2 && typeof Intl !== 'undefined' && (Intl as any).DisplayNames) {
            const displayLocale = typeof locale === 'string' ? locale : 'fr';
            const displayNames = new Intl.DisplayNames([displayLocale], { type: 'region' });
            return displayNames.of(normalized) ?? normalized;
        }
        return normalized;
    };

    const countries = Array.from(
        new Set(
            (countryOptions || [])
                .map((value) => normalizeCountry(value))
                .filter((value): value is string => Boolean(value))
        )
    ).sort((a, b) => a.localeCompare(b));

    const countrySelectOptions: SelectOption[] = [
        { value: ALL_COUNTRIES, label: t('All countries') },
        ...countries.map((code) => {
            const Flag = (Flags as Record<string, ComponentType<{ title?: string; className?: string }>>)[code];
            return {
                value: code,
                label: getCountryLabel(code),
                img: Flag ? <Flag title={getCountryLabel(code)} className="w-4 mr-2" /> : undefined,
            };
        }),
    ];

    const categoryChoices = categoryOptions.length > 0
        ? categories.filter((category) => categoryOptions.includes(category.id))
        : categories;
    const singleCategory = categoryChoices.length === 1 ? categoryChoices[0] : null;
    const singleCountry = countries.length === 1 ? countries[0] : null;
    const singlePot = potOptions.length === 1 ? potOptions[0] : null;
    const singleHeight = heightOptions.length === 1 ? heightOptions[0] : null;

    const singleFilters = [
        singleCategory ? { key: 'category', label: t('Category'), value: renderCategoryLabel(singleCategory) } : null,
        singleCountry ? { key: 'country', label: t('Country'), value: getCountryLabel(singleCountry) } : null,
        singlePot ? { key: 'pot', label: t('Pot diameter'), value: String(singlePot) } : null,
        singleHeight ? { key: 'height', label: t('Height'), value: String(singleHeight) } : null,
    ].filter((item): item is { key: string; label: string; value: string } => Boolean(item));

    return (
        <div className="w-full space-y-4 text-left ">
            {singleFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    {singleFilters.map((filter) => (
                        <div key={filter.key} className="flex items-center gap-2">
                            {filter.key === 'country' && singleCountry ? (
                                (() => {
                                    const Flag = (Flags as Record<string, ComponentType<{ title?: string; className?: string }>>)[singleCountry];
                                    return Flag ? <Flag title={filter.value} className="w-4" /> : null;
                                })()
                            ) : null}
                            <span className="font-semibold uppercase tracking-wide">{filter.label}</span>
                            <span>{filter.value}</span>
                        </div>
                    ))}
                </div>
            )}


            {!singleCategory && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Category')}</p>
                    <Select value={localCategory} onValueChange={setLocalCategory}>
                        <SelectTrigger>
                            <SelectValue placeholder={t('All categories')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_CATEGORIES}>{t('All categories')}</SelectItem>
                            {categoryChoices.map((category) => (
                                <SelectItem key={category.id} value={String(category.id)}>
                                    {renderCategoryLabel(category)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {!singleCountry && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Country')}</p>
                    <SelectWithItems
                        name="country"
                        items={countrySelectOptions}
                        defaultValue={localCountry}
                        placeholder={t('All countries')}
                        onValueChange={setLocalCountry}
                    />
                </div>
            )}

            {!singlePot && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Pot diameter')}</p>
                    <Select value={localPot} onValueChange={setLocalPot}>
                        <SelectTrigger>
                            <SelectValue placeholder={t('All pot diameters')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_POTS}>{t('All pot diameters')}</SelectItem>
                            {(potOptions || []).map((value) => (
                                <SelectItem key={value} value={String(value)}>
                                    {value}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {!singleHeight && (
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Height')}</p>
                    <Select value={localHeight} onValueChange={setLocalHeight}>
                        <SelectTrigger>
                            <SelectValue placeholder={t('All heights')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_HEIGHTS}>{t('All heights')}</SelectItem>
                            {(heightOptions || []).map((value) => (
                                <SelectItem key={value} value={String(value)}>
                                    {value}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Status')}</p>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    className="w-full flex flex-wrap"
                    spacing={2}
                    value={localActive}
                    onValueChange={(val) => setLocalActive((val as FilterActive) || 'all')}
                >
                    <ToggleGroupItem value="all" className="lg:flex-1">
                        {t('All')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="active" className="lg:flex-1">
                        <CheckIcon className="w-4 h-4 text-green-600 dark:text-main-green" /> {t('Active')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="inactive" className="lg:flex-1">
                        <XIcon className="w-4 h-4 text-destructive" /> {t('Inactive')}
                    </ToggleGroupItem>
                </ToggleGroup>
            </div> */}

            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={reset} disabled={!hasFilters}>
                    {t('Reset')}
                </Button>
                <Button size="sm" onClick={apply}>
                    {t('Apply filters')}
                </Button>
            </div>
        </div>
    );
}