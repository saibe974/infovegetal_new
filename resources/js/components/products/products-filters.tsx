import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "../ui/button";
import { usePage } from "@inertiajs/react";
import { SharedData } from "@/types";
import * as Flags from "country-flag-icons/react/3x2";
import { type ProductCategory } from "@/types";
import { Camera, CameraOff, Diameter, MoveVertical, X, Zap } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { CategoryAccordion } from "./category-accordion";
import { BadgeMultiSelect } from "../ui/badge-multi-select";

type FilterActive = 'all' | 'active' | 'inactive';
type ImageFilter = 'all' | 'with' | 'without';
type ProductsFilterValues = {
    active: FilterActive;
    category: number | null;
    country: string[];
    pot: string[];
    height: string[];
    image: ImageFilter;
    promo: boolean;
};

type ProductsFiltersProps = {
    categories: ProductCategory[];
    categoryOptions: number[];
    countryOptions: string[];
    potOptions: string[];
    heightOptions: string[];
    active: FilterActive;
    categoryId: number | null;
    country?: string[];
    pot?: string[];
    height?: string[];
    image?: ImageFilter | null;
    promo?: boolean | null;
    onApply: (filters: ProductsFilterValues) => void;
    closeFilters?: () => void;
};

function SummaryFilterBadge({
    children,
    title,
    onRemove,
}: {
    children: ReactNode;
    title: string;
    onRemove: () => void;
}) {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onRemove}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-main/30 bg-brand-main/10 px-2 py-1 text-xs text-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10"
        >
            {children}
            <X className="size-3 text-muted-foreground" aria-hidden="true" />
        </button>
    );
}

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
    image,
    promo,
    onApply,
    closeFilters,
}: ProductsFiltersProps) {
    const { t } = useI18n();
    const { locale } = usePage<SharedData>().props;
    const [localActive, setLocalActive] = useState<FilterActive>(active);
    const ALL_CATEGORIES = "all";
    const [localCategory, setLocalCategory] = useState<string>(categoryId ? String(categoryId) : ALL_CATEGORIES);
    const [localCountry, setLocalCountry] = useState<string[]>(country ?? []);
    const [localPot, setLocalPot] = useState<string[]>(pot ?? []);
    const [localHeight, setLocalHeight] = useState<string[]>(height ?? []);
    const [localImage, setLocalImage] = useState<ImageFilter>(image === 'with' || image === 'without' ? image : 'all');
    const [localPromo, setLocalPromo] = useState(Boolean(promo));
    const [autoApply, setAutoApply] = useState(() => (
        typeof window !== 'undefined'
        && window.localStorage.getItem('products.filters.auto-apply') === '1'
    ));
    const incomingKey = `${active}|${categoryId ?? ALL_CATEGORIES}|${(country ?? []).join(',')}|${(pot ?? []).join(',')}|${(height ?? []).join(',')}|${image ?? 'all'}|${Boolean(promo)}`;
    const localKey = `${localActive}|${localCategory}|${localCountry.join(',')}|${localPot.join(',')}|${localHeight.join(',')}|${localImage}|${localPromo}`;
    const lastAutoAppliedRef = useRef(incomingKey);
    const previousIncomingKeyRef = useRef(incomingKey);

    useEffect(() => {
        setLocalActive(active);
        setLocalCategory(categoryId ? String(categoryId) : ALL_CATEGORIES);
        setLocalCountry(country ?? []);
        setLocalPot(pot ?? []);
        setLocalHeight(height ?? []);
        setLocalImage(image === 'with' || image === 'without' ? image : 'all');
        setLocalPromo(Boolean(promo));
    }, [active, categoryId, country, pot, height, image, promo]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('products.filters.auto-apply', autoApply ? '1' : '0');
        }
    }, [autoApply]);

    useEffect(() => {
        if (previousIncomingKeyRef.current !== incomingKey) {
            previousIncomingKeyRef.current = incomingKey;
            lastAutoAppliedRef.current = incomingKey;
            return;
        }

        if (!autoApply || localKey === incomingKey || lastAutoAppliedRef.current === localKey) {
            return;
        }

        lastAutoAppliedRef.current = localKey;
        onApply({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: localCountry,
            pot: localPot,
            height: localHeight,
            image: localImage,
            promo: localPromo,
        });
    }, [autoApply, incomingKey, localKey, localActive, localCategory, localCountry, localPot, localHeight, localImage, localPromo, onApply]);

    const hasFilters = localActive !== 'all'
        || localCategory !== ALL_CATEGORIES
        || localCountry.length > 0
        || localPot.length > 0
        || localHeight.length > 0
        || localImage !== 'all'
        || localPromo;


    const apply = () => {
        onApply({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: localCountry,
            pot: localPot,
            height: localHeight,
            image: localImage,
            promo: localPromo,
        });
        closeFilters?.();
    };

    const reset = () => {
        const resetKey = `all|${ALL_CATEGORIES}||||all|false`;

        setLocalActive('all');
        setLocalCategory(ALL_CATEGORIES);
        setLocalCountry([]);
        setLocalPot([]);
        setLocalHeight([]);
        setLocalImage('all');
        setLocalPromo(false);
        lastAutoAppliedRef.current = resetKey;
        onApply({ active: 'all', category: null, country: [], pot: [], height: [], image: 'all', promo: false });
        closeFilters?.();
    };

    const normalizeCountry = (value?: string | null) => {
        const trimmed = value?.trim();
        if (!trimmed) return null;
        return trimmed.length === 2 ? trimmed.toUpperCase() : trimmed;
    };

    const getCountryLabel = (value: string) => {
        const normalized = normalizeCountry(value) ?? value;
        if (normalized.length === 2 && typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined') {
            const displayLocale = typeof locale === 'string' ? locale : 'fr';
            const displayNames = new Intl.DisplayNames([displayLocale], { type: 'region' });
            return displayNames.of(normalized) ?? normalized;
        }
        return normalized;
    };

    const countries = Array.from(
        new Set(
            [...(countryOptions || []), ...localCountry]
                .map((value) => normalizeCountry(value))
                .filter((value): value is string => Boolean(value))
        )
    ).sort((a, b) => a.localeCompare(b));
    const availablePotOptions = Array.from(
        new Set([...(potOptions || []), ...localPot].map((value) => String(value)))
    ).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
    const availableHeightOptions = Array.from(
        new Set([...(heightOptions || []), ...localHeight].map((value) => String(value)))
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const categoryChoices = categoryOptions.length > 0
        ? categories.filter((category) => categoryOptions.includes(category.id))
        : categories;

    const singleCategory = categoryChoices.length === 1 ? categoryChoices[0] : null;
    const selectedCategory = localCategory !== ALL_CATEGORIES
        ? categories.find((category) => category.id === Number(localCategory))
        : null;

    return (
        <div className="flex min-h-full w-full flex-col gap-4 text-left">
            <div className="sticky top-0 z-10 -mx-6 flex w-[calc(100%+3rem)] items-center gap-3 border-b bg-muted/95 px-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-accent/95 dark:shadow-black/40">
                <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 lg:flex">
                    {!hasFilters && (
                        <span className="py-2 text-xs text-muted-foreground">{t('No filters')}</span>
                    )}

                    {localImage !== 'all' && (
                        <SummaryFilterBadge title={localImage === 'with' ? t('With image') : t('Without image')} onRemove={() => setLocalImage('all')}>
                            {localImage === 'with' ? <Camera className="size-3.5" /> : <CameraOff className="size-3.5" />}
                        </SummaryFilterBadge>
                    )}

                    {localPromo && (
                        <SummaryFilterBadge title={t('PROMO')} onRemove={() => setLocalPromo(false)}>
                            <Zap className="size-3.5" />
                            <span>{t('PROMO')}</span>
                        </SummaryFilterBadge>
                    )}

                    {localActive !== 'all' && (
                        <SummaryFilterBadge title={localActive === 'active' ? t('Active') : t('Inactive')} onRemove={() => setLocalActive('all')}>
                            <span>{localActive === 'active' ? t('Active') : t('Inactive')}</span>
                        </SummaryFilterBadge>
                    )}

                    {selectedCategory && (
                        <SummaryFilterBadge title={selectedCategory.name} onRemove={() => setLocalCategory(ALL_CATEGORIES)}>
                            <span>{selectedCategory.name}</span>
                        </SummaryFilterBadge>
                    )}

                    {localCountry.map((code) => {
                        const normalizedCode = normalizeCountry(code) ?? code;
                        const countryLabel = getCountryLabel(normalizedCode);
                        const Flag = (Flags as Record<string, ComponentType<{ title?: string; className?: string }>>)[normalizedCode];

                        return (
                            <SummaryFilterBadge
                                key={`country-${normalizedCode}`}
                                title={countryLabel}
                                onRemove={() => setLocalCountry((values) => values.filter((value) => value !== code))}
                            >
                                {Flag ? <Flag title={countryLabel} className="w-4" /> : null}
                                <span>{countryLabel}</span>
                            </SummaryFilterBadge>
                        );
                    })}

                    {localPot.map((value) => (
                        <SummaryFilterBadge key={`pot-${value}`} title={value} onRemove={() => setLocalPot((values) => values.filter((item) => item !== value))}>
                            <Diameter className="size-3.5" />
                            <span>{value}</span>
                        </SummaryFilterBadge>
                    ))}

                    {localHeight.map((value) => (
                        <SummaryFilterBadge key={`height-${value}`} title={value} onRemove={() => setLocalHeight((values) => values.filter((item) => item !== value))}>
                            <MoveVertical className="size-3.5" />
                            <span>{value}</span>
                        </SummaryFilterBadge>
                    ))}
                </div>

                <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox
                            checked={autoApply}
                            onCheckedChange={(checked) => setAutoApply(checked === true)}
                        />
                        <span>{t('Apply auto')}</span>
                    </label>
                    <Button variant="ghost" size="sm" onClick={reset} disabled={!hasFilters}>
                        {t('Reset')}
                    </Button>
                    <Button size="sm" onClick={apply} disabled={autoApply}>
                        {t('Apply filters')}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:border-r md:pr-6">
                    {!singleCategory && (
                        <CategoryAccordion
                            categories={categories}
                            categoryOptions={categoryOptions}
                            value={localCategory}
                            onChange={setLocalCategory}
                        />
                    )}
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Image')}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                    checked={localImage === 'with'}
                                    onCheckedChange={(checked) => {
                                        setLocalImage(checked ? 'with' : localImage === 'with' ? 'all' : localImage);
                                    }}
                                />
                                <span>{t('With image')}</span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                    checked={localImage === 'without'}
                                    onCheckedChange={(checked) => {
                                        setLocalImage(checked ? 'without' : localImage === 'without' ? 'all' : localImage);
                                    }}
                                />
                                <span>{t('Without image')}</span>
                            </label>
                        </div>
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                            checked={localPromo}
                            onCheckedChange={(checked) => setLocalPromo(checked === true)}
                        />
                        <Zap className="size-4" />
                        <span>{t('PROMO')}</span>
                    </label>

                    {countries.length >= 2 && (
                        <BadgeMultiSelect
                            id="product-country-filter"
                            label={t('Country')}
                            placeholder={t('All countries')}
                            options={countries.map((code) => {
                                const countryLabel = getCountryLabel(code);
                                const Flag = (Flags as Record<string, ComponentType<{ title?: string; className?: string }>>)[code];
                                return {
                                    value: code,
                                    label: countryLabel,
                                    icon: Flag ? <Flag title={countryLabel} className="w-4 shrink-0" /> : undefined,
                                };
                            })}
                            value={localCountry}
                            onChange={setLocalCountry}
                            showAllOptionsWhenEmpty
                        />
                    )}

                    {availablePotOptions.length >= 2 && (
                        <BadgeMultiSelect
                            id="product-pot-filter"
                            label={t('Pot diameter')}
                            placeholder={t('All pot diameters')}
                            options={availablePotOptions.map((value) => ({
                                value,
                                label: value,
                                icon: <Diameter className="size-3.5 shrink-0" />,
                            }))}
                            value={localPot}
                            onChange={setLocalPot}
                        />
                    )}

                    {availableHeightOptions.length >= 2 && (
                        <BadgeMultiSelect
                            id="product-height-filter"
                            label={t('Height')}
                            placeholder={t('All heights')}
                            options={availableHeightOptions.map((value) => ({
                                value,
                                label: value,
                                icon: <MoveVertical className="size-3.5 shrink-0" />,
                            }))}
                            value={localHeight}
                            onChange={setLocalHeight}
                        />
                    )}

                </div>
            </div>
        </div>
    );
}
