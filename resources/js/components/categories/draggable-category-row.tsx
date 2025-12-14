import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EditIcon, TrashIcon, GripVertical, ChevronRight, ChevronDown, Loader2Icon } from 'lucide-react';
import { Link } from '@inertiajs/react';
import categoryProducts from '@/routes/category-products';
import { ProductCategory } from '@/types';

type Props = {
    category: ProductCategory;
    isOver?: boolean;
    isOverInto?: boolean;
    isActive?: boolean;
    hasChildren?: boolean;
    isExpanded?: boolean;
    onToggleExpand?: (categoryId: number) => void;
    isLoadingChildren?: boolean;
    isChildVisible?: boolean;
};

export function DraggableCategoryRow({
    category,
    isOver = false,
    isOverInto = false,
    isActive = false,
    hasChildren = false,
    isExpanded = false,
    onToggleExpand,
    isLoadingChildren = false,
    isChildVisible = false,
}: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <>
            <TableRow
                ref={setNodeRef}
                style={style}
                className={[
                    isOverInto && !isActive ? 'bg-primary/10 ring-1 ring-primary/40' : '',
                    !isOverInto && isOver && !isActive ? 'bg-accent/50 border-l-4 border-l-primary' : '',
                    (category.depth || 0) > 0 ? 'bg-muted/30' : '',
                    `depth-${category.depth ?? 0}`,
                    isChildVisible ? 'transition-all duration-200 ease-out' : '',
                ].filter(Boolean).join(' ')}
                data-depth={category.depth ?? 0}
            >
                <TableCell>
                    <button
                        className="cursor-grab active:cursor-grabbing hover:bg-accent rounded p-1"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical size={16} className="text-muted-foreground" />
                    </button>
                </TableCell>
                <TableCell>{category.id}</TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        {/* Tree connectors: vertical guides per depth */}
                        <div className="flex items-center" aria-hidden>
                            {Array.from({ length: Math.max(0, category.depth || 0) }).map((_, i) => (
                                <span
                                    key={i}
                                    className="w-6 h-6 mr-1 border-muted-foreground/40"
                                />
                            ))}
                        </div>
                        {/* Elbow connector before label when depth > 0 */}
                        {((category.depth || 0) > 0) && (
                            <span className="w-4 h-4 mr-1 relative" aria-hidden>
                                <svg viewBox="0 0 8 8" className="absolute inset-0 text-muted-foreground/60" width="16" height="16">
                                    <path d="M1 0 v7 h7" fill="none" stroke="currentColor" strokeWidth="1" />
                                </svg>
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            {/* Removed explicit level badge for cleaner UI */}
                            <Link href={categoryProducts.edit(category.id)} className="hover:underline">
                                {category.name}
                            </Link>
                            {hasChildren && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onToggleExpand?.(category.id);
                                    }}
                                    className="hover:bg-accent rounded p-0.5 transition-transform duration-200 ease-in-out"
                                    aria-expanded={isExpanded}
                                >
                                    {isLoadingChildren ? (
                                        <Loader2Icon size={14 + Math.min(6, (category.depth || 0) * 2)} className="animate-spin text-muted-foreground" />
                                    ) : isExpanded ? (
                                        <ChevronDown size={14 + Math.min(6, (category.depth || 0) * 2)} className="text-muted-foreground transition-transform duration-200 ease-in-out" />
                                    ) : (
                                        <ChevronRight size={14 + Math.min(6, (category.depth || 0) * 2)} className="text-muted-foreground transition-transform duration-200 ease-in-out" />
                                    )}
                                </button>
                            )}
                        </span>
                    </div>
                </TableCell>
                <TableCell>
                    <div className="flex gap-2 justify-end">
                        <Button asChild size="icon" variant="outline">
                            <Link href={categoryProducts.edit(category.id)}>
                                <EditIcon size={16} />
                            </Link>
                        </Button>
                        <Button asChild size="icon" variant="destructive-outline">
                            <Link
                                href={categoryProducts.destroy(category.id)}
                                onBefore={() => confirm('Are you sure?')}
                            >
                                <TrashIcon size={16} />
                            </Link>
                        </Button>
                    </div>
                </TableCell>
            </TableRow>
            {/* Les placeholders de hover/drag sont gérés au niveau du tableau pour n'afficher qu'un seul fantôme */}
        </>
    );
}
