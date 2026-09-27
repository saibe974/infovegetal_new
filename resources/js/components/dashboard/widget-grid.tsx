import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveGridLayout, useContainerWidth, type Layout, type LayoutItem, type ResponsiveLayouts } from 'react-grid-layout';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EllipsisVertical, GripHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ResizeHandleAxis } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

const RESIZE_HANDLES: ResizeHandleAxis[] = ['n', 's', 'e', 'w'];

const RESIZE_ICONS: Record<ResizeHandleAxis, React.ReactNode> = {
    n: <span className="h-1 w-5 rounded-full bg-border transition-colors group-hover/resize:bg-primary/60" />,
    s: <span className="h-1 w-5 rounded-full bg-border transition-colors group-hover/resize:bg-primary/60" />,
    e: <span className="h-5 w-1 rounded-full bg-border transition-colors group-hover/resize:bg-primary/60" />,
    w: <span className="h-5 w-1 rounded-full bg-border transition-colors group-hover/resize:bg-primary/60" />,
    ne: null,
    nw: null,
    se: null,
    sw: null,
};

function ResizeHandleComponent(axis: ResizeHandleAxis, ref: React.Ref<HTMLElement>) {
    return (
        <span ref={ref} className={cnResizeClass(axis)}>
            {RESIZE_ICONS[axis]}
        </span>
    );
}

function cnResizeClass(axis: ResizeHandleAxis) {
    const base = 'react-resizable-handle react-resizable-handle-' + axis;
    switch (axis) {
        case 'n':
        case 's':
            return base + ' group/resize flex items-center justify-center';
        case 'e':
        case 'w':
            return base + ' group/resize flex items-center justify-center';
        default:
            return base;
    }
}

export type WidgetType = {
    type: string;
    label: string;
};

export type WidgetDefinition = {
    id: string;
    type: string;
    title: string;
    content: React.ReactNode;
};

type Breakpoints = 'lg' | 'md' | 'sm';

type WidgetGridProps = {
    widgets: WidgetDefinition[];
    initialLayout?: LayoutItem[];
    onAdd?: (type: string) => string | void;
    onRemove?: (id: string) => void;
    onTitleChange?: (id: string, title: string) => void;
    onLayoutChange?: (layout: LayoutItem[]) => void;
    widgetTypes?: WidgetType[];
    defaultItem?: Partial<LayoutItem>;
    cols?: Record<Breakpoints, number>;
    breakpoints?: Record<Breakpoints, number>;
    rowHeight?: number;
};

const DEFAULT_COLS: Record<Breakpoints, number> = { lg: 12, md: 12, sm: 6 };
const DEFAULT_BREAKPOINTS: Record<Breakpoints, number> = { lg: 1024, md: 640, sm: 0 };

export function WidgetGrid({
    widgets,
    initialLayout,
    onAdd,
    onRemove,
    onTitleChange,
    onLayoutChange,
    widgetTypes = [],
    defaultItem,
    cols = DEFAULT_COLS,
    breakpoints = DEFAULT_BREAKPOINTS,
    rowHeight = 60,
}: WidgetGridProps) {
    const { width, containerRef } = useContainerWidth();
    const [currentLayout, setCurrentLayout] = useState<LayoutItem[]>(initialLayout ?? []);
    const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
    const [hydrated, setHydrated] = useState(false);
    const persisted = useRef<LayoutItem[]>(initialLayout ?? []);

    useEffect(() => {
        if (!hydrated && initialLayout) {
            setCurrentLayout(initialLayout);
            persisted.current = initialLayout;
            setHydrated(true);
        }
    }, [initialLayout, hydrated]);

    const handleChange = useCallback(
        (next: Layout) => {
            const items = next.map((item) => ({ ...item }));
            setCurrentLayout(items);
            persisted.current = items;
            onLayoutChange?.(items);
        },
        [onLayoutChange],
    );

    const addWidget = useCallback(
        (type: string) => {
            const id = onAdd?.(type);
            if (typeof id !== 'string') return;
            const base = { w: 6, h: 4, ...defaultItem };
            const maxY = persisted.current.reduce((acc, l) => Math.max(acc, l.y + l.h), 0);
            const item: LayoutItem = { i: id, x: 0, y: maxY, ...base };
            const updated = [...persisted.current, item];
            persisted.current = updated;
            setCurrentLayout(updated);
            onLayoutChange?.(updated);
        },
        [defaultItem, onAdd, onLayoutChange],
    );

    const removeWidget = useCallback(
        (id: string) => {
            const updated = persisted.current.filter((l) => l.i !== id);
            persisted.current = updated;
            setCurrentLayout(updated);
            onLayoutChange?.(updated);
            onRemove?.(id);
        },
        [onRemove, onLayoutChange],
    );

    const confirmRename = useCallback(() => {
        if (!renaming) return;
        onTitleChange?.(renaming.id, renaming.title);
        setRenaming(null);
    }, [renaming, onTitleChange]);

    const layouts = useMemo<ResponsiveLayouts<Breakpoints>>(() => {
        const byId = new Map(currentLayout.map((l) => [l.i, l]));
        const current = widgets.map(({ id }) => byId.get(id) ?? { i: id, x: 0, y: 0, w: 6, h: 4, ...defaultItem });
        const smCols = cols.sm ?? DEFAULT_COLS.sm;
        const sm = current.map((l) => ({ ...l, w: Math.min(l.w, smCols), x: 0 }));
        return { lg: current, md: current, sm };
    }, [currentLayout, widgets, defaultItem, cols.sm]);

    return (
        <div className="flex flex-col gap-4">
            {widgetTypes.length > 0 && (
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Plus data-slot="icon" />
                                Ajouter un widget
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {widgetTypes.map((wt) => (
                                <DropdownMenuItem key={wt.type} onSelect={() => addWidget(wt.type)}>
                                    {wt.label}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
            <div ref={containerRef}>
                <ResponsiveGridLayout
                    className="widget-grid"
                    width={width}
                    layouts={layouts}
                    cols={cols}
                    breakpoints={breakpoints}
                    rowHeight={rowHeight}
                    dragConfig={{ handle: '.widget-drag-handle' }}
                    resizeConfig={{ handles: RESIZE_HANDLES, handleComponent: ResizeHandleComponent }}
                    onLayoutChange={handleChange}
                >
                    {widgets.map((widget) => (
                        <div key={widget.id} className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
                            <WidgetHandle
                                title={widget.title}
                                onRename={() => setRenaming({ id: widget.id, title: widget.title })}
                                onRemove={() => removeWidget(widget.id)}
                            />
                            <div className="min-h-0 flex-1 overflow-auto p-1">{widget.content}</div>
                        </div>
                    ))}
                </ResponsiveGridLayout>
            </div>

            <Dialog open={!!renaming} onOpenChange={(open) => !open && setRenaming(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Renommer le widget</DialogTitle>
                    </DialogHeader>
                    <Input
                        value={renaming?.title ?? ''}
                        onChange={(e) => setRenaming((r) => (r ? { ...r, title: e.target.value } : r))}
                        onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRenaming(null)}>
                            Annuler
                        </Button>
                        <Button size="sm" onClick={confirmRename}>
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

type WidgetHandleProps = {
    title: string;
    onRename?: () => void;
    onRemove?: () => void;
};

export function WidgetHandle({ title, onRename, onRemove }: WidgetHandleProps) {
    return (
        <div className="widget-drag-handle flex cursor-grab items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5 active:cursor-grabbing">
            <div className="flex min-w-0 items-center gap-2">
                <GripHorizontal className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium">{title}</span>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Options"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <EllipsisVertical className="size-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onRename?.()}>
                            <Pencil className="size-4" />
                            Renommer
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onSelect={() => onRemove?.()}>
                            <Trash2 className="size-4" />
                            Supprimer
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}
