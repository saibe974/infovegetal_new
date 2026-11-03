import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "../ui/button";
import { usePage } from "@inertiajs/react";
import { SharedData } from "@/types";
import * as Flags from "country-flag-icons/react/3x2";
import { type ProductCategory } from "@/types";
import { Camera, CameraOff, Diameter, MoveVertical, Pin, PinOff, RotateCcw, Sprout, X, Zap } from "lucide-react";
import { ThreeStateCheckbox } from "../ui/three-state-checkbox";
import { CategoryAccordion } from "./category-accordion";
import { BadgeMultiSelect } from "../ui/badge-multi-select";
import { cn } from "@/lib/utils";
import { canViewProducerNames } from '@/lib/roles';

type FilterActive = 'all' | 'active' | 'inactive';
type ImageFilter = 'all' | 'with' | 'without';
type ProductsFilterValues = {
    active: FilterActive;
    category: number | null;
    country: string[];
    pot: string[];
    height: string[];
    image: ImageFilter;
    promo: boolean | null;
    producer: string[];
};

type ProducerOption = {
    id: number;
    name: string;
};

type ProductsFiltersProps = {
    categories: ProductCategory[];
    categoryOptions: number[];
    countryOptions: string[];
    potOptions: string[];
    heightOptions: string[];
    imageOptions: ('with' | 'without')[];
    promoOptions: boolean[];
    producerOptions?: ProducerOption[];
    active: FilterActive;
    categoryId: number | null;
    country?: string[];
    pot?: string[];
    height?: string[];
    producer?: string[];
    image?: ImageFilter | null;
    promo?: boolean | null;
    onApply: (filters: ProductsFilterValues) => void;
    closeFilters?: () => void;
    /** 'popover' (défaut) : rendu dans le panneau du SearchSelect. 'column' : rendu dans une colonne épinglée. */
    variant?: 'popover' | 'column';
    /** Présent uniquement sur les pages qui supportent l'épinglage en colonne. */
    pin?: {
        docked: boolean;
        onToggle: () => void;
    };
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
    imageOptions,
    promoOptions,
    producerOptions = [],
    categoryId,
    country,
    pot,
    height,
    producer,
    image,
    promo,
    onApply,
    closeFilters,
    variant = 'popover',
    pin,
}: ProductsFiltersProps) {
    const { t } = useI18n();
    const { locale, auth } = usePage<SharedData>().props;
    const showProducerNames = canViewProducerNames(auth?.user);
    const isColumn = variant === 'column';
    const [localActive, setLocalActive] = useState<FilterActive>(active);
    const ALL_CATEGORIES = "all";
    const [localCategory, setLocalCategory] = useState<string>(categoryId ? String(categoryId) : ALL_CATEGORIES);
    const [localCountry, setLocalCountry] = useState<string[]>(country ?? []);
    const [localPot, setLocalPot] = useState<string[]>(pot ?? []);
    const [localHeight, setLocalHeight] = useState<string[]>(height ?? []);
    const [localProducer, setLocalProducer] = useState<string[]>(producer ?? []);
    const [localImage, setLocalImage] = useState<ImageFilter>(image === 'with' || image === 'without' ? image : 'all');
    const [localPromo, setLocalPromo] = useState<boolean | null>(promo ?? null);
    const incomingKey = `${active}|${categoryId ?? ALL_CATEGORIES}|${(country ?? []).join(',')}|${(pot ?? []).join(',')}|${(height ?? []).join(',')}|${(producer ?? []).join(',')}|${image ?? 'all'}|${promo ?? null}`;
    const localKey = `${localActive}|${localCategory}|${localCountry.join(',')}|${localPot.join(',')}|${localHeight.join(',')}|${localProducer.join(',')}|${localImage}|${localPromo}`;
    const lastAppliedRef = useRef(incomingKey);
    const previousIncomingKeyRef = useRef(incomingKey);

    useEffect(() => {
        setLocalActive(active);
        setLocalCategory(categoryId ? String(categoryId) : ALL_CATEGORIES);
        setLocalCountry(country ?? []);
        setLocalPot(pot ?? []);
        setLocalHeight(height ?? []);
        setLocalProducer(producer ?? []);
        setLocalImage(image === 'with' || image === 'without' ? image : 'all');
        setLocalPromo(promo ?? null);
    }, [active, categoryId, country, pot, height, producer, image, promo]);

    useEffect(() => {
        if (previousIncomingKeyRef.current !== incomingKey) {
            previousIncomingKeyRef.current = incomingKey;
            lastAppliedRef.current = incomingKey;
            return;
        }

        if (localKey === incomingKey || lastAppliedRef.current === localKey) {
            return;
        }

        lastAppliedRef.current = localKey;
        onApply({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: localCountry,
            pot: localPot,
            height: localHeight,
            producer: localProducer,
            image: localImage,
            promo: localPromo,
        });
    }, [incomingKey, localKey, localActive, localCategory, localCountry, localPot, localHeight, localProducer, localImage, localPromo, onApply]);

    const hasFilters = localActive !== 'all'
        || localCategory !== ALL_CATEGORIES
        || localCountry.length > 0
        || localPot.length > 0
        || localHeight.length > 0
        || localProducer.length > 0
        || localImage !== 'all'
        || localPromo !== null;


    const reset = () => {
        const resetKey = `all|${ALL_CATEGORIES}|||||all|null`;

        setLocalActive('all');
        setLocalCategory(ALL_CATEGORIES);
        setLocalCountry([]);
        setLocalPot([]);
        setLocalHeight([]);
        setLocalProducer([]);
        setLocalImage('all');
        setLocalPromo(null);
        lastAppliedRef.current = resetKey;
        onApply({ active: 'all', category: null, country: [], pot: [], height: [], producer: [], image: 'all', promo: null });
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

    const categoryChoices = categories.filter((category) => categoryOptions.includes(category.id));


    const selectedCategory = localCategory !== ALL_CATEGORIES
        ? categories.find((category) => category.id === Number(localCategory))
        : null;

    const countryFilters = (
        <>{countryOptions.length >= 2 && (
                        <div className="space-y-2">
                            {!isColumn && (
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    {t('Country')}
                                </span>
                            )}
                            <div id="product-country-filter" role="group" aria-label={t('Country')} className="flex flex-wrap gap-1.5">
                                {countries.map((code) => {
                                    const countryLabel = getCountryLabel(code);
                                    const Flag = (Flags as Record<string, ComponentType<{ title?: string; className?: string; preserveAspectRatio?: string }>>)[code];
                                    const selected = localCountry.length === 0 || localCountry.some((value) => normalizeCountry(value) === code);

                                    return (
                                        <button
                                            key={code}
                                            type="button"
                                            title={countryLabel}
                                            aria-label={countryLabel}
                                            aria-pressed={selected}
                                            onClick={() => setLocalCountry((values) => {
                                                const activeCountries = values.length === 0 ? countries : values;
                                                const next = activeCountries.some((value) => normalizeCountry(value) === code)
                                                    ? activeCountries.filter((value) => normalizeCountry(value) !== code)
                                                    : [...activeCountries, code];
                                                return countries.every((country) => next.some((value) => normalizeCountry(value) === country)) ? [] : next;
                                            })}
                                            className={cn(
                                                'inline-flex aspect-video w-9 shrink-0 items-center justify-center overflow-hidden rounded-sm border px-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                                selected
                                                    ? 'border-brand-main/40 bg-brand-main/10 hover:bg-brand-main/20'
                                                    : 'border-input bg-muted/40 hover:bg-muted',
                                            )}
                                        >
                                            {Flag ? (
                                                <Flag preserveAspectRatio="xMidYMid slice" title={countryLabel} className={cn('block h-full w-full object-cover transition-[filter,opacity]', !selected && 'grayscale opacity-40')} />
                                            ) : (
                                                <span className={cn('text-xs', !selected && 'text-muted-foreground opacity-40')}>{code}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}</>
    );

    const summaryBadges = (
        <>
            {!hasFilters && (
                <span className="py-2 text-xs text-muted-foreground">{t('No filters')}</span>
            )}

            {localImage !== 'all' && (
                <SummaryFilterBadge title={localImage === 'with' ? t('With image') : t('Without image')} onRemove={() => setLocalImage('all')}>
                    {localImage === 'with' ? <Camera className="size-3.5" /> : <CameraOff className="size-3.5" />}
                </SummaryFilterBadge>
            )}

            {localPromo !== null && (
                <SummaryFilterBadge title={t(localPromo ? 'With promo' : 'Without promo')} onRemove={() => setLocalPromo(null)}>
                    <Zap className="size-3.5" />
                    <span>{t(localPromo ? 'With promo' : 'Without promo')}</span>
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

            {localProducer.map((value) => {
                const producer = producerOptions.find((option) => String(option.id) === value);
                const label = showProducerNames && producer?.name ? producer.name : `#${value}`;
                return (
                    <SummaryFilterBadge key={`producer-${value}`} title={label} onRemove={() => setLocalProducer((values) => values.filter((item) => item !== value))}>
                        <Sprout className="size-3.5" />
                        <span>{label}</span>
                    </SummaryFilterBadge>
                );
            })}
        </>
    );

    return (
        <div className="flex min-h-full w-full flex-col gap-4 text-left">
            <div
                className={cn(
                    'sticky top-0 z-10 border-b bg-muted/95 px-6 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-accent/95 dark:shadow-black/40',
                    isColumn ? 'flex flex-col gap-2 py-2 px-4' : '-mx-6 flex w-[calc(100%+3rem)] items-center gap-3',
                )}
            >
                {isColumn ? (
                    <>
                        <div className="flex items-center gap-1">
                            {pin && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="-ml-1.5 size-7 shrink-0"
                                    title={pin.docked ? t('Unpin filters') : t('Pin filters')}
                                    aria-label={pin.docked ? t('Unpin filters') : t('Pin filters')}
                                    onClick={pin.onToggle}
                                >
                                    {pin.docked ? <PinOff className="size-4 text-brand-main" /> : <Pin className="size-4" />}
                                </Button>
                            )}

                            <div className="ml-auto flex items-center gap-0.5">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    title={t('Reset')}
                                    aria-label={t('Reset')}
                                    onClick={reset}
                                    disabled={!hasFilters}
                                >
                                    <RotateCcw className="size-4" />
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {pin && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="-ml-1.5 size-7 shrink-0"
                                title={pin.docked ? t('Unpin filters') : t('Pin filters')}
                                aria-label={pin.docked ? t('Unpin filters') : t('Pin filters')}
                                onClick={pin.onToggle}
                            >
                                {pin.docked ? <PinOff className="size-4 text-brand-main" /> : <Pin className="size-4" />}
                            </Button>
                        )}

                        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-1.5 lg:flex">
                            {summaryBadges}
                        </div>

                        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-3">
                            <Button variant="ghost" size="sm" onClick={reset} disabled={!hasFilters}>
                                <RotateCcw className="size-4" />
                                {t('Reset')}
                            </Button>
                        </div>
                    </>
                )}
            </div>

            <div className={cn('grid gap-6', !isColumn && 'md:grid-cols-2')}>
                <div className={cn('space-y-2', !isColumn && 'md:border-r md:pr-6')}>
                    {isColumn && countryFilters}
                    {categoryChoices.length >= 2 && (
                        <div className="rounded-md border border-border/60 p-2">
                        <CategoryAccordion
                            categories={categories}
                            categoryOptions={categoryOptions}
                            value={localCategory}
                            onChange={setLocalCategory}
                            hideTitle={isColumn}
                            singleOpen={isColumn}
                        />
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    {!isColumn && countryFilters}
                    {potOptions.length >= 2 && (
                        <BadgeMultiSelect
                            id="product-pot-filter"
                            label={isColumn ? undefined : t('Pot diameter')}
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

                    {heightOptions.length >= 2 && (
                        <BadgeMultiSelect
                            id="product-height-filter"
                            label={isColumn ? undefined : t('Height')}
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

                    {producerOptions.length >= 2 && (
                        <BadgeMultiSelect
                            id="product-producer-filter"
                            label={isColumn ? undefined : t('Producer')}
                            placeholder={t('All producers')}
                            options={producerOptions.map((producer) => {
                                const label = showProducerNames && producer.name ? producer.name : `#${producer.id}`;
                                return {
                                    value: String(producer.id),
                                    label,
                                    icon: <Sprout className="size-3.5 shrink-0" />,
                                };
                            })}
                            value={localProducer}
                            onChange={setLocalProducer}
                        />
                    )}

                <div className={cn('flex flex-col items-start gap-4', imageOptions.length < 2 && promoOptions.length < 2 && 'hidden')}>
                    {imageOptions.length >= 2 && (
                        <ThreeStateCheckbox
                            label={t('Image')}
                            checked={localImage === 'all' ? 'indeterminate' : localImage === 'with'}
                            onCheckedChange={(checked) => setLocalImage(checked === 'indeterminate' ? 'all' : checked ? 'with' : 'without')}
                            stateLabels={{
                                checked: t('With image'),
                                unchecked: t('Without image'),
                                indeterminate: t('Any image'),
                            }}
                        />
                    )}
                    {promoOptions.length >= 2 && (
                        <ThreeStateCheckbox
                            label={t('PROMO')}
                            checked={localPromo === null ? 'indeterminate' : localPromo}
                            onCheckedChange={(checked) => setLocalPromo(checked === 'indeterminate' ? null : checked)}
                            stateLabels={{
                                checked: t('With promo'),
                                unchecked: t('Without promo'),
                                indeterminate: t('Any image'),
                            }}
                        />
                    )}

                </div>
                </div>
            </div>
        </div>
    );
}
