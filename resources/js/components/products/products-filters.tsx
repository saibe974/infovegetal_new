import { useEffect, useRef, useState, type ComponentType } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { usePage } from "@inertiajs/react";
import { SharedData } from "@/types";
import * as Flags from "country-flag-icons/react/3x2";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { type ProductCategory } from "@/types";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { Checkbox } from "../ui/checkbox";

type FilterActive = 'all' | 'active' | 'inactive';
type ImageFilter = 'all' | 'with' | 'without';

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
    image?: ImageFilter | null;
    onApply: (filters: { active: FilterActive; category: number | null; country: string | null; pot: string | null; height: string | null; image: ImageFilter }) => void;
    onChange?: (filters: { active: FilterActive; category: number | null; country: string | null; pot: string | null; height: string | null; image: ImageFilter }) => void;
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
    const ALL_COUNTRIES = "all";
    const [localCountry, setLocalCountry] = useState<string>(country ? String(country) : ALL_COUNTRIES);
    const ALL_POTS = "all";
    const [localPot, setLocalPot] = useState<string>(pot ? String(pot) : ALL_POTS);
    const ALL_HEIGHTS = "all";
    const [localHeight, setLocalHeight] = useState<string>(height ? String(height) : ALL_HEIGHTS);
    const [localImage, setLocalImage] = useState<ImageFilter>(image === 'with' || image === 'without' ? image : 'all');
    const didInitRef = useRef(false);
    const lastAppliedRef = useRef<string>(
        `${localActive}|${localCategory}|${localCountry}|${localPot}|${localHeight}|${localImage}`
    );

    useEffect(() => {
        setLocalActive(active);
        setLocalCategory(categoryId ? String(categoryId) : ALL_CATEGORIES);
        setLocalCountry(country ? String(country) : ALL_COUNTRIES);
        setLocalPot(pot ? String(pot) : ALL_POTS);
        setLocalHeight(height ? String(height) : ALL_HEIGHTS);
        setLocalImage(image === 'with' || image === 'without' ? image : 'all');
    }, [active, categoryId, country, pot, height, image]);

    useEffect(() => {
        onChange?.({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: localCountry !== ALL_COUNTRIES ? localCountry : null,
            pot: localPot !== ALL_POTS ? localPot : null,
            height: localHeight !== ALL_HEIGHTS ? localHeight : null,
            image: localImage,
        });
    }, [localActive, localCategory, localCountry, localPot, localHeight, localImage, onChange]);

    useEffect(() => {
        if (!autoApply) {
            return;
        }

        if (!didInitRef.current) {
            didInitRef.current = true;
            return;
        }

        const nextKey = `${localActive}|${localCategory}|${localCountry}|${localPot}|${localHeight}|${localImage}`;
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
            image: localImage,
        });
    }, [localActive, localCategory, localCountry, localPot, localHeight, localImage, onApply, autoApply]);

    const hasFilters = localActive !== 'all'
        || localCategory !== ALL_CATEGORIES
        || localCountry !== ALL_COUNTRIES
        || localPot !== ALL_POTS
        || localHeight !== ALL_HEIGHTS
        || localImage !== 'all';


    const apply = () => {
        onApply({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            country: localCountry !== ALL_COUNTRIES ? localCountry : null,
            pot: localPot !== ALL_POTS ? localPot : null,
            height: localHeight !== ALL_HEIGHTS ? localHeight : null,
            image: localImage,
        });
        closeFilters?.();
    };

    const reset = () => {
        setLocalActive('all');
        setLocalCategory(ALL_CATEGORIES);
        setLocalCountry(ALL_COUNTRIES);
        setLocalPot(ALL_POTS);
        setLocalHeight(ALL_HEIGHTS);
        setLocalImage('all');
        onApply({ active: 'all', category: null, country: null, pot: null, height: null, image: 'all' });
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
        if (normalized.length === 2 && typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined') {
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
        <div className="w-full space-y-4 text-left">
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

                    {!singleCountry && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Country')}</p>
                            <ToggleGroup
                                type="single"
                                variant="outline"
                                size="sm"
                                className="flex w-full flex-wrap"
                                spacing={2}
                                value={localCountry}
                                onValueChange={(val) => setLocalCountry(val || ALL_COUNTRIES)}
                            >
                                <ToggleGroupItem value={ALL_COUNTRIES}>
                                    {t('All countries')}
                                </ToggleGroupItem>
                                {countries.map((code) => {
                                    const Flag = (Flags as Record<string, ComponentType<{ title?: string; className?: string }>>)[code];
                                    return (
                                        <ToggleGroupItem key={code} value={code}>
                                            {Flag && <Flag title={getCountryLabel(code)} className="mr-1 w-4" />}
                                            {getCountryLabel(code)}
                                        </ToggleGroupItem>
                                    );
                                })}
                            </ToggleGroup>
                        </div>
                    )}

                    {!singlePot && (
                        <div className="w-full space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Pot diameter')}</p>

                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="sm" className="w-full justify-between rounded-md border border-input">
                                        <span className="truncate">
                                            {localPot === ALL_POTS ? t('All pot diameters') : localPot}
                                        </span>
                                        <ChevronDown className="size-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="max-h-75 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-auto md:max-h-80"
                                >
                                    <DropdownMenuItem
                                        onSelect={() => setLocalPot(ALL_POTS)}
                                        className={localPot === ALL_POTS ? "bg-accent" : undefined}
                                    >
                                        {t('All pot diameters')}
                                    </DropdownMenuItem>
                                    {(potOptions || []).map((value) => {
                                        const option = String(value);
                                        const isSelected = localPot === option;

                                        return (
                                            <DropdownMenuItem
                                                key={option}
                                                onSelect={() => setLocalPot(option)}
                                                className={isSelected ? "bg-accent" : undefined}
                                            >
                                                {option}
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {!singleHeight && (
                        <div className="w-full space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Height')}</p>
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button type="button" variant="ghost" size="sm" className="w-full justify-between rounded-md border border-input">
                                        <span className="truncate">
                                            {localHeight === ALL_HEIGHTS ? t('All heights') : localHeight}
                                        </span>
                                        <ChevronDown className="size-5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="max-h-75 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-auto md:max-h-80"
                                >
                                    <DropdownMenuItem
                                        onSelect={() => setLocalHeight(ALL_HEIGHTS)}
                                        className={localHeight === ALL_HEIGHTS ? "bg-accent" : undefined}
                                    >
                                        {t('All heights')}
                                    </DropdownMenuItem>
                                    {(heightOptions || []).map((value) => {
                                        const option = String(value);
                                        const isSelected = localHeight === option;

                                        return (
                                            <DropdownMenuItem
                                                key={option}
                                                onSelect={() => setLocalHeight(option)}
                                                className={isSelected ? "bg-accent" : undefined}
                                            >
                                                {option}
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
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
