import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, GripVertical, EditIcon, TrashIcon, Loader2Icon } from 'lucide-react';
import { RenderItemProps } from '@/components/sortable-tree';
import { ReactNode } from 'react';
import { Link } from '@inertiajs/react';

interface SortableTreeItemProps<T> {
    props: RenderItemProps<T>;
    displayName?: string | ((item: T) => string);
    hasChildren?: boolean | ((item: T) => boolean);
    isLoading?: boolean;
    onEdit?: (item: T) => void;
    onDelete?: (item: T) => void;
    canEdit?: boolean;
    canDelete?: boolean;
    extraContent?: (item: T) => ReactNode;
    highlightCondition?: (item: T) => boolean;
    /** Rend le nom cliquable comme un lien Inertia */
    nameHref?: string | ((item: T) => string);
}

export function SortableTreeItem<T extends { id: number; name?: string }>({
    props,
    displayName,
    hasChildren,
    isLoading = false,
    onEdit,
    onDelete,
    canEdit = true,
    canDelete = true,
    extraContent,
    highlightCondition,
    nameHref,
}: SortableTreeItemProps<T>) {
    const {
        item,
        depth,
        isExpanded,
        toggleExpand,
        isDragging,
        guideContinuations,
        isInsideTarget,
        isOver,
        setNodeRef,
        attributes,
        listeners,
    } = props;

    const hasValidId = !!item && typeof item.id === 'number' && Number.isFinite(item.id);

    const name = typeof displayName === 'function'
        ? displayName(item)
        : displayName || (item as any)?.name || '(sans nom)';

    const showChildren = typeof hasChildren === 'function'
        ? hasChildren(item)
        : hasChildren ?? false;

    const isHighlighted = highlightCondition?.(item) ?? false;

    const resolvedHref = typeof nameHref === 'function' ? nameHref(item) : nameHref;

    return (
        <div
            ref={setNodeRef}
            className={[
                'relative flex items-center gap-2 px-3 py-2 text-sm',
                'border-b border-border/30 transition-colors',
                !isDragging ? 'hover:bg-muted/50' : '',
                isOver ? 'bg-muted/20' : '',
                isInsideTarget ? 'bg-primary/10 ring-2 ring-primary/50 ring-offset-1' : '',
                isDragging ? 'opacity-50' : '',
                isHighlighted ? 'bg-muted' : '',
            ].join(' ')}
            style={{
                marginLeft: depth * 24,
            }}
        >
            {/* Lignes guides indentation */}
            {depth > 0 && (
                <div className="pointer-events-none absolute inset-y-0" aria-hidden style={{ left: -(depth * 24) }}>
                    {Array.from({ length: depth }).map((_, level) => {
                        const continues = guideContinuations[level] ?? false;

                        return (
                            <span
                                key={`guide-${item.id}-${level}`}
                                className="absolute w-px bg-emerald-600/30 dark:bg-emerald-400/35"
                                style={{
                                    left: level * 24 + 10.5,
                                    top: -1,
                                    height: continues ? 'calc(100% + 2px)' : 'calc(50% + 1px)',
                                }}
                            />
                        );
                    })}
                    <span
                        className="absolute h-px bg-emerald-600/30 dark:bg-emerald-400/35"
                        style={{ left: (depth - 1) * 24 + 10.5, top: '50%', width: 13 }}
                    />
                    <span
                        className="absolute size-1 rounded-full bg-emerald-600/40 dark:bg-emerald-400/45"
                        style={{ left: depth * 24 + 8, top: 'calc(50% - 3px)' }}
                    />
                </div>
            )}

            {/* Bouton expand/collapse */}
            <div className="h-6 w-6">
                {!isDragging && showChildren && (
                    <button
                        type="button"
                        onClick={toggleExpand}
                        className="h-full w-full flex items-center justify-center rounded hover:bg-muted flex-shrink-0"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                    >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                )}
            </div>

            {/* Poignée de drag */}
            <div
                {...listeners}
                {...attributes}
                className="flex h-6 w-6 items-center justify-center text-muted-foreground cursor-grab flex-shrink-0"
                aria-label="Drag"
            >
                <GripVertical size={14} />
            </div>

            {/* Nom + loader */}
            {resolvedHref ? (
                <Link href={resolvedHref} className="truncate font-medium flex-1 flex items-center gap-2 hover:underline">
                    {name}
                    {isLoading && <Loader2Icon size={15} className="animate-spin" />}
                </Link>
            ) : (
                <span className="truncate font-medium flex-1 flex items-center gap-2">
                    {name}
                    {isLoading && <Loader2Icon size={15} className="animate-spin" />}
                </span>
            )}

            {/* Contenu extra (optionnel) */}
            {extraContent?.(item)}

            {/* Actions */}
            <div className="flex gap-2 justify-end flex-shrink-0">
                {hasValidId && !isDragging && (
                    <>
                        {canEdit && onEdit && (
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(item);
                                }}
                            >
                                <EditIcon size={16} />
                            </Button>
                        )}
                        {canDelete && onDelete && (
                            <Button
                                size="icon"
                                variant="destructive-outline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(item);
                                }}
                            >
                                <TrashIcon size={16} />
                            </Button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
