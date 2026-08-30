import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ProductCategory } from '@/types';
import { ChevronDown } from 'lucide-react';

type Props = {
    categories: ProductCategory[];
    categoryOptions: number[];
    value: string;
    onChange: (value: string) => void;
    title?: string;
    allLabel?: string;
};

export const ALL_CATEGORIES = 'all';

export function CategoryAccordion({
    categories,
    categoryOptions,
    value,
    onChange,
    title,
    allLabel,
}: Props) {
    const { t } = useI18n();
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

    return (
        <>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title ?? t('Category')}</p>
            <div className="space-y-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'w-full justify-start rounded-md border border-input',
                        value === ALL_CATEGORIES ? 'bg-accent' : undefined,
                    )}
                    onClick={() => onChange(ALL_CATEGORIES)}
                >
                    {allLabel ?? t('All categories')}
                </Button>

                {rootCategories.map((parent) => {
                    const descendants = getDescendants(parent.id);
                    const hasChildren = descendants.length > 0;
                    const isSelected = value === String(parent.id);
                    const isBranchSelected = isCategoryInBranch(value, parent.id);
                    const parentLabel = parent.name.charAt(0).toUpperCase() + parent.name.slice(1);

                    if (!hasChildren) {
                        return (
                            <Button
                                key={parent.id}
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    'w-full justify-start rounded-md border border-input',
                                    isSelected ? 'bg-accent' : undefined,
                                )}
                                onClick={() => onChange(String(parent.id))}
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
                                        'group w-full justify-between rounded-md',
                                        isBranchSelected ? 'bg-accent' : undefined,
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
                                            'w-full justify-start font-medium',
                                            isSelected ? 'bg-accent' : undefined,
                                        )}
                                        onClick={() => onChange(String(parent.id))}
                                    >
                                        <span className="truncate">{parentLabel}</span>
                                    </Button>
                                    {descendants.map((child) => {
                                        const childSelected = value === String(child.id);
                                        const relativeDepth = Math.max(
                                            0,
                                            (child.depth ?? 0) - (parent.depth ?? 0) - 1,
                                        );

                                        return (
                                            <Button
                                                key={child.id}
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    'w-full justify-start',
                                                    childSelected ? 'bg-accent' : undefined,
                                                )}
                                                style={{ paddingLeft: `${0.75 + relativeDepth * 0.75}rem` }}
                                                onClick={() => onChange(String(child.id))}
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
    );
}