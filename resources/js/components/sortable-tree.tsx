import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type Id = number | string;
type ItemKey<T> = keyof T & string;

export type RenderItemProps<T> = {
    item: T;
    depth: number;
    isExpanded: boolean;
    isLoading: boolean;
    isDragging: boolean;

    // UX drag (on conserve pour l'inside si tu veux un highlight)
    isOver: boolean;
    insertLine: 'before' | 'after' | null; // gardé mais tu ne l'affiches plus
    isInsideTarget: boolean;

    setNodeRef: (el: HTMLElement | null) => void;
    attributes: any;
    listeners: any;
    toggleExpand: () => void;
};

export type SortableTreeProps<T extends Record<string, any>> = {
    items: T[];
    idKey?: ItemKey<T>;
    parentKey?: ItemKey<T>;
    depthKey?: ItemKey<T>;
    maxDepth?: number;

    insideDelayMs?: number;
    edgeRatio?: number;
    expandOnInside?: boolean;

    hasChildren?: (item: T, all: T[]) => boolean;
    loadChildren?: (item: T) => Promise<T[]>;

    onChange?: (next: T[], reason?: 'drag' | 'expand' | 'collapse') => void;
    renderItem: (props: RenderItemProps<T>) => React.ReactNode;
};

type DropIntent =
    | { type: 'between'; overId: Id; where: 'before' | 'after' }
    | { type: 'inside'; overId: Id }
    | null;

function getField<T extends Record<string, any>, R = any>(obj: T, key: ItemKey<T>, fallback?: R): R {
    const v = obj[key];
    return (v as unknown as R) ?? (fallback as R);
}

function setField<T extends Record<string, any>>(obj: T, key: ItemKey<T>, value: any): T {
    const result = Object.assign({}, obj as any);
    result[key as string] = value;
    return result as T;
}

function useKeys<T extends Record<string, any>>(props: SortableTreeProps<T>) {
    const idKey = props.idKey ?? ('id' as ItemKey<T>);
    const parentKey = props.parentKey ?? ('parent_id' as ItemKey<T>);
    const depthKey = props.depthKey ?? ('depth' as ItemKey<T>);
    return { idKey, parentKey, depthKey } as const;
}

function Row<T extends Record<string, any>>({
    item,
    sortableId,
    depth,
    isExpanded,
    isLoading,
    isOver,
    insertLine,
    isInsideTarget,
    toggleExpand,
    render,
}: {
    item: T;
    sortableId: Id;
    depth: number;
    isExpanded: boolean;
    isLoading: boolean;
    isOver: boolean;
    insertLine: 'before' | 'after' | null;
    isInsideTarget: boolean;
    toggleExpand: () => void;
    render: (ctx: RenderItemProps<T>) => React.ReactNode;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortableId });

    // ✅ clé UX: pendant le drag, on rend la "ligne" invisible mais elle garde sa place,
    // et le vrai "fantôme" est rendu via DragOverlay.
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        visibility: isDragging ? 'hidden' : 'visible',
    };

    return (
        <div ref={setNodeRef} style={style}>
            {render({
                item,
                depth,
                isExpanded,
                isLoading,
                isDragging,
                isOver,
                insertLine,
                isInsideTarget,
                setNodeRef,
                attributes,
                listeners,
                toggleExpand,
            })}
        </div>
    );
}

export default function SortableTree<T extends Record<string, any>>(props: SortableTreeProps<T>) {
    const { idKey, parentKey, depthKey } = useKeys(props);

    const maxDepth = props.maxDepth ?? 3;
    const insideDelayMs = props.insideDelayMs ?? 500;
    const edgeRatio = props.edgeRatio ?? 0.25;
    const expandOnInside = props.expandOnInside ?? true;

    const [items, setItems] = useState<T[]>([]);
    const [expanded, setExpanded] = useState<Set<Id>>(new Set());
    const [loading, setLoading] = useState<Set<Id>>(new Set());

    const [activeId, setActiveId] = useState<Id | null>(null);
    const [overId, setOverId] = useState<Id | null>(null);
    const [dropIntent, setDropIntent] = useState<DropIntent>(null);

    const insideTimerRef = useRef<number | null>(null);
    const clearInsideTimer = () => {
        if (insideTimerRef.current) {
            window.clearTimeout(insideTimerRef.current);
            insideTimerRef.current = null;
        }
    };

    // --- merge stable props.items + extras ---
    useEffect(() => {
        setItems((prev) => {
            const incoming = props.items ?? [];
            const incomingIds = new Set(incoming.map((x) => getField<T, Id>(x, idKey) as Id));
            const extras = prev.filter((x) => !incomingIds.has(getField<T, Id>(x, idKey) as Id));
            const merged = [...incoming, ...extras];
            return Array.from(new Map(merged.map((c) => [getField(c, idKey) as Id, c])).values());
        });
    }, [props.items, idKey]);

    const idMap = useMemo(
        () => new Map<Id, T>(items.map((x) => [getField<T, Id>(x, idKey) as Id, x])),
        [items, idKey],
    );

    const getId = (x: T) => getField<T, Id>(x, idKey) as Id;
    const getParent = (x: T) => getField<T, Id | null>(x, parentKey, null) as Id | null;
    const getDepth = (x: T) => getField<T, number>(x, depthKey, 0) as number;

    const canHaveChildren = (it: T) => {
        if (props.hasChildren) return props.hasChildren(it, items);
        const id = getId(it);
        return items.some((x) => getParent(x) === id);
    };

    // --- visibilité ---
    const isVisible = (it: T): boolean => {
        let pid = getParent(it);
        while (pid != null) {
            if (!expanded.has(pid)) return false;
            const p = idMap.get(pid);
            if (!p) break;
            pid = getParent(p);
        }
        return true;
    };
    const visible = useMemo(() => items.filter(isVisible), [items, expanded, idMap]);

    // --- expand/collapse + lazy-load ---
    const toggleExpand = async (id: Id) => {
        if (expanded.has(id)) {
            setExpanded((s) => {
                const n = new Set(s);
                n.delete(id);
                return n;
            });
            props.onChange?.(items, 'collapse');
            return;
        }

        setExpanded((s) => new Set(s).add(id));
        props.onChange?.(items, 'expand');

        if (items.some((x) => getParent(x) === id)) return;
        if (!props.loadChildren) return;

        setLoading((s) => new Set(s).add(id));
        try {
            const parent = idMap.get(id);
            if (!parent) return;

            const parentDepth = getDepth(parent);
            const children = await props.loadChildren(parent);

            setItems((prev) => {
                const existing = new Set(prev.map((p) => getId(p)));

                const normalized = children
                    .filter((c) => !existing.has(getId(c)))
                    .map((c) => {
                        const withParent = setField(c, parentKey, id);
                        const d = getField<T, number>(withParent, depthKey, NaN);
                        return Number.isFinite(d) ? withParent : setField(withParent, depthKey, parentDepth + 1);
                    });

                const idx = prev.findIndex((x) => getId(x) === id);
                if (idx === -1) return prev;

                return [...prev.slice(0, idx + 1), ...normalized, ...prev.slice(idx + 1)];
            });
        } finally {
            setLoading((s) => {
                const n = new Set(s);
                n.delete(id);
                return n;
            });
        }
    };

    // --- dnd sensors ---
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const onDragStart = (e: DragStartEvent) => {
        setActiveId(e.active.id as Id);
        setDropIntent(null);
        clearInsideTimer();
        // console.log('Drag started for id:', e.active.id);
    };

    const onDragOver = (e: DragOverEvent) => {
        // const over = e.over;
        // const oid = (over?.id as Id) ?? null;
        // console.log('Drag over id:', oid);

        // setOverId(oid);

        // if (!oid || !over) {
        //     setDropIntent(null);
        //     clearInsideTimer();
        //     return;
        // }

        // // Position du centre de l'élément dragué par rapport au survolé
        // const activeRect = e.active.rect.current.translated ?? e.active.rect.current.initial;

        // if (!activeRect || !over.rect) {
        //     setDropIntent({ type: 'between', overId: oid, where: 'before' });
        //     clearInsideTimer();
        //     return;
        // }

        // const activeCenterY = activeRect.top + activeRect.height / 2;
        // const top = over.rect.top;
        // const h = over.rect.height || 1;
        // const relativeY = activeCenterY - top;
        // const edge = h * edgeRatio;

        // console.log('📏 Position:', {
        //     relativeY,
        //     h,
        //     edge,
        //     zone: relativeY <= edge ? 'top' : relativeY >= h - edge ? 'bottom' : 'center'
        // });

        // if (relativeY <= edge) {
        //     console.log('➡️ Setting intent: BEFORE (top edge)');
        //     setDropIntent({ type: 'between', overId: oid, where: 'before' });
        //     clearInsideTimer();
        //     return;
        // }

        // if (relativeY >= h - edge) {
        //     console.log('➡️ Setting intent: AFTER (bottom edge)');
        //     setDropIntent({ type: 'between', overId: oid, where: 'after' });
        //     clearInsideTimer();
        //     return;
        // }

        // console.log('➡️ Setting intent: CENTER (will become inside after delay)');
        // setDropIntent({ type: 'between', overId: oid, where: 'after' });

        // clearInsideTimer();
        // insideTimerRef.current = window.setTimeout(() => {
        //     console.log('✨ Inside intent triggered for', oid);
        //     setDropIntent({ type: 'inside', overId: oid });
        //     if (expandOnInside) void toggleExpand(oid);
        // }, insideDelayMs) as unknown as number;
    };


    const onDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        // console.log('Drag ended. Active id:', active.id, 'Over id:', over?.id);

        clearInsideTimer();
        setActiveId(null);
        setOverId(null);

        if (!over || active.id === over.id) {
            setDropIntent(null);
            return;
        }

        const activeItem = idMap.get(active.id as Id);
        const overItem = idMap.get(over.id as Id);
        if (!activeItem || !overItem) {
            setDropIntent(null);
            return;
        }

        const overItemId = getId(overItem);

        const intent = dropIntent;
        const dropInside = intent?.type === 'inside' && intent.overId === overItemId;
        let betweenWhere = intent?.type === 'between' && intent.overId === overItemId ? intent.where : 'after';

        console.log('🔍 Drop intent:', { intent, dropInside, betweenWhere });

        const targetParentId: Id | null = dropInside ? overItemId : getParent(overItem);

        // collect subtree (flat list)
        const rootId = getId(activeItem);
        const start = items.findIndex((x) => getId(x) === rootId);
        if (start === -1) {
            setDropIntent(null);
            return;
        }

        const rootDepth = getDepth(items[start]);
        const subtreeIds: Id[] = [rootId];
        for (let i = start + 1; i < items.length; i++) {
            const d = getDepth(items[i]);
            if (d <= rootDepth) break;
            subtreeIds.push(getId(items[i]));
        }

        const movingSet = new Set(subtreeIds);
        const block: T[] = [];
        const remaining: T[] = [];
        for (const it of items) (movingSet.has(getId(it)) ? block : remaining).push(it);

        // compute depth shift
        const parentDepth = targetParentId == null ? -1 : getDepth(idMap.get(targetParentId) as T);
        const targetDepth = targetParentId == null ? 0 : parentDepth + 1;
        const delta = targetDepth - getDepth(activeItem);

        for (const n of block) {
            const nd = getDepth(n) + delta;
            if (nd < 0 || nd > maxDepth) {
                setDropIntent(null);
                return;
            }
        }

        const movedBlock: T[] = block.map((n) => {
            const newDepth = getDepth(n) + delta;
            const newParent = getId(n) === rootId ? targetParentId : getParent(n);
            return setField(setField(n, depthKey, newDepth), parentKey, newParent);
        });

        if (!dropInside) {
            const activeIdxInItems = items.findIndex((x) => getId(x) === rootId);
            const overIdxInItems = items.findIndex((x) => getId(x) === overItemId);
            if (activeIdxInItems > overIdxInItems) {
                betweenWhere = 'before';
            } else if (activeIdxInItems < overIdxInItems) {
                betweenWhere = 'after';
            }
        }

        const overIdx = remaining.findIndex((x) => getId(x) === overItemId);

        // console.log('📍 Insertion:', {
        //     overIdx,
        //     dropInside,
        //     betweenWhere,
        //     remainingIds: remaining.map(x => getId(x)),
        //     movingIds: movedBlock.map(x => getId(x))
        // });

        if (dropInside) {
            const parentIdx = overIdx;
            const insertAt = parentIdx === -1 ? remaining.length : parentIdx + 1;
            remaining.splice(insertAt, 0, ...movedBlock);

            if (targetParentId != null && !expanded.has(targetParentId)) {
                setExpanded((s) => new Set(s).add(targetParentId));
            }
        } else {
            if (overIdx === -1) {
                remaining.push(...movedBlock);
            } else if (betweenWhere === 'before') {
                console.log('✅ Inserting BEFORE at index:', overIdx);
                remaining.splice(overIdx, 0, ...movedBlock);
            } else {
                // Correction : insérer juste après l'élément survolé
                console.log('✅ Inserting AFTER at index:', overIdx + 1);
                remaining.splice(overIdx + 1, 0, ...movedBlock);
            }
        }

        console.log('📦 Final order:', remaining.map(x => getId(x)));

        const next = remaining;
        setItems(next);
        props.onChange?.(next, 'drag');

        setDropIntent(null);
    };

    useEffect(() => {
        return () => clearInsideTimer();
    }, []);

    const activeItem = activeId != null ? idMap.get(activeId) : null;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
        >
            <SortableContext items={visible.map((x) => getId(x))} strategy={verticalListSortingStrategy}>
                <div>
                    {visible.map((it) => {
                        const id = getId(it);
                        const depth = getDepth(it);

                        const isExpanded = expanded.has(id);
                        const isLoading = loading.has(id);
                        const isOver = !!activeId && overId === id;

                        const insertLine =
                            !!activeId && dropIntent?.type === 'between' && dropIntent.overId === id ? dropIntent.where : null;

                        const isInsideTarget =
                            !!activeId && dropIntent?.type === 'inside' && dropIntent.overId === id;

                        return (
                            <Row<T>
                                key={String(id)}
                                item={it}
                                sortableId={id}
                                depth={depth}
                                isExpanded={isExpanded}
                                isLoading={isLoading}
                                isOver={isOver}
                                insertLine={insertLine}
                                isInsideTarget={isInsideTarget}
                                toggleExpand={() => void toggleExpand(id)}
                                render={props.renderItem}
                            />
                        );
                    })}
                </div>
            </SortableContext>

            {/* ✅ Le seul "fantôme" visible : DragOverlay */}
            <DragOverlay>
                {activeItem ? (
                    props.renderItem({
                        item: activeItem,
                        depth: getDepth(activeItem),
                        isExpanded: false,
                        isLoading: false,
                        isDragging: true,
                        isOver: false,
                        insertLine: null,
                        isInsideTarget: false,
                        setNodeRef: () => { },
                        attributes: {},
                        listeners: {},
                        toggleExpand: () => { },
                    })
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
