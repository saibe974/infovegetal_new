import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import Heading from "../heading";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { dbProduct, type ProductCategory } from "@/types";
import { CheckIcon, XIcon } from "lucide-react";

type FilterActive = 'all' | 'active' | 'inactive';

type ProductsFiltersProps = {
    categories: ProductCategory[];
    dbProducts: dbProduct[];
    active: FilterActive;
    categoryId: number | null;
    dbProductId?: number | null;
    onApply: (filters: { active: FilterActive; category: number | null; dbProductId: number | null }) => void;
    onFilterAdd?: (filter: { key: string; label: string; value: string }) => void;
    closeFilters?: () => void;
};

export function ProductsFilters({
    active,
    categories,
    dbProducts,
    categoryId,
    dbProductId,
    onApply,
    onFilterAdd,
    closeFilters,
}: ProductsFiltersProps) {
    const { t } = useI18n();
    const [localActive, setLocalActive] = useState<FilterActive>(active);
    const ALL_CATEGORIES = "all";
    const [localCategory, setLocalCategory] = useState<string>(categoryId ? String(categoryId) : ALL_CATEGORIES);
    const ALL_DB_PRODUCTS = "all";
    const [localDbProductId, setLocalDbProductId] = useState<string>(dbProductId ? String(dbProductId) : ALL_DB_PRODUCTS);

    useEffect(() => {
        setLocalActive(active);
        setLocalCategory(categoryId ? String(categoryId) : ALL_CATEGORIES);
        setLocalDbProductId(dbProductId ? String(dbProductId) : ALL_DB_PRODUCTS);
    }, [active, categoryId, dbProductId]);

    const hasFilters = localActive !== 'all' || localCategory !== ALL_CATEGORIES || localDbProductId !== ALL_DB_PRODUCTS;


    const apply = () => {
        onApply({
            active: localActive,
            category: localCategory !== ALL_CATEGORIES ? Number(localCategory) : null,
            dbProductId: localDbProductId !== ALL_DB_PRODUCTS ? Number(localDbProductId) : null,
        });
        closeFilters?.();
    };

    const reset = () => {
        setLocalActive('all');
        setLocalCategory(ALL_CATEGORIES);
        setLocalDbProductId(ALL_DB_PRODUCTS);
        onApply({ active: 'all', category: null, dbProductId: null });
        closeFilters?.();
    };

    const renderCategoryLabel = (category: ProductCategory) => {
        const depth = category.depth ?? 0;
        const prefix = depth > 0 ? `${' '.repeat(depth * 2)} ` : "";
        return `${prefix}${category.name}`;
    };

    const renderDbProductLabel = (dbProduct: { id: number; name: string }) => {
        return dbProduct.name;
    }

    return (
        <div className="w-full space-y-4 text-left ">
            <div className="space-y-2">
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

            <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('Database Product')}</p>
                <Select value={localDbProductId} onValueChange={setLocalDbProductId}>
                    <SelectTrigger>
                        <SelectValue placeholder={t('All database products')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_DB_PRODUCTS}>{t('All database products')}</SelectItem>
                        {(dbProducts || []).map((dbProduct) => (
                            <SelectItem key={dbProduct.id} value={String(dbProduct.id)}>
                                {renderDbProductLabel(dbProduct)}
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