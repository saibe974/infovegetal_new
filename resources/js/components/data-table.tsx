import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
} from '@tanstack/react-table';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ChevronDown, GripVertical, X } from 'lucide-react';

type HeaderControl = {
    editable?: boolean;
    deletable?: boolean;
    value?: string;
    placeholder?: string;
    draggable?: boolean;
    onChange?: (nextValue: string) => void;
    onDelete?: () => void;
};

type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    emptyMessage?: React.ReactNode;
    showHeader?: boolean;
    getRowId?: (row: TData, index: number) => string;
    className?: string;
    headerControls?: (
        columnId: string,
        columnIndex: number,
    ) => HeaderControl | null;
    stickyEndColumnId?: string;
    onColumnReorder?: (activeColumnId: string, overColumnId: string) => void;
    onColumnInsert?: (columnIndex: number) => void;
    columnInsertLabel?: string;
};

type SortableTableHeadProps = {
    id: string;
    draggable: boolean;
    sticky: boolean;
    children: (handle: React.ReactNode) => React.ReactNode;
};

function SortableTableHead({
    id,
    draggable,
    sticky,
    children,
}: SortableTableHeadProps) {
    const {
        attributes,
        listeners,
        setActivatorNodeRef,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id, disabled: !draggable });

    const handle = draggable ? (
        <Button
            ref={setActivatorNodeRef}
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 cursor-grab touch-none active:cursor-grabbing"
            {...attributes}
            {...listeners}
        >
            <GripVertical className="h-3.5 w-3.5" />
        </Button>
    ) : null;

    return (
        <TableHead
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(
                sticky &&
                    'sticky right-0 z-20 w-px rounded-l-lg border-l bg-muted px-1.5',
                'group/header relative',
                isDragging && 'z-30 opacity-70',
            )}
        >
            {children(handle)}
        </TableHead>
    );
}

export function DataTable<TData, TValue>({
    columns,
    data,
    emptyMessage = 'Aucun resultat.',
    showHeader = true,
    getRowId,
    className,
    headerControls,
    stickyEndColumnId,
    onColumnReorder,
    onColumnInsert,
    columnInsertLabel = 'Ajouter une colonne ici',
}: DataTableProps<TData, TValue>) {
    const [headerDrafts, setHeaderDrafts] = React.useState<
        Record<string, string>
    >({});
    const table = useReactTable({
        data,
        columns,
        getRowId,
        getCoreRowModel: getCoreRowModel(),
    });
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const handleColumnDragEnd = React.useCallback(
        ({ active, over }: DragEndEvent) => {
            if (!over || active.id === over.id || !onColumnReorder) return;
            onColumnReorder(String(active.id), String(over.id));
        },
        [onColumnReorder],
    );

    const commitHeaderValue = React.useCallback(
        (columnId: string, control: HeaderControl | null) => {
            if (!control?.editable || typeof control.onChange !== 'function') {
                return;
            }

            const draft = headerDrafts[columnId] ?? '';
            if (draft.trim() === '') {
                setHeaderDrafts((current) => {
                    const next = { ...current };
                    delete next[columnId];
                    return next;
                });
                return;
            }

            if (draft !== (control.value ?? '')) {
                control.onChange(draft);
            }

            setHeaderDrafts((current) => {
                const next = { ...current };
                delete next[columnId];
                return next;
            });
        },
        [headerDrafts],
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
        >
            <Table className={className}>
                {showHeader ? (
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <SortableContext
                                key={headerGroup.id}
                                items={headerGroup.headers.map(
                                    (header) => header.column.id,
                                )}
                                strategy={horizontalListSortingStrategy}
                            >
                                <TableRow>
                                    {headerGroup.headers.map(
                                        (header, headerIndex) => {
                                            if (header.isPlaceholder) {
                                                return (
                                                    <TableHead
                                                        key={header.id}
                                                    />
                                                );
                                            }

                                            const control =
                                                headerControls?.(
                                                    header.column.id,
                                                    headerIndex,
                                                ) ?? null;
                                            const canEdit =
                                                !!control?.editable &&
                                                typeof control.onChange ===
                                                    'function';
                                            const canDelete =
                                                !!control?.deletable &&
                                                typeof control.onDelete ===
                                                    'function';

                                            const headerValue =
                                                control?.value ?? '';
                                            const draftValue =
                                                headerDrafts[
                                                    header.column.id
                                                ] ?? headerValue;
                                            const canInsertBefore =
                                                Boolean(onColumnInsert);

                                            return (
                                                <SortableTableHead
                                                    key={header.id}
                                                    id={header.column.id}
                                                    draggable={Boolean(
                                                        control?.draggable,
                                                    )}
                                                    sticky={
                                                        header.column.id ===
                                                        stickyEndColumnId
                                                    }
                                                >
                                                    {(dragHandle) => (
                                                        <>
                                                            {canInsertBefore ? (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className={cn(
                                                                        'absolute top-1/2 -left-2 z-40 h-6 w-4 -translate-y-1/2 rounded-md bg-card text-green-600 opacity-35 transition-opacity group-hover/header:opacity-100 hover:bg-green-500/10 hover:text-green-700 hover:opacity-100 focus-visible:opacity-100 dark:text-green-400',
                                                                        headerIndex ===
                                                                            0 &&
                                                                            'left-0',
                                                                    )}
                                                                    title={
                                                                        columnInsertLabel
                                                                    }
                                                                    aria-label={
                                                                        columnInsertLabel
                                                                    }
                                                                    onPointerDown={(
                                                                        event,
                                                                    ) =>
                                                                        event.stopPropagation()
                                                                    }
                                                                    onClick={() =>
                                                                        onColumnInsert?.(
                                                                            headerIndex,
                                                                        )
                                                                    }
                                                                >
                                                                    <ChevronDown className="h-3.5 w-3.5" />
                                                                </Button>
                                                            ) : null}
                                                            {canEdit ||
                                                            canDelete ? (
                                                                <div
                                                                    className={cn(
                                                                        'flex items-center gap-2',
                                                                        header
                                                                            .column
                                                                            .id ===
                                                                            stickyEndColumnId &&
                                                                            'justify-end',
                                                                    )}
                                                                >
                                                                    {dragHandle}
                                                                    {canEdit ? (
                                                                        <div className="relative w-24">
                                                                            <Input
                                                                                value={
                                                                                    draftValue
                                                                                }
                                                                                placeholder={
                                                                                    control?.placeholder
                                                                                }
                                                                                onChange={(
                                                                                    event,
                                                                                ) =>
                                                                                    setHeaderDrafts(
                                                                                        (
                                                                                            current,
                                                                                        ) => ({
                                                                                            ...current,
                                                                                            [header
                                                                                                .column
                                                                                                .id]:
                                                                                                event
                                                                                                    .target
                                                                                                    .value,
                                                                                        }),
                                                                                    )
                                                                                }
                                                                                onBlur={() =>
                                                                                    commitHeaderValue(
                                                                                        header
                                                                                            .column
                                                                                            .id,
                                                                                        control,
                                                                                    )
                                                                                }
                                                                                onKeyDown={(
                                                                                    event,
                                                                                ) => {
                                                                                    if (
                                                                                        event.key ===
                                                                                        'Enter'
                                                                                    ) {
                                                                                        event.currentTarget.blur();
                                                                                    }
                                                                                }}
                                                                                className={cn(
                                                                                    'h-8 w-24',
                                                                                    draftValue &&
                                                                                        'pr-7',
                                                                                )}
                                                                            />
                                                                            {draftValue ? (
                                                                                <button
                                                                                    type="button"
                                                                                    className="absolute top-1/2 right-1 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                                                                    title="Vider le nom de la colonne"
                                                                                    aria-label="Vider le nom de la colonne"
                                                                                    onMouseDown={(
                                                                                        event,
                                                                                    ) =>
                                                                                        event.preventDefault()
                                                                                    }
                                                                                    onClick={() => {
                                                                                        setHeaderDrafts(
                                                                                            (
                                                                                                current,
                                                                                            ) => {
                                                                                                const next =
                                                                                                    {
                                                                                                        ...current,
                                                                                                    };
                                                                                                delete next[
                                                                                                    header
                                                                                                        .column
                                                                                                        .id
                                                                                                ];
                                                                                                return next;
                                                                                            },
                                                                                        );
                                                                                        control?.onChange?.(
                                                                                            '',
                                                                                        );
                                                                                    }}
                                                                                >
                                                                                    <X className="h-3 w-3" />
                                                                                </button>
                                                                            ) : null}
                                                                        </div>
                                                                    ) : (
                                                                        flexRender(
                                                                            header
                                                                                .column
                                                                                .columnDef
                                                                                .header,
                                                                            header.getContext(),
                                                                        )
                                                                    )}
                                                                    {canDelete ? (
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                            onClick={
                                                                                control?.onDelete
                                                                            }
                                                                        >
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    ) : null}
                                                                </div>
                                                            ) : (
                                                                <div
                                                                    className={cn(
                                                                        'flex items-center gap-2',
                                                                        header
                                                                            .column
                                                                            .id ===
                                                                            stickyEndColumnId &&
                                                                            'justify-end',
                                                                    )}
                                                                >
                                                                    {dragHandle}
                                                                    {flexRender(
                                                                        header
                                                                            .column
                                                                            .columnDef
                                                                            .header,
                                                                        header.getContext(),
                                                                    )}
                                                                </div>
                                                            )}
                                                        </>
                                                    )}
                                                </SortableTableHead>
                                            );
                                        },
                                    )}
                                </TableRow>
                            </SortableContext>
                        ))}
                    </TableHeader>
                ) : null}
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id}>
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
                                        key={cell.id}
                                        className={cn(
                                            cell.column.id ===
                                                stickyEndColumnId &&
                                                'sticky right-0 z-10 w-px rounded-l-lg border-l bg-card px-1.5',
                                        )}
                                    >
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext(),
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell
                                colSpan={columns.length}
                                className="h-24 text-center"
                            >
                                {emptyMessage}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </DndContext>
    );
}
