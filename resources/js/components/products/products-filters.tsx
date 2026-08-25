import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { usePage } from "@inertiajs/react";
import { SharedData } from "@/types";
import * as Flags from "country-flag-icons/react/3x2";
import { type ProductCategory } from "@/types";
import { ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Checkbox } from "../ui/checkbox";

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

type MultiSelectOption = {
    value: string;
    text: string;
    label: ReactNode;
};

function MultiSelectDropdown({
    label,
    allLabel,
    options,
    selected,
    onApply,
    applyLabel,
    clearLabel,
}: {
    label: string;
    allLabel: string;
    options: MultiSelectOption[];
    selected: string[];
    onApply: (values: string[]) => void;
    applyLabel: string;
    clearLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<string[]>(selected);

    useEffect(() => {
        if (!open) {
            setDraft(selected);
        }
    }, [selected, open]);

    const summaryValues = selected
        .map((value) => options.find((option) => option.value === value)?.text ?? value);
    const summary = summaryValues.length === 0
        ? allLabel
        : summaryValues.length <= 2
            ? summaryValues.join(', ')
            : `${summaryValues.slice(0, 2).join(', ')} +${summaryValues.length - 2}`;

    return (
        <div className="w-full space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <DropdownMenu
                modal={false}
                open={open}
                onOpenChange={(nextOpen) => {
                    if (nextOpen) {
                        setDraft(selected);
                    }
                    setOpen(nextOpen);
                }}
            >
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="w-full justify-between rounded-md border border-input">
                        <span className="truncate">{summary}</span>
                        <ChevronDown className="size-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                    <div className="max-h-60 overflow-y-auto">
                        {options.map((option) => (
                            <DropdownMenuCheckboxItem
                                key={option.value}
                                checked={draft.includes(option.value)}
                                onCheckedChange={() => {
                                    setDraft((current) => current.includes(option.value)
                                        ? current.filter((value) => value !== option.value)
                                        : [...current, option.value]);
                                }}
                                onSelect={(event) => event.preventDefault()}
                            >
                                {option.label}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </div>
                    <DropdownMenuSeparator />
                    <div className="flex items-center justify-end gap-2 p-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDraft([])}>
                            {clearLabel}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                                onApply(draft);
                                setOpen(false);
                            }}
                        >
                            {applyLabel}
                        </Button>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

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
    onChange?: (filters: ProductsFilterValues) => void;
    closeFilters?: () => void;
    autoApply?: boolean;
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
    image,
    promo,
    onApply,
    onChange,
    closeFilters,
    autoApply = true,
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
    const didInitRef = useRef(false);
    const lastAppliedRef = useRef<string>(
        `${localActive}|${localCategory}|${localCountry.join(',')}|${localPot.join(',')}|${localHeight.join(',')}|${localImage}|${localPromo}`
    );

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
        onChange?.({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: localCountry,
            pot: localPot,
            height: localHeight,
            image: localImage,
            promo: localPromo,
        });
    }, [localActive, localCategory, localCountry, localPot, localHeight, localImage, localPromo, onChange]);

    useEffect(() => {
        if (!autoApply) {
            return;
        }

        if (!didInitRef.current) {
            didInitRef.current = true;
            return;
        }

        const nextKey = `${localActive}|${localCategory}|${localCountry.join(',')}|${localPot.join(',')}|${localHeight.join(',')}|${localImage}|${localPromo}`;
        if (nextKey === lastAppliedRef.current) {
            return;
        }
        lastAppliedRef.current = nextKey;

        onApply({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: localCountry,
            pot: localPot,
            height: localHeight,
            image: localImage,
            promo: localPromo,
        });
    }, [localActive, localCategory, localCountry, localPot, localHeight, localImage, localPromo, onApply, autoApply]);

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
        setLocalActive('all');
        setLocalCategory(ALL_CATEGORIES);
        setLocalCountry([]);
        setLocalPot([]);
        setLocalHeight([]);
        setLocalImage('all');
        setLocalPromo(false);
        onApply({ active: 'all', category: null, country: [], pot: [], height: [], image: 'all', promo: false });
        closeFilters?.();
    };

    const applyMultiFilter = (key: 'country' | 'pot' | 'height', values: string[]) => {
        const next: ProductsFilterValues = {
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: key === 'country' ? values : localCountry,
            pot: key === 'pot' ? values : localPot,
            height: key === 'height' ? values : localHeight,
            image: localImage,
            promo: localPromo,
        };

        if (key === 'country') setLocalCountry(values);
        if (key === 'pot') setLocalPot(values);
        if (key === 'height') setLocalHeight(values);

        lastAppliedRef.current = `${next.active}|${next.category ?? ALL_CATEGORIES}|${next.country.join(',')}|${next.pot.join(',')}|${next.height.join(',')}|${next.image}|${next.promo}`;
        onApply(next);
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

    const categoryById = new Map(categories.map((category) => [category.id, category]));
    const childrenByParent = new Map<number | null, ProductCategory[]>();
    const visibleCategoryIds = new Set<number>();

    if (categoryOptions.length > 0) {
        categoryOptions.forEach((id) => {
            visibleCategoryIds.add(id);

            let current = categoryById.get(id);
            while (current?.parent_id) {
                visibleCategoryIds.add(current.parent_id);
                current = categoryById.get(current.parent_id);
            }
        });
    } else {
        categories.forEach((category) => visibleCategoryIds.add(category.id));
    }

    categories.forEach((category) => {
        const parentId = category.parent_id ?? null;
        const list = childrenByParent.get(parentId) ?? [];
        list.push(category);
        childrenByParent.set(parentId, list);
    });

    childrenByParent.forEach((list, parentId) => {
        childrenByParent.set(parentId, list.sort((a, b) => a.name.localeCompare(b.name)));
    });

    const taxonomyRootId = categoryById.has(1) ? 1 : null;
    const rootCategories = (taxonomyRootId !== null
        ? childrenByParent.get(taxonomyRootId)
        : childrenByParent.get(null))?.filter((category) => visibleCategoryIds.has(category.id)) ?? [];

    const getDescendants = (categoryId: number): ProductCategory[] => {
        const descendants: ProductCategory[] = [];
        const stack = [...(childrenByParent.get(categoryId) ?? [])];

        while (stack.length) {
            const current = stack.shift();
            if (!current) continue;
            if (visibleCategoryIds.has(current.id)) {
                descendants.push(current);
            }
            const currentChildren = childrenByParent.get(current.id) ?? [];
            stack.unshift(...currentChildren);
        }

        return descendants;
    };

    const isCategoryInBranch = (currentId: string, parentId: number): boolean => {
        if (currentId === String(parentId)) {
            return true;
        }

        let current = categoryById.get(Number(currentId));
        while (current?.parent_id) {
            if (current.parent_id === parentId) {
                return true;
            }
            current = categoryById.get(current.parent_id);
        }

        return false;
    };

    const singleCategory = categoryChoices.length === 1 ? categoryChoices[0] : null;

    return (
        <div className="w-full space-y-4 text-left">
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:border-r md:pr-6">
                    {!singleCategory && (
                        <>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Category')}</p>
                            <div className="space-y-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className={cn(
                                        "w-full justify-start rounded-md border border-input",
                                        localCategory === ALL_CATEGORIES ? "bg-accent" : undefined
                                    )}
                                    onClick={() => setLocalCategory(ALL_CATEGORIES)}
                                >
                                    {t('All categories')}
                                </Button>

                                {rootCategories.map((parent) => {
                                    const descendants = getDescendants(parent.id);
                                    const hasChildren = descendants.length > 0;
                                    const isSelected = localCategory === String(parent.id);
                                    const isBranchSelected = isCategoryInBranch(localCategory, parent.id);
                                    const parentLabel = parent.name.charAt(0).toUpperCase() + parent.name.slice(1);

                                    if (!hasChildren) {
                                        return (
                                            <Button
                                                key={parent.id}
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    "w-full justify-start rounded-md border border-input",
                                                    isSelected ? "bg-accent" : undefined
                                                )}
                                                onClick={() => setLocalCategory(String(parent.id))}
                                            >
                                                {parentLabel}
                                            </Button>
                                        );
                                    }

                                    return (
                                        <Collapsible key={parent.id} defaultOpen={isBranchSelected} className="rounded-md border border-input">
                                            <CollapsibleTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                        "group w-full justify-between rounded-md",
                                                        isBranchSelected ? "bg-accent" : undefined
                                                    )}
                                                >
                                                    <span className="truncate">{parentLabel}</span>
                                                    <ChevronDown className="size-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                                                </Button>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent className="border-t border-border p-1">
                                                <div className="space-y-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className={cn(
                                                            "w-full justify-start font-medium",
                                                            isSelected ? "bg-accent" : undefined
                                                        )}
                                                        onClick={() => setLocalCategory(String(parent.id))}
                                                    >
                                                        <span className="truncate">{parentLabel}</span>
                                                    </Button>
                                                    {descendants.map((child) => {
                                                        const childSelected = localCategory === String(child.id);
                                                        const relativeDepth = Math.max(
                                                            0,
                                                            (child.depth ?? 0) - (parent.depth ?? 0) - 1
                                                        );

                                                        return (
                                                            <Button
                                                                key={child.id}
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className={cn(
                                                                    "w-full justify-start",
                                                                    childSelected ? "bg-accent" : undefined
                                                                )}
                                                                style={{ paddingLeft: `${0.75 + relativeDepth * 0.75}rem` }}
                                                                onClick={() => setLocalCategory(String(child.id))}
                                                            >
                                                                <span className="truncate">
                                                                    {child.name.charAt(0).toUpperCase() + child.name.slice(1)}
                                                                </span>
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                            </CollapsibleContent>
                                        </Collapsible>
                                    );
                                })}
                            </div>
                        </>
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
                        <MultiSelectDropdown
                            label={t('Country')}
                            allLabel={t('All countries')}
                            options={countries.map((code) => {
                                const countryLabel = getCountryLabel(code);
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
                            applyLabel={t('Apply filters')}
                            clearLabel={t('Reset')}
                        />
                    )}

                    {availablePotOptions.length >= 2 && (
                        <MultiSelectDropdown
                            label={t('Pot diameter')}
                            allLabel={t('All pot diameters')}
                            options={availablePotOptions.map((value) => ({
                                value: String(value),
                                text: String(value),
                                label: String(value),
                            }))}
                            selected={localPot}
                            onApply={(values) => applyMultiFilter('pot', values)}
                            applyLabel={t('Apply filters')}
                            clearLabel={t('Reset')}
                        />
                    )}

                    {availableHeightOptions.length >= 2 && (
                        <MultiSelectDropdown
                            label={t('Height')}
                            allLabel={t('All heights')}
                            options={availableHeightOptions.map((value) => ({
                                value: String(value),
                                text: String(value),
                                label: String(value),
                            }))}
                            selected={localHeight}
                            onApply={(values) => applyMultiFilter('height', values)}
                            applyLabel={t('Apply filters')}
                            clearLabel={t('Reset')}
                        />
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" size="sm" onClick={reset} disabled={!hasFilters}>
                            {t('Reset')}
                        </Button>
                        <Button size="sm" onClick={apply}>
                            {t('Apply filters')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
