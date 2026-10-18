import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { withAppLayout } from '@/layouts/app-layout';
import carriers from '@/routes/carriers';
import {
    type BreadcrumbItem,
    type Carrier,
    type PaginatedCollection,
} from '@/types';
import { Head, InfiniteScroll, Link, router } from '@inertiajs/react';
import { useRef, useState } from 'react';

import SearchSelect from '@/components/app/search-select';
import { ButtonsActions } from '@/components/buttons-actions';
import { CountryFlag } from '@/components/ui/country-flag';
import { StickyBar } from '@/components/ui/sticky-bar';
import { useI18n } from '@/lib/i18n';
import { EditIcon, Settings2, TrashIcon } from 'lucide-react';

type OptionalColumn = 'name' | 'bases' | 'days' | 'taxgo' | 'zones' | 'actions';
type ColumnVisibility = Record<OptionalColumn, boolean>;

const defaultColumnVisibility: ColumnVisibility = {
    name: true,
    bases: true,
    days: true,
    taxgo: true,
    zones: true,
    actions: true,
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Carriers',
        href: carriers.index().url,
    },
];

const WEEKDAY_LABELS: Record<string, string> = {
    '1': 'Monday',
    '2': 'Tuesday',
    '3': 'Wednesday',
    '4': 'Thursday',
    '5': 'Friday',
    '6': 'Saturday',
    '7': 'Sunday',
};

const formatDays = (
    days: string[] | null | undefined,
    translate: (key: string) => string,
) => {
    if (!days || days.length === 0) {
        return '-';
    }

    const labels = days
        .map((day) => WEEKDAY_LABELS[day])
        .filter(Boolean)
        .map(translate);

    return labels.length > 0 ? labels.join(', ') : '-';
};

type Props = {
    collection: PaginatedCollection<Carrier>;
    q?: string | null;
};

const getCsrfToken = (): string =>
    (
        document.querySelector(
            'meta[name="csrf-token"]',
        ) as HTMLMetaElement | null
    )?.content ?? '';

function TaxgoInput({ carrier }: { carrier: Carrier }) {
    const { t } = useI18n();
    const initialValue =
        carrier.taxgo === null || carrier.taxgo === undefined
            ? ''
            : String(carrier.taxgo);
    const [value, setValue] = useState(initialValue);
    const [savedValue, setSavedValue] = useState(initialValue);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
        'idle',
    );

    const save = async () => {
        if (status === 'saving' || value === savedValue) {
            return;
        }

        setStatus('saving');
        try {
            const response = await fetch(`/carriers/${carrier.id}/taxgo`, {
                method: 'PATCH',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    taxgo: value === '' ? null : Number(value),
                }),
            });

            if (!response.ok) {
                throw new Error('Taxgo update failed');
            }

            const result = (await response.json()) as { taxgo: number | null };
            const normalizedValue =
                result.taxgo === null ? '' : String(result.taxgo);
            setValue(normalizedValue);
            setSavedValue(normalizedValue);
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 1200);
        } catch {
            setStatus('error');
        }
    };

    return (
        <Input
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(event) => {
                setValue(event.target.value);
                setStatus('idle');
            }}
            onBlur={() => void save()}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.currentTarget.blur();
                }
                if (event.key === 'Escape') {
                    setValue(savedValue);
                    setStatus('idle');
                    event.currentTarget.blur();
                }
            }}
            disabled={status === 'saving'}
            aria-label={`Taxgo ${carrier.name}`}
            aria-invalid={status === 'error'}
            title={
                status === 'error' ? t('Error while updating') : undefined
            }
            className={`h-8 w-24 text-right ${status === 'saved' ? 'border-green-600' : ''}`}
        />
    );
}

export default withAppLayout(breadcrumbs, true, ({ collection, q }: Props) => {
    const { t } = useI18n();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
        if (typeof window === 'undefined') return defaultColumnVisibility;

        try {
            const stored = JSON.parse(
                localStorage.getItem('carriersListColumns') || '{}',
            ) as Partial<ColumnVisibility>;

            return {
                name: stored.name ?? true,
                bases: stored.bases ?? true,
                days: stored.days ?? true,
                taxgo: stored.taxgo ?? true,
                zones: stored.zones ?? true,
                actions: stored.actions ?? true,
            };
        } catch {
            return defaultColumnVisibility;
        }
    });

    const saveVisibleColumns = (columns: ColumnVisibility) => {
        setVisibleColumns(columns);
        if (typeof window !== 'undefined') {
            localStorage.setItem('carriersListColumns', JSON.stringify(columns));
        }
    };

    const handleColumnVisibilityChange = (column: OptionalColumn, visible: boolean) => {
        saveVisibleColumns({ ...visibleColumns, [column]: visible });
    };

    const resetColumns = () => saveVisibleColumns(defaultColumnVisibility);

    const configurableColumns: Array<{ key: OptionalColumn; label: string }> = [
        { key: 'name', label: t('Name') },
        { key: 'bases', label: t('Deliverable bases') },
        { key: 'days', label: t('Days') },
        { key: 'taxgo', label: t('Taxgo') },
        { key: 'zones', label: t('Zones') },
        { key: 'actions', label: t('Actions') },
    ];

    const handleSearch = (s: string) => {
        setSearch(s);
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        router.cancelAll();
        if (s.length < 2) return;
        setFetching(true);
        timerRef.current = setTimeout(() => {
            setFetching(false);
        }, 150);
    };

    const onSelect = (value: string, options?: { force?: boolean }) => {
        const trimmed = (value ?? '').trim();
        if (options?.force && trimmed.length === 0) {
            const url = new URL(window.location.href);
            url.searchParams.delete('q');
            router.visit(url.toString(), { replace: true });
            setSearch('');
            return;
        }

        if (trimmed.length === 0) return;
        setSearch('');
        router.get(
            window.location.pathname,
            { q: trimmed },
            {
                preserveState: false,
                replace: true,
                preserveScroll: false,
            },
        );
    };

    return (
        <>
            <Head title={t('Carriers')} />
            <StickyBar className="mb-4">
                <div className="w-200 flex-1">
                    <SearchSelect
                        value={search}
                        onChange={handleSearch}
                        onSubmit={onSelect}
                        propositions={[]}
                        loading={fetching}
                        count={collection.meta.total}
                        query={q ?? ''}
                        placeholder={t('Search carriers')}
                    />
                </div>
                <ButtonsActions
                    add={() => router.visit(carriers.create().url)}
                />
            </StickyBar>

            <InfiniteScroll data="collection">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <SortableTableHead field="id">
                                <div className="flex items-center gap-1">
                                    <span>ID</span>
                                    <span
                                        onPointerDown={(event) => event.stopPropagation()}
                                        onClick={(event) => event.stopPropagation()}
                                    >
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="size-7"
                                                    title={t('Choisir les colonnes')}
                                                    aria-label={t('Choisir les colonnes')}
                                                >
                                                    <Settings2 className="size-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-56">
                                                <DropdownMenuLabel>{t('Colonnes affichees')}</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {configurableColumns.map((column) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={column.key}
                                                        checked={visibleColumns[column.key]}
                                                        onCheckedChange={(checked) =>
                                                            handleColumnVisibilityChange(column.key, Boolean(checked))
                                                        }
                                                        onSelect={(event) => event.preventDefault()}
                                                    >
                                                        {column.label}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onSelect={resetColumns}>
                                                    {t('Reinitialiser les colonnes')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </span>
                                </div>
                            </SortableTableHead>
                            {visibleColumns.name && (
                                <SortableTableHead field="name">
                                    {t('Name')}
                                </SortableTableHead>
                            )}
                            {visibleColumns.bases && (
                                <TableHead>
                                    {t('Deliverable bases')}
                                </TableHead>
                            )}
                            {visibleColumns.days && (
                                <SortableTableHead field="days">
                                    {t('Days')}
                                </SortableTableHead>
                            )}
                            {visibleColumns.taxgo && (
                                <SortableTableHead field="taxgo">
                                    {t('Taxgo')}
                                </SortableTableHead>
                            )}
                            {visibleColumns.zones && (
                                <SortableTableHead field="zones_count">
                                    {t('Zones')}
                                </SortableTableHead>
                            )}
                            {visibleColumns.actions && (
                                <TableHead className="text-end">
                                    {t('Actions')}
                                </TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from(
                            new Map(
                                collection.data.map((item) => [item.id, item]),
                            ).values(),
                        ).map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                {visibleColumns.name && (
                                    <TableCell>
                                        <Link
                                            href={carriers.edit(item.id as number)}
                                            className="font-medium hover:underline"
                                        >
                                            {item.name}
                                        </Link>
                                    </TableCell>
                                )}
                                {visibleColumns.bases && (
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {item.db_products?.map((db) => (
                                                <span
                                                    key={db.id}
                                                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs"
                                                >
                                                    <CountryFlag
                                                        countryCode={db.country}
                                                        title={db.name}
                                                        className="h-2.5 w-auto rounded-[2px]"
                                                    />
                                                    {db.name}
                                                    {db.supplement_per_roll > 0
                                                        ? ' + ' +
                                                          db.supplement_per_roll.toLocaleString(
                                                              'fr-FR',
                                                          ) +
                                                          ' ' +
                                                          t('€/roll')
                                                        : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </TableCell>
                                )}
                                {visibleColumns.days && (
                                    <TableCell>
                                        {formatDays(item.days, t)}
                                    </TableCell>
                                )}
                                {visibleColumns.taxgo && (
                                    <TableCell>
                                        <TaxgoInput carrier={item} />
                                    </TableCell>
                                )}
                                {visibleColumns.zones && (
                                    <TableCell>{item.zones_count ?? 0}</TableCell>
                                )}
                                {visibleColumns.actions && (
                                    <TableCell>
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            asChild
                                            size="icon"
                                            variant="outline"
                                        >
                                            <Link
                                                href={carriers.edit(
                                                    item.id as number,
                                                )}
                                            >
                                                <EditIcon size={16} />
                                            </Link>
                                        </Button>
                                        <Button
                                            asChild
                                            size="icon"
                                            variant="destructive-outline"
                                        >
                                            <Link
                                                href={carriers.destroy(
                                                    item.id as number,
                                                )}
                                                method="delete"
                                                onBefore={() =>
                                                    confirm(
                                                        t(
                                                            'Are you sure you want to delete this carrier?',
                                                        ),
                                                    )
                                                }
                                            >
                                                <TrashIcon size={16} />
                                            </Link>
                                        </Button>
                                    </div>
                                </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </InfiniteScroll>
        </>
    );
});
