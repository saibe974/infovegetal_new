import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
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

    // UX drag
    isOver: boolean; // over (any zone)
    insertLine: 'before' | 'after' | null; // ✅ ligne d’insertion
    isInsideTarget: boolean; // ✅ surbrillance “inside” après délai

    setNodeRef: (el: HTMLElement | null) => void;
    attributes: any;
    listeners: any;
    toggleExpand: () => void;
};

export type SortableTreeProps<T extends Record<string, any>> = {
    // Données plates (structure brute du serveur)
    items: T[];
    idKey?: ItemKey<T>; // default: 'id'
    parentKey?: ItemKey<T>; // default: 'parent_id'
    depthKey?: ItemKey<T>; // default: 'depth'
    maxDepth?: number; // default: 3

    // intent tuning
    insideDelayMs?: number; // default: 500
    edgeRatio?: number; // default: 0.25 (top/bottom zones => between)
    expandOnInside?: boolean; // default: true (auto-open when inside intent triggers)

    hasChildren?: (item: T, all: T[]) => boolean; // "ouvrable"
    loadChildren?: (item: T) => Promise<T[]>;

    // Callback quand l'arbre change (retourne données plates + raison)
    onChange?: (next: T[], reason?: 'drag' | 'expand' | 'collapse') => void;

    // Rendu personnalisé de chaque item
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
    // Utiliser Object.assign pour préserver toutes les propriétés
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

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
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

        // open immediately
        setExpanded((s) => new Set(s).add(id));
        props.onChange?.(items, 'expand');

        // already have children loaded
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
    };

    const onDragOver = (e: DragOverEvent) => {
        const over = e.over;
        const oid = (over?.id as Id) ?? null;

        setOverId(oid);

        if (!oid || !over) {
            setDropIntent(null);
            clearInsideTimer();
            return;
        }

        // Determine pointer Y within the item rect -> before/after/center
        const pe = e.activatorEvent as MouseEvent | PointerEvent | undefined;
        const clientY = pe && 'clientY' in pe ? pe.clientY : null;

        // fallback = after
        if (clientY == null || !over.rect) {
            setDropIntent({ type: 'between', overId: oid, where: 'after' });
            clearInsideTimer();
            return;
        }

        const top = over.rect.top;
        const h = over.rect.height || 1;
        const y = clientY - top;
        const edge = h * edgeRatio;

        if (y <= edge) {
            setDropIntent({ type: 'between', overId: oid, where: 'before' });
            clearInsideTimer();
            return;
        }

        if (y >= h - edge) {
            setDropIntent({ type: 'between', overId: oid, where: 'after' });
            clearInsideTimer();
            return;
        }

        // center zone -> after short delay become "inside"
        setDropIntent({ type: 'between', overId: oid, where: 'after' });

        clearInsideTimer();
        insideTimerRef.current = window.setTimeout(() => {
            setDropIntent({ type: 'inside', overId: oid });
            if (expandOnInside) void toggleExpand(oid);
        }, insideDelayMs) as unknown as number;
    };

    const onDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;

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
        const betweenWhere =
            intent?.type === 'between' && intent.overId === overItemId ? intent.where : 'after';

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

        // depth guard
        for (const n of block) {
            const nd = getDepth(n) + delta;
            if (nd < 0 || nd > maxDepth) {
                setDropIntent(null);
                return;
            }
        }

        // apply move (no mutation)
        const movedBlock: T[] = block.map((n) => {
            const newDepth = getDepth(n) + delta;
            const newParent = getId(n) === rootId ? targetParentId : getParent(n);
            const updated = setField(setField(n, depthKey, newDepth), parentKey, newParent);
            console.log('Updating item:', {
                original: n,
                updated,
                newDepth,
                newParent,
            });
            return updated;
        });

        // insert index
        const overIdx = remaining.findIndex((x) => getId(x) === overItemId);

        if (dropInside) {
            // insert right after the parent row
            const parentIdx = overIdx;
            const insertAt = parentIdx === -1 ? remaining.length : parentIdx + 1;
            remaining.splice(insertAt, 0, ...movedBlock);
            if (targetParentId != null && !expanded.has(targetParentId)) setExpanded((s) => new Set(s).add(targetParentId));
        } else {
            // between: before => at overIdx, after => overIdx + 1
            const base = overIdx === -1 ? remaining.length : overIdx;
            const insertAt = betweenWhere === 'before' ? base : base + 1;
            remaining.splice(insertAt, 0, ...movedBlock);
        }

        const next = remaining;
        setItems(next);
        props.onChange?.(next, 'drag');

        setDropIntent(null);
    };

    useEffect(() => {
        return () => clearInsideTimer();
    }, []);

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
        </DndContext>
    );
}