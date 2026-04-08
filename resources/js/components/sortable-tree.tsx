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
    guideContinuations: boolean[];

    // UX drag (on conserve pour l'inside si tu veux un highlight)
    isOver: boolean;
    insertLine: 'before' | 'after' | null; // gardé mais tu ne l'affiches plus
    isInsideTarget: boolean;

    setNodeRef: (el: HTMLElement | null) => void;
    attributes: any;
    listeners: any;
    toggleExpand: () => void;
};

export type LazyLoadPageArgs = {
    offset: number;
    limit: number;
};

export type LazyLoadPageResult<T> = {
    items: T[];
    hasMore: boolean;
    nextOffset?: number;
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

    onChange?: (next: T[], reason?: 'drag' | 'expand' | 'collapse' | 'lazy-load') => void;
    renderItem: (props: RenderItemProps<T>) => React.ReactNode;

    lazy?: {
        pageSize?: number;
        loadPage: (parent: T | null, args: LazyLoadPageArgs) => Promise<LazyLoadPageResult<T>>;
    };

    forcedExpandedIds?: Id[];

    storageKey?: string; // Clé pour le localStorage (ex: "categories", "users")
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
    guideContinuations,
    toggleExpand,
    render,
    className,
}: {
    item: T;
    sortableId: Id;
    depth: number;
    isExpanded: boolean;
    isLoading: boolean;
    isOver: boolean;
    insertLine: 'before' | 'after' | null;
    isInsideTarget: boolean;
    guideContinuations: boolean[];
    toggleExpand: () => void;
    className?: string;
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
        <div ref={setNodeRef} style={style} className={className}>
            {render({
                item,
                depth,
                isExpanded,
                isLoading,
                isDragging,
                guideContinuations,
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

function AutoLoadMoreRow({
    onVisible,
    loading,
    depth,
}: {
    onVisible: () => void;
    loading: boolean;
    depth: number;
}) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const node = ref.current;
        if (!node || loading) {
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    onVisible();
                }
            },
            {
                rootMargin: '120px',
                threshold: 0.1,
            },
        );

        observer.observe(node);

        return () => {
            observer.disconnect();
        };
    }, [onVisible, loading]);

    return (
        <div
            ref={ref}
            className="px-3 py-2 text-xs text-muted-foreground"
            style={{ marginLeft: (depth + 1) * 24 }}
        >
            {loading ? 'Chargement...' : 'Charger plus...'}
        </div>
    );
}

export default function SortableTree<T extends Record<string, any>>(props: SortableTreeProps<T>) {
    // console.log(props);
    const { idKey, parentKey, depthKey } = useKeys(props);

    const maxDepth = props.maxDepth ?? 3;
    const insideDelayMs = props.insideDelayMs ?? 750;
    const edgeRatio = props.edgeRatio ?? 0.25;
    const expandOnInside = props.expandOnInside ?? true;
    const storageKey = props.storageKey;

    const [items, setItems] = useState<T[]>([]);
    const [expanded, setExpanded] = useState<Set<Id>>(() => {
        if (typeof window === 'undefined' || !storageKey) return new Set();
        try {
            const stored = localStorage.getItem(`sortableTree:${storageKey}:expanded`);
            if (stored) {
                const arr = JSON.parse(stored);
                return new Set(arr);
            }
        } catch (e) {
            console.warn('Failed to load expanded state from localStorage:', e);
        }
        return new Set();
    });
    const [loading, setLoading] = useState<Set<Id>>(new Set());
    const [branchState, setBranchState] = useState<Record<string, { offset: number; hasMore: boolean; initialized: boolean }>>({});
    const [branchLoading, setBranchLoading] = useState<Record<string, boolean>>({});

    const [activeId, setActiveId] = useState<Id | null>(null);
    const [overId, setOverId] = useState<Id | null>(null);
    const [dropIntent, setDropIntent] = useState<DropIntent>(null);

    const branchKey = (parentId: Id | null) => (parentId === null ? '__root__' : String(parentId));
    const pageSize = props.lazy?.pageSize ?? 30;

    const getBranch = (parentId: Id | null) => {
        const key = branchKey(parentId);
        return branchState[key] ?? { offset: 0, hasMore: true, initialized: false };
    };

    const isBranchLoading = (parentId: Id | null) => {
        return branchLoading[branchKey(parentId)] === true;
    };

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
        const fromPayload = getField<T, boolean | null>(it, 'has_children' as ItemKey<T>, null);
        if (typeof fromPayload === 'boolean') {
            return fromPayload;
        }
        const id = getId(it);
        return items.some((x) => getParent(x) === id);
    };

    const loadBranchPage = async (parentItem: T | null, parentId: Id | null) => {
        if (!props.lazy) {
            return;
        }

        const key = branchKey(parentId);
        const state = getBranch(parentId);

        if (isBranchLoading(parentId) || (!state.hasMore && state.initialized)) {
            return;
        }

        setBranchLoading((prev) => ({ ...prev, [key]: true }));

        try {
            const result = await props.lazy.loadPage(parentItem, {
                offset: state.offset,
                limit: pageSize,
            });

            const parentDepth = parentItem ? getDepth(parentItem) : -1;

            setItems((prev) => {
                const existingIds = new Set(prev.map((item) => getId(item)));

                const normalized = (result.items ?? [])
                    .filter((item) => !existingIds.has(getId(item)))
                    .map((item) => {
                        const withParent = setField(item, parentKey, parentId);
                        const incomingDepth = getField<T, number>(withParent, depthKey, Number.NaN);

                        if (Number.isFinite(incomingDepth)) {
                            return withParent;
                        }

                        return setField(withParent, depthKey, parentDepth + 1);
                    });

                if (normalized.length === 0) {
                    return prev;
                }

                if (parentId === null) {
                    return [...prev, ...normalized];
                }

                const parentIndex = prev.findIndex((item) => getId(item) === parentId);
                if (parentIndex === -1) {
                    return [...prev, ...normalized];
                }

                let insertAt = parentIndex + 1;
                while (insertAt < prev.length && getDepth(prev[insertAt]) > parentDepth) {
                    insertAt += 1;
                }

                const next = [...prev.slice(0, insertAt), ...normalized, ...prev.slice(insertAt)];
                props.onChange?.(next, 'lazy-load');
                return next;
            });

            const nextOffset = typeof result.nextOffset === 'number'
                ? result.nextOffset
                : state.offset + (result.items?.length ?? 0);

            setBranchState((prev) => ({
                ...prev,
                [key]: {
                    offset: nextOffset,
                    hasMore: !!result.hasMore,
                    initialized: true,
                },
            }));
        } finally {
            setBranchLoading((prev) => ({ ...prev, [key]: false }));
        }
    };

    // Sauvegarder dans le localStorage quand expanded change
    useEffect(() => {
        if (typeof window === 'undefined' || !storageKey) return;
        try {
            localStorage.setItem(`sortableTree:${storageKey}:expanded`, JSON.stringify(Array.from(expanded)));
        } catch (e) {
            console.warn('Failed to save expanded state to localStorage:', e);
        }
    }, [expanded, storageKey]);

    useEffect(() => {
        if (!props.forcedExpandedIds) {
            return;
        }

        setExpanded(new Set(props.forcedExpandedIds));
    }, [props.forcedExpandedIds?.join('|')]);

    // Charger les racines par page si le mode lazy est actif.
    useEffect(() => {
        if (!props.lazy) {
            return;
        }

        if (items.length > 0) {
            return;
        }

        const root = getBranch(null);
        if (root.initialized || isBranchLoading(null)) {
            return;
        }

        void loadBranchPage(null, null);
    }, [props.lazy, items.length]);

    useEffect(() => {
        if (!props.lazy || expanded.size === 0) {
            return;
        }

        for (const expandedId of expanded) {
            const parent = idMap.get(expandedId);
            if (!parent) {
                continue;
            }

            const branch = getBranch(expandedId);
            if (branch.initialized || isBranchLoading(expandedId)) {
                continue;
            }

            void loadBranchPage(parent, expandedId);
        }
    }, [props.lazy, expanded, idMap]);

    useEffect(() => {
        if (props.lazy || !props.loadChildren || expanded.size === 0) {
            return;
        }

        for (const expandedId of expanded) {
            const parent = idMap.get(expandedId);
            if (!parent) {
                continue;
            }

            if (loading.has(expandedId)) {
                continue;
            }

            if (items.some((item) => getParent(item) === expandedId)) {
                continue;
            }

            if (!canHaveChildren(parent)) {
                continue;
            }

            setLoading((current) => new Set(current).add(expandedId));

            void props.loadChildren(parent)
                .then((children) => {
                    const parentDepth = getDepth(parent);

                    setItems((prev) => {
                        const existing = new Set(prev.map((item) => getId(item)));

                        const normalized = children
                            .filter((child) => !existing.has(getId(child)))
                            .map((child) => {
                                const withParent = setField(child, parentKey, expandedId);
                                const childDepth = getField<T, number>(withParent, depthKey, NaN);

                                return Number.isFinite(childDepth)
                                    ? withParent
                                    : setField(withParent, depthKey, parentDepth + 1);
                            });

                        if (normalized.length === 0) {
                            return prev;
                        }

                        const parentIndex = prev.findIndex((item) => getId(item) === expandedId);
                        if (parentIndex === -1) {
                            return prev;
                        }

                        return [...prev.slice(0, parentIndex + 1), ...normalized, ...prev.slice(parentIndex + 1)];
                    });
                })
                .finally(() => {
                    setLoading((current) => {
                        const next = new Set(current);
                        next.delete(expandedId);
                        return next;
                    });
                });
        }
    }, [props.lazy, props.loadChildren, expanded, idMap, items, loading]);

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

        const parent = idMap.get(id);
        if (!parent) {
            return;
        }

        if (props.lazy) {
            const branch = getBranch(id);
            if (!branch.initialized) {
                await loadBranchPage(parent, id);
            }
            return;
        }

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
        const { active, over } = e;

        // const over = e.over;
        const oid = (over?.id as Id) ?? null;
        // console.log('Drag over id:', oid);

        setOverId(oid);

        if (!oid || !over) {
            // setDropIntent(null);
            clearInsideTimer();
            return;
        }

        // // Position du centre de l'élément dragué par rapport au survolé
        const activeRect = e.active.rect.current.translated ?? e.active.rect.current.initial;

        if (!activeRect || !over.rect) {
            // setDropIntent({ type: 'between', overId: oid, where: 'before' });
            clearInsideTimer();
            return;
        }

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

        clearInsideTimer();
        insideTimerRef.current = window.setTimeout(() => {
            //     console.log('✨ Inside intent triggered for', oid);
            setDropIntent({ type: 'inside', overId: oid });
            if (expandOnInside) void toggleExpand(oid);
        }, insideDelayMs) as unknown as number;
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

        // console.log('📦 Final order:', remaining.map(x => getId(x)));

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
                <div className='bg-card rounded-lg'>
                    {visible.map((it, index) => {
                        const id = getId(it);
                        const depth = getDepth(it);
                        const nextItem = visible[index + 1];
                        const nextDepth = nextItem ? getDepth(nextItem) : -1;
                        const guideContinuations = Array.from({ length: depth }, (_, level) => nextDepth > level);

                        const isExpanded = expanded.has(id);
                        const isLoading = loading.has(id) || isBranchLoading(id);
                        const isOver = !!activeId && overId === id;

                        const branchLoadMoreItems = !props.lazy
                            ? []
                            : (() => {
                                const rows: Array<{ parentId: Id; parentItem: T; depth: number }> = [];
                                let cursor: T | undefined = it;

                                while (cursor) {
                                    const cursorId = getId(cursor);
                                    const cursorDepth = getDepth(cursor);
                                    const branch = getBranch(cursorId);
                                    const subtreeEndsHere = !nextItem || getDepth(nextItem) <= cursorDepth;

                                    if (expanded.has(cursorId) && branch.initialized && branch.hasMore && subtreeEndsHere) {
                                        rows.push({
                                            parentId: cursorId,
                                            parentItem: cursor,
                                            depth: cursorDepth,
                                        });
                                    }

                                    const parentId = getParent(cursor);
                                    cursor = parentId != null ? idMap.get(parentId) : undefined;
                                }

                                return rows;
                            })();

                        const insertLine =
                            !!activeId && dropIntent?.type === 'between' && dropIntent.overId === id ? dropIntent.where : null;

                        const isInsideTarget =
                            !!activeId && dropIntent?.type === 'inside' && dropIntent.overId === id;

                        return (
                            <React.Fragment key={String(id)}>
                                <Row<T>
                                    item={it}
                                    sortableId={id}
                                    depth={depth}
                                    isExpanded={isExpanded}
                                    isLoading={isLoading}
                                    isOver={isOver}
                                    insertLine={insertLine}
                                    isInsideTarget={isInsideTarget}
                                    guideContinuations={guideContinuations}
                                    toggleExpand={() => void toggleExpand(id)}
                                    render={props.renderItem}
                                />
                                {branchLoadMoreItems.map(({ parentId, parentItem, depth: branchDepth }) => (
                                    <AutoLoadMoreRow
                                        key={`load-more-${String(parentId)}`}
                                        depth={branchDepth}
                                        loading={isBranchLoading(parentId)}
                                        onVisible={() => {
                                            void loadBranchPage(parentItem, parentId);
                                        }}
                                    />
                                ))}
                            </React.Fragment>
                        );
                    })}
                    {props.lazy && getBranch(null).initialized && getBranch(null).hasMore ? (
                        <AutoLoadMoreRow
                            depth={-1}
                            loading={isBranchLoading(null)}
                            onVisible={() => {
                                void loadBranchPage(null, null);
                            }}
                        />
                    ) : null}
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
