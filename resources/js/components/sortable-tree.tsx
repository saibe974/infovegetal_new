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
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export type Id = number | string;

type ItemKey<T> = keyof T & string;

export type MovePayload<T> = {
    id: Id;
    parentId: Id | null;
    beforeId: Id | null;
    afterId: Id | null;
    next: T[];
};

export type RenderItemProps<T> = {
    item: T;
    depth: number;
    isExpanded: boolean;
    isLoading: boolean;
    setNodeRef: (el: HTMLElement | null) => void;
    attributes: any;
    listeners: any;
    isDragging: boolean;
    toggleExpand: () => void;
};

export type SortableTreeProps<T extends Record<string, any>> = {
    items: T[];
    idKey?: ItemKey<T>; // default: 'id'
    parentKey?: ItemKey<T>; // default: 'parent_id'
    depthKey?: ItemKey<T>; // default: 'depth'
    maxDepth?: number; // default: 3
    expandOnHoverMs?: number; // default: 600 (during drag)
    expandOnHoverIdleMs?: number; // default: 600 (not dragging)
    enableIdleHoverExpand?: boolean; // default: true
    hasChildren?: (item: T, allItems: T[]) => boolean; // optional indicator
    loadChildren?: (item: T) => Promise<T[]>; // lazy fetch children
    onMove?: (move: MovePayload<T>) => void | Promise<void>;
    onChange?: (next: T[]) => void;
    autoSave?: boolean;
    renderItem: (props: RenderItemProps<T>) => React.ReactNode;
};

function getField<T extends Record<string, any>, R = any>(obj: T, key: ItemKey<T>, fallback?: R): R {
    const v = obj[key];
    return (v as unknown as R) ?? (fallback as R);
}

function setField<T extends Record<string, any>>(obj: T, key: ItemKey<T>, value: any): T {
    return { ...(obj as any), [key]: value } as T;
}

function useStableKeys<T extends Record<string, any>>(props: SortableTreeProps<T>) {
    const idKey = props.idKey ?? ('id' as ItemKey<T>);
    const parentKey = props.parentKey ?? ('parent_id' as ItemKey<T>);
    const depthKey = props.depthKey ?? ('depth' as ItemKey<T>);
    return { idKey, parentKey, depthKey } as const;
}

function NodeRow<T extends Record<string, any>>({
    item,
    sortableId,
    render,
    depth,
    isExpanded,
    isLoading,
}: {
    item: T;
    sortableId: Id;
    depth: number;
    isExpanded: boolean;
    isLoading: boolean;
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
            {render({ item, depth, isExpanded, isLoading, setNodeRef, attributes, listeners, isDragging, toggleExpand: () => { } })}
        </div>
    );
}

export function SortableTree<T extends Record<string, any>>(props: SortableTreeProps<T>) {
    const { idKey, parentKey, depthKey } = useStableKeys(props);
    const maxDepth = props.maxDepth ?? 3;
    const expandOnHoverMs = props.expandOnHoverMs ?? 600;
    const expandOnHoverIdleMs = props.expandOnHoverIdleMs ?? 600;
    const enableIdleHoverExpand = props.enableIdleHoverExpand ?? true;
    const autoSave = props.autoSave ?? false;

    const [items, setItems] = useState<T[]>([]);
    const [expanded, setExpanded] = useState<Set<Id>>(new Set());
    const [loading, setLoading] = useState<Set<Id>>(new Set());
    const [activeId, setActiveId] = useState<Id | null>(null);
    const [overId, setOverId] = useState<Id | null>(null);
    const hoverTimer = useRef<number | null>(null);
    const hoverTargetId = useRef<Id | null>(null);
    const idleHoverTimers = useRef<Map<Id, number>>(new Map());

    useEffect(() => {
        setItems((prev) => {
            const merged = [...prev, ...props.items];
            return Array.from(new Map(merged.map((c) => [getField(c, idKey) as Id, c])).values());
        });
    }, [props.items, idKey]);

    const idMap = useMemo(() => new Map<Id, T>(items.map((x) => [getField(x, idKey) as Id, x])), [items, idKey]);

    const isVisible = (it: T): boolean => {
        let pid = (getField<T, Id | null>(it, parentKey, null) as Id | null);
        while (pid != null) {
            if (!expanded.has(pid)) return false;
            const p = idMap.get(pid);
            if (!p) break;
            pid = (getField<T, Id | null>(p, parentKey, null) as Id | null);
        }
        return true;
    };
    const visible = useMemo(() => items.filter(isVisible), [items, expanded]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const hasChildren = (it: T) => {
        if (props.hasChildren) return props.hasChildren(it, items);
        const id = getField<T, Id>(it, idKey) as Id;
        return items.some((x) => (getField<T, Id | null>(x, parentKey, null) as Id | null) === id) || expanded.has(id);
    };

    const toggleExpand = async (id: Id) => {
        const isOpen = expanded.has(id);
        if (isOpen) {
            setExpanded((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setLoading((s) => { const n = new Set(s); n.delete(id); return n; });
            return;
        }

        // already have children in items?
        if (items.some((x) => (getField<T, Id | null>(x, parentKey, null) as Id | null) === id)) {
            setExpanded((s) => new Set(s).add(id));
            return;
        }

        if (!props.loadChildren) {
            setExpanded((s) => new Set(s).add(id));
            return;
        }

        setLoading((s) => new Set(s).add(id));
        try {
            const parent = idMap.get(id);
            const parentDepth = parent ? (getField<T, number>(parent, depthKey, 0)) : 0;
            const children = await props.loadChildren(parent as T);
            setItems((prev) => {
                const existing = new Set(prev.map((p) => getField<T, Id>(p, idKey) as Id));
                const normalized = children
                    .filter((c) => !existing.has(getField<T, Id>(c, idKey) as Id))
                    .map((c) => {
                        const withParent = setField(c, parentKey, id);
                        const d = getField<T, number>(withParent, depthKey, NaN);
                        return Number.isFinite(d) ? withParent : setField(withParent, depthKey, parentDepth + 1);
                    });
                const idx = items.findIndex((x) => (getField<T, Id>(x, idKey) as Id) === id);
                if (idx === -1) return prev;
                return [...prev.slice(0, idx + 1), ...normalized, ...prev.slice(idx + 1)];
            });
            setExpanded((s) => new Set(s).add(id));
        } finally {
            setLoading((s) => { const n = new Set(s); n.delete(id); return n; });
        }
    };

    const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id as Id);

    const onDragOver = (e: DragOverEvent) => {
        const currentOverId = (e.over?.id as Id) ?? null;
        setOverId(currentOverId);
        if (currentOverId == null) {
            if (hoverTimer.current) { window.clearTimeout(hoverTimer.current); hoverTimer.current = null; }
            hoverTargetId.current = null;
            return;
        }
        if (hoverTargetId.current !== currentOverId) {
            if (hoverTimer.current) { window.clearTimeout(hoverTimer.current); hoverTimer.current = null; }
            hoverTargetId.current = currentOverId;
            hoverTimer.current = window.setTimeout(() => {
                if (!expanded.has(currentOverId) && !loading.has(currentOverId)) {
                    toggleExpand(currentOverId);
                }
            }, expandOnHoverMs) as unknown as number;
        }
    };

    const onDragEnd = (e: DragEndEvent) => {
        const { active, over } = e;
        setActiveId(null);
        setOverId(null);
        if (hoverTimer.current) { window.clearTimeout(hoverTimer.current); hoverTimer.current = null; }
        hoverTargetId.current = null;
        if (!over || active.id === over.id) return;

        const activeItem = idMap.get(active.id as Id);
        const overItem = idMap.get(over.id as Id);
        if (!activeItem || !overItem) return;

        const getId = (x: T) => getField<T, Id>(x, idKey) as Id;
        const getParent = (x: T) => getField<T, Id | null>(x, parentKey, null) as Id | null;
        const getDepth = (x: T) => getField<T, number>(x, depthKey, 0) as number;

        const collectSubtreeIds = (rootId: Id): Id[] => {
            const start = items.findIndex((x) => getId(x) === rootId);
            if (start === -1) return [];
            const rootDepth = getDepth(items[start]);
            const ids: Id[] = [rootId];
            for (let i = start + 1; i < items.length; i++) {
                const d = getDepth(items[i]);
                if (d <= rootDepth) break;
                ids.push(getId(items[i]));
            }
            return ids;
        };

        const isDescendantOf = (maybeChildId: Id, maybeAncestorId: Id): boolean => {
            let cur = idMap.get(maybeChildId) || null;
            const guard = new Set<Id>();
            while (cur && getParent(cur) != null) {
                if (getParent(cur) === maybeAncestorId) return true;
                const p = getParent(cur);
                if (p != null && guard.has(p)) break;
                if (p != null) guard.add(p);
                cur = p != null ? idMap.get(p) || null : null;
            }
            return false;
        };

        const dropInto = expanded.has(getField<T, Id>(overItem, idKey) as Id);
        const targetParentId: Id | null = dropInto ? (getField<T, Id>(overItem, idKey) as Id) : getParent(overItem);
        if (targetParentId != null && isDescendantOf(targetParentId, getField<T, Id>(activeItem, idKey) as Id)) return;

        const subtreeIds = collectSubtreeIds(getField<T, Id>(activeItem, idKey) as Id);
        if (subtreeIds.length === 0) return;

        const movingSet = new Set(subtreeIds);
        const remaining: T[] = [];
        const block: T[] = [];
        for (const it of items) (movingSet.has(getId(it)) ? block : remaining).push(it);

        const parentDepth = targetParentId == null ? -1 : getDepth(idMap.get(targetParentId) as T);
        const targetDepth = targetParentId == null ? 0 : parentDepth + 1;
        const delta = targetDepth - getDepth(activeItem);

        for (const n of block) {
            const nd = getDepth(n) + delta;
            if (nd < 0 || nd > maxDepth) return;
        }

        const movedBlock: T[] = block.map((n) => {
            const newDepth = getDepth(n) + delta;
            const newParent = getId(n) === getId(activeItem) ? targetParentId : getParent(n);
            return setField(setField(n, depthKey, newDepth), parentKey, newParent);
        });

        const overIdxRemaining = remaining.findIndex((x) => getId(x) === getField<T, Id>(overItem, idKey));
        if (dropInto) {
            const parentIdx = remaining.findIndex((x) => getId(x) === getField<T, Id>(overItem, idKey));
            const insertAt = parentIdx === -1 ? remaining.length : parentIdx + 1;
            remaining.splice(insertAt, 0, ...movedBlock);
        } else {
            const insertAt = overIdxRemaining === -1 ? remaining.length : overIdxRemaining;
            remaining.splice(insertAt, 0, ...movedBlock);
        }

        const next = remaining;
        const siblings = next.filter((n) => (getParent(n) ?? null) === targetParentId);
        const ix = siblings.findIndex((s) => getId(s) === getId(activeItem));
        const beforeId = ix > 0 ? getId(siblings[ix - 1]) : null;
        const afterId = ix >= 0 && ix < siblings.length - 1 ? getId(siblings[ix + 1]) : null;

        setItems(next);
        props.onChange?.(next);
        if (targetParentId != null && !expanded.has(targetParentId)) setExpanded((s) => new Set(s).add(targetParentId));

        if (autoSave && props.onMove) {
            const preferBefore = beforeId !== null ? beforeId : null;
            const onlyAfter = preferBefore === null ? (afterId ?? null) : null;
            props.onMove({ id: getId(activeItem), parentId: targetParentId, beforeId: preferBefore, afterId: onlyAfter, next });
        }
    };

    const renderWithControls = (it: T) => {
        const id = getField<T, Id>(it, idKey) as Id;
        const depth = getField<T, number>(it, depthKey, 0);
        const isExpanded = expanded.has(id);
        const isLoading = loading.has(id) && isExpanded && !items.some((x) => getField<T, Id | null>(x, parentKey, null) === id);
        const doToggle = () => toggleExpand(id);

        // Wrap props so renderItem can access dnd-kit handles
        return (
            <div
                key={String(id)}
                onMouseEnter={() => {
                    if (!enableIdleHoverExpand) return;
                    if (expanded.has(id) || loading.has(id)) return;
                    // Debounce per-id to avoid spamming fetches
                    const existing = idleHoverTimers.current.get(id);
                    if (existing) {
                        window.clearTimeout(existing);
                        idleHoverTimers.current.delete(id);
                    }
                    const t = window.setTimeout(() => {
                        // Only expand if still not expanded at fire time
                        if (!expanded.has(id) && !loading.has(id)) {
                            toggleExpand(id);
                        }
                        idleHoverTimers.current.delete(id);
                    }, expandOnHoverIdleMs) as unknown as number;
                    idleHoverTimers.current.set(id, t);
                }}
                onMouseLeave={() => {
                    const existing = idleHoverTimers.current.get(id);
                    if (existing) {
                        window.clearTimeout(existing);
                        idleHoverTimers.current.delete(id);
                    }
                }}
            >
                <NodeRow<T>
                    item={it}
                    sortableId={id}
                    depth={depth}
                    isExpanded={isExpanded}
                    isLoading={!!isLoading}
                    render={(ctx) => props.renderItem({ ...ctx, toggleExpand: doToggle })}
                />
            </div>
        );
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
        >
            <SortableContext items={visible.map((x) => getField<T, Id>(x, idKey))} strategy={verticalListSortingStrategy}>
                <div>
                    {visible.map((it) => renderWithControls(it))}
                </div>
            </SortableContext>
        </DndContext>
    );
}

export default SortableTree;
