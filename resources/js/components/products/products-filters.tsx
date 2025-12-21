import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import Heading from "../heading";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { type ProductCategory } from "@/types";
import { CheckIcon, XIcon } from "lucide-react";

type FilterActive = 'all' | 'active' | 'inactive';

type ProductsFiltersProps = {
    categories: ProductCategory[];
    active: FilterActive;
    categoryId: number | null;
    onApply: (filters: { active: FilterActive; category: number | null }) => void;
    onFilterAdd?: (filter: { key: string; label: string; value: string }) => void;
    closeFilters?: () => void;
};

export function ProductsFilters({
    categories,
    active,
    categoryId,
    onApply,
    onFilterAdd,
    closeFilters,
}: ProductsFiltersProps) {
    const { t } = useI18n();
    const [localActive, setLocalActive] = useState<FilterActive>(active);
    const ALL_CATEGORIES = "all";
    const [localCategory, setLocalCategory] = useState<string>(categoryId ? String(categoryId) : ALL_CATEGORIES);


    useEffect(() => {
        setLocalActive(active);
        setLocalCategory(categoryId ? String(categoryId) : ALL_CATEGORIES);
    }, [active, categoryId]);

    const hasFilters = localActive !== 'all' || localCategory !== ALL_CATEGORIES;

    const apply = () => {
        onApply({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
        });
        closeFilters?.();
    };

    const reset = () => {
        setLocalActive('all');
        setLocalCategory(ALL_CATEGORIES);
        onApply({ active: 'all', category: null });
        closeFilters?.();
    };

    const renderCategoryLabel = (category: ProductCategory) => {
        const depth = category.depth ?? 0;
        const prefix = depth > 0 ? `${' '.repeat(depth * 2)} ` : "";
        return `${prefix}${category.name}`;
    };

    return (
        <div className="w-full space-y-4 text-left ">
            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Status')}</p>
                <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    spacing={2}
                    value={localActive}
                    onValueChange={(val) => setLocalActive((val as FilterActive) || 'all')}
                >
                    <ToggleGroupItem value="all" className="flex-1">
                        {t('All')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="active" className="flex-1">
                        <CheckIcon className="w-4 h-4 text-green-600 dark:text-main-green" /> {t('Active')}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="inactive" className="flex-1">
                        <XIcon className="w-4 h-4 text-destructive" /> {t('Inactive')}
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Category')}</p>
                <Select value={localCategory} onValueChange={setLocalCategory}>
                    <SelectTrigger>
                        <SelectValue placeholder={t('All categories')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_CATEGORIES}>{t('All categories')}</SelectItem>
                        {categories.map((category) => (
                            <SelectItem key={category.id} value={String(category.id)}>
                                {renderCategoryLabel(category)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

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