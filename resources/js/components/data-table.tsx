import * as React from 'react';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

type HeaderControl = {
    editable?: boolean;
    deletable?: boolean;
    value?: string;
    placeholder?: string;
    onChange?: (nextValue: string) => void;
    onDelete?: () => void;
};

type DataTableProps<TData, TValue> = {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    emptyMessage?: string;
    showHeader?: boolean;
    getRowId?: (row: TData, index: number) => string;
    className?: string;
    headerControls?: (columnId: string, columnIndex: number) => HeaderControl | null;
};

export function DataTable<TData, TValue>({
    columns,
    data,
    emptyMessage = 'Aucun resultat.',
    showHeader = true,
    getRowId,
    className,
    headerControls,
}: DataTableProps<TData, TValue>) {
    const table = useReactTable({
        data,
        columns,
        getRowId,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <Table className={className}>
            {showHeader ? (
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header, headerIndex) => {
                                if (header.isPlaceholder) {
                                    return <TableHead key={header.id} />;
                                }

                                const control = headerControls?.(header.column.id, headerIndex) ?? null;
                                const canEdit = !!control?.editable && typeof control.onChange === 'function';
                                const canDelete = !!control?.deletable && typeof control.onDelete === 'function';

                                return (
                                    <TableHead key={header.id}>
                                        {canEdit || canDelete ? (
                                            <div className="flex items-center gap-2">
                                                {canEdit ? (
                                                    <Input
                                                        value={control?.value ?? ''}
                                                        placeholder={control?.placeholder}
                                                        onChange={(event) => control?.onChange?.(event.target.value)}
                                                        className="h-8 w-24"
                                                    />
                                                ) : (
                                                    flexRender(header.column.columnDef.header, header.getContext())
                                                )}
                                                {canDelete ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={control?.onDelete}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                        ) : (
                                            flexRender(header.column.columnDef.header, header.getContext())
                                        )}
                                    </TableHead>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
            ) : null}
            <TableBody>
                {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                        <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                            {emptyMessage}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    );
}
