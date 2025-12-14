import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragOverEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { EditIcon, TrashIcon, GripVertical, SaveIcon, Loader2Icon } from 'lucide-react';
import { Link, router, InfiniteScroll } from '@inertiajs/react';
import categoryProducts from '@/routes/category-products';
import { ProductCategory, PaginatedCollection } from '@/types';
import { DraggableCategoryRow } from './draggable-category-row';
import { toast } from 'sonner';

type Props = {
    collection: PaginatedCollection<ProductCategory>;
    children?: ProductCategory[];
};

export function DraggableCategoriesTable({ collection, children = [] }: Props) {
    const MAX_DEPTH = 3;
    const EXPAND_ON_HOVER_MS = 700;
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [overId, setOverId] = useState<number | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
    const [loadedIds, setLoadedIds] = useState<Set<number>>(new Set());
    const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
    const [hoverExpandTimer, setHoverExpandTimer] = useState<number | null>(null);
    const [hoverTargetId, setHoverTargetId] = useState<number | null>(null);
    // State simplifié pour compatibilité avec InfiniteScroll
    // (Retiré) persistance pagination enfants pour revenir au comportement initial

    // Mettre à jour les catégories quand de nouvelles données arrivent
    useEffect(() => {
        const collectionData = Array.isArray(collection.data) ? collection.data : [];
        const childrenData = Array.isArray(children) ? children : [];

        // Vérifier quels IDs sont nouveaux
        const newIds = new Set<number>();
        [...collectionData, ...childrenData].forEach(cat => {
            if (!loadedIds.has(cat.id)) {
                newIds.add(cat.id);
            }
        });

        // Ne mettre à jour que si on a de nouveaux IDs
        if (newIds.size > 0) {
            setCategories(prev => {
                const allCategories = [...prev, ...collectionData, ...childrenData];
                const uniqueCategories = Array.from(
                    new Map(allCategories.map(cat => [cat.id, cat])).values()
                );
                return uniqueCategories;
            });
            setLoadedIds(prev => new Set([...prev, ...newIds]));
        }
    }, [collection.data, children]);

    // Charger l'état d'ouverture des parents depuis localStorage au montage
    useEffect(() => {
        try {
            const raw = window.localStorage.getItem('category-expanded-ids');
            if (raw) {
                const arr = JSON.parse(raw) as number[];
                if (Array.isArray(arr) && arr.length) {
                    setExpandedIds(new Set(arr));
                }
            }
        } catch { }
    }, []);

    // Sauvegarder l'état d'ouverture des parents à chaque changement
    useEffect(() => {
        try {
            window.localStorage.setItem('category-expanded-ids', JSON.stringify(Array.from(expandedIds)));
        } catch { }
    }, [expandedIds]);

    // Restaurer les enfants pour tous les parents ouverts dès que catégories ou expandedIds changent
    useEffect(() => {
        const fetchChildrenForExpanded = async () => {
            const parentIds = Array.from(expandedIds);
            for (const pid of parentIds) {
                // Ne pas recharger si on a déjà des enfants de ce parent
                const hasAnyChildLoaded = categories.some(c => c.parent_id === pid);
                if (hasAnyChildLoaded) continue;
                try {
                    // Marquer le parent comme en cours de chargement (affiche Loader2Icon dès l'ouverture/refresh)
                    setLoadingIds(prev => {
                        const next = new Set(prev);
                        next.add(pid);
                        return next;
                    });
                    const response = await fetch(`/category-products/children?parent_id=${pid}`, {
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                    });
                    const payload = await response.json();
                    const childrenData = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
                    setCategories(prev => {
                        const existingIds = new Set(prev.map(c => c.id));
                        const parent = prev.find(c => c.id === pid)
                            || (Array.isArray(collection.data) ? (collection.data as ProductCategory[]).find(c => c.id === pid) : undefined);
                        const parentDepth = parent?.depth ?? 0;
                        const newChildren = (childrenData as ProductCategory[])
                            .filter((c: ProductCategory) => !existingIds.has(c.id))
                            .map((c: ProductCategory) => ({ ...c, parent_id: pid, depth: (c.depth ?? (parentDepth + 1)) }));
                        const parentIndex = prev.findIndex(c => c.id === pid);
                        if (parentIndex === -1) {
                            // Ajouter le parent avant d'insérer les enfants
                            const withParent = parent ? [...prev, parent] : prev;
                            const newParentIndex = withParent.findIndex(c => c.id === pid);
                            return newParentIndex === -1
                                ? withParent
                                : [...withParent.slice(0, newParentIndex + 1), ...newChildren, ...withParent.slice(newParentIndex + 1)];
                        }
                        return [...prev.slice(0, parentIndex + 1), ...newChildren, ...prev.slice(parentIndex + 1)];
                    });
                } catch (e) {
                    console.warn('Failed to restore children for expanded parent', pid, e);
                } finally {
                    // Retirer l'état de chargement pour ce parent
                    setLoadingIds(prev => {
                        const next = new Set(prev);
                        next.delete(pid);
                        return next;
                    });
                }
            }
        };
        if (expandedIds.size > 0) {
            fetchChildrenForExpanded();
        }
    }, [expandedIds, categories, collection.data]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as number);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const currentOverId = event.over?.id as number | null;
        setOverId(currentOverId);

        // Expand on hover after a delay to allow nesting
        if (currentOverId != null) {
            if (hoverTargetId !== currentOverId) {
                if (hoverExpandTimer) {
                    window.clearTimeout(hoverExpandTimer);
                    setHoverExpandTimer(null);
                }
                setHoverTargetId(currentOverId);
                const t = window.setTimeout(() => {
                    // Si non expanded, ouvrir pour autoriser le drop "dans"
                    if (!expandedIds.has(currentOverId) && !loadingIds.has(currentOverId)) {
                        toggleExpand(currentOverId);
                    }
                }, EXPAND_ON_HOVER_MS);
                setHoverExpandTimer(t);
            }
        } else {
            if (hoverExpandTimer) {
                window.clearTimeout(hoverExpandTimer);
                setHoverExpandTimer(null);
            }
            setHoverTargetId(null);
        }
    };


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setOverId(null);
        // Nettoyer le timer d'expansion au survol
        if (hoverExpandTimer) {
            window.clearTimeout(hoverExpandTimer);
            setHoverExpandTimer(null);
        }
        setHoverTargetId(null);


        if (!over || active.id === over.id) return;

        const activeItem = categories.find(cat => cat.id === active.id);
        const overItem = categories.find(cat => cat.id === over.id);

        if (!activeItem || !overItem) return;

        const newCategories = [...categories];
        const activeIndex = newCategories.findIndex(cat => cat.id === active.id);
        const overIndex = newCategories.findIndex(cat => cat.id === over.id);

        // Cas 1: si on survole une catégorie expandée, on dépose DANS cette catégorie (nesting)
        if (expandedIds.has(overItem.id)) {
            const targetParentId = overItem.id;
            const targetParentDepth = overItem.depth ?? 0;
            const nextDepth = targetParentDepth + 1;
            if (nextDepth > MAX_DEPTH) {
                toast.warning(`Profondeur maximale (${MAX_DEPTH}) atteinte`);
                return;
            }
            activeItem.parent_id = targetParentId;
            activeItem.depth = nextDepth;
            // Réorganiser: insérer juste après le parent cible
            newCategories.splice(activeIndex, 1);
            const parentIndexForInsert = newCategories.findIndex(c => c.id === targetParentId);
            const insertIndex = parentIndexForInsert >= 0 ? (parentIndexForInsert + 1) : overIndex;
            newCategories.splice(insertIndex, 0, activeItem);
        } else {
            // Cas 2: réordonnancement parmi les siblings du même niveau que l'élément survolé
            const siblingsParentId = overItem.parent_id ?? null;
            const parentDepth = siblingsParentId == null
                ? -1
                : (newCategories.find(c => c.id === siblingsParentId)?.depth ?? 0);
            activeItem.parent_id = siblingsParentId;
            activeItem.depth = (siblingsParentId == null ? 0 : parentDepth + 1);
            if (activeItem.depth > MAX_DEPTH) {
                toast.warning(`Profondeur maximale (${MAX_DEPTH}) atteinte`);
                return;
            }
            // Retirer l'actif et insérer à la position de survol pour un ordre intuitif
            newCategories.splice(activeIndex, 1);
            const insertIndex = newCategories.findIndex(c => c.id === overItem.id);
            newCategories.splice(insertIndex, 0, activeItem);
        }

        setCategories(newCategories);
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/category-products/reorder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    items: categories.map(cat => ({
                        id: cat.id,
                        parent_id: cat.parent_id,
                    })),
                }),
            });

            toast.success('Hiérarchie sauvegardée avec succès');
            setHasChanges(false);
            // Recharger la page pour voir les changements
            window.location.reload();
        } catch (error) {
            toast.error('Erreur lors de la sauvegarde');
            console.error(error);
            setSaving(false);
        }
    };

    const activeCategory = activeId ? categories.find(cat => cat.id === activeId) : null;
    // Si la cible est expandée, l'indication de drop montre la cible elle-même
    const effectiveOverId = overId
        ? (expandedIds.has(overId)
            ? overId
            : (categories.find(c => c.id === overId)?.parent_id ?? overId))
        : null;

    // Filtrer les catégories visibles (racines + enfants des catégories expandées)
    const visibleCategories = (Array.isArray(categories) ? categories : []).filter(cat => {
        if (cat.parent_id === null) return true;
        return cat.parent_id !== null && cat.parent_id !== undefined && expandedIds.has(cat.parent_id);
    });

    // Calculer l'index d'insertion pour le fantôme (placeholder) unique
    const dropTargetIndex = (() => {
        if (!activeId || !overId) return null;
        const overItem = visibleCategories.find(c => c.id === overId);
        if (!overItem) return null;
        if (expandedIds.has(overItem.id)) {
            const parentIndex = visibleCategories.findIndex(c => c.id === overItem.id);
            return parentIndex >= 0 ? parentIndex + 1 : null;
        } else {
            return visibleCategories.findIndex(c => c.id === overItem.id);
        }
    })();

    const toggleExpand = async (categoryId: number) => {
        const isCurrentlyExpanded = expandedIds.has(categoryId);

        if (isCurrentlyExpanded) {
            // Si déjà expandé, on ferme simplement
            setExpandedIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(categoryId);
                return newSet;
            });
        } else {
            // Si fermé, vérifier si les enfants existent déjà en mémoire
            const hasChildrenInDom = categories.some(c => c.parent_id === categoryId);
            if (hasChildrenInDom) {
                // Les enfants sont déjà présents: éviter un nouveau fetch, juste marquer expandé
                setExpandedIds(prev => {
                    const newSet = new Set(prev);
                    newSet.add(categoryId);
                    return newSet;
                });
                return;
            }
            // Sinon, charger les enfants via fetch
            try {
                setLoadingIds(prev => {
                    const next = new Set(prev);
                    next.add(categoryId);
                    return next;
                });
                const response = await fetch(`/category-products/children?parent_id=${categoryId}`, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });
                const payload = await response.json();
                const childrenData = Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);

                // Insérer les enfants directement sous le parent dans la liste
                setCategories(prev => {
                    // Filtrer pour éviter les doublons existants
                    const existingIds = new Set(prev.map(c => c.id));
                    const parent = prev.find(c => c.id === categoryId);
                    const parentDepth = parent?.depth ?? 0;
                    const newChildren = (childrenData as ProductCategory[])
                        .filter((c: ProductCategory) => !existingIds.has(c.id))
                        .map((c: ProductCategory) => ({
                            ...c,
                            parent_id: categoryId,
                            depth: (c.depth ?? (parentDepth + 1)),
                        }));

                    // Trouver l'index du parent dans la liste visible
                    const parentIndex = prev.findIndex(c => c.id === categoryId);
                    if (parentIndex === -1) {
                        // Si le parent n'est pas trouvé, fallback à append (ne devrait pas arriver)
                        return Array.from(new Map([...prev, ...newChildren].map(cat => [cat.id, cat])).values());
                    }

                    // Construire la nouvelle liste en insérant juste après le parent
                    const before = prev.slice(0, parentIndex + 1);
                    const after = prev.slice(parentIndex + 1);
                    return [...before, ...newChildren, ...after];
                });

                // Marquer comme expandé
                setExpandedIds(prev => {
                    const newSet = new Set(prev);
                    newSet.add(categoryId);
                    return newSet;
                });

                // Ajouter les IDs aux loadedIds
                setLoadedIds(prev => {
                    const newIds = new Set(prev);
                    childrenData.forEach((child: ProductCategory) => newIds.add(child.id));
                    return newIds;
                });

                // (Retiré) mise à jour pagination enfants pour compatibilité InfinityScroll
            } catch (error) {
                console.error('Error loading children:', error);
                toast.error('Erreur lors du chargement des sous-catégories');
            } finally {
                setLoadingIds(prev => {
                    const next = new Set(prev);
                    next.delete(categoryId);
                    return next;
                });
            }
        }
    };

    // (Retiré) loadMoreChildren pour revenir à l’implémentation initiale sans pagination enfants

    return (
        <div>
            {hasChanges && (
                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center justify-between">
                    <p className="text-sm">Vous avez des modifications non sauvegardées</p>
                    <Button onClick={handleSave} disabled={saving}>
                        <SaveIcon size={16} className="mr-2" />
                        {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </Button>
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <InfiniteScroll data="collection">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>ID</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="text-end">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <SortableContext items={visibleCategories.map(cat => cat.id)} strategy={verticalListSortingStrategy}>
                                {visibleCategories.map((category, idx) => {
                                    const row = (
                                        <DraggableCategoryRow
                                            key={category.id}
                                            category={category}
                                            isOver={effectiveOverId === category.id}
                                            isOverInto={overId != null && expandedIds.has(overId) && overId === category.id}
                                            isActive={activeId === category.id}
                                            hasChildren={category.has_children || false}
                                            isExpanded={expandedIds.has(category.id)}
                                            onToggleExpand={toggleExpand}
                                            // Le loader ne doit apparaître que lorsqu'un chargement est réellement en cours
                                            // Utiliser uniquement loadingIds pour éviter les faux positifs quand les enfants sont déjà dans le DOM
                                            isLoadingChildren={loadingIds.has(category.id)}
                                            isChildVisible={category.parent_id != null && expandedIds.has(category.parent_id)}
                                        />
                                    );
                                    const shouldRenderPlaceholder = activeId != null && dropTargetIndex === idx;
                                    const overItem = category;
                                    const targetDepth = expandedIds.has(overItem.id)
                                        ? ((overItem.depth ?? 0) + 1)
                                        : (overItem.depth ?? 0);
                                    return shouldRenderPlaceholder ? (
                                        <>
                                            <TableRow key={`placeholder-${category.id}`} className={[`depth-${targetDepth}`, 'h-7 bg-primary/5'].join(' ')}>
                                                <TableCell colSpan={4} className="py-0 text-xs">
                                                    <div className="mx-2 my-1 flex items-center gap-2 text-muted-foreground">
                                                        {/* Indentation tabs matching target depth */}
                                                        <div className="flex items-center" aria-hidden>
                                                            {Array.from({ length: Math.max(0, targetDepth) }).map((_, i) => (
                                                                <span key={i} className="w-6 h-6 mr-1 border-muted-foreground/40" />
                                                            ))}
                                                        </div>
                                                        {/* Elbow connector when depth > 0 */}
                                                        {targetDepth > 0 && (
                                                            <span className="w-4 h-4 mr-1 relative" aria-hidden>
                                                                <svg viewBox="0 0 8 8" className="absolute inset-0 text-muted-foreground/60" width="16" height="16">
                                                                    <path d="M1 0 v7 h7" fill="none" stroke="currentColor" strokeWidth="1" />
                                                                </svg>
                                                            </span>
                                                        )}
                                                        {/* Dashed ghost box to indicate exact position */}
                                                        <div className="px-2 py-1 border border-dashed border-primary/60 rounded bg-primary/5 flex items-center gap-2">
                                                            <span className="text-primary/70">◇</span>
                                                            <span className="opacity-80">Emplacement de dépôt</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {row}
                                        </>
                                    ) : row;
                                })}
                            </SortableContext>
                        </TableBody>
                    </Table>
                </InfiniteScroll>

                {collection.meta && collection.meta.current_page < collection.meta.last_page && (
                    <div className="w-full h-50 flex items-center justify-center mt-4">
                        <Loader2Icon size={50} className="animate-spin text-main-purple dark:text-main-green" />
                    </div>
                )}

                {/* <DragOverlay>
                    {activeCategory && (
                        <div className="pointer-events-none select-none px-3 py-2 rounded border bg-muted text-foreground/90 opacity-80 text-sm">
                            {effectiveOverId
                                ? (
                                    <span>
                                        Déposer en dessous de <strong>{categories.find(c => c.id === effectiveOverId)?.name}</strong>
                                    </span>
                                )
                                : (
                                    <span>{activeCategory.name}</span>
                                )
                            }
                        </div>
                    )}
                </DragOverlay> */}
            </DndContext>
        </div>
    );
}
