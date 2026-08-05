import { withAppLayout } from '@/layouts/app-layout';
import carriers from '@/routes/carriers';
import { type BreadcrumbItem, type Carrier, type PaginatedCollection } from '@/types';
import { Head, Link, router, InfiniteScroll } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import CountryFlag from '@/components/ui/country-flag';
import { EditIcon, TrashIcon } from 'lucide-react';
import SearchSelect from '@/components/app/search-select';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ButtonsActions } from '@/components/buttons-actions';
import { useI18n } from '@/lib/i18n';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Carriers',
        href: carriers.index().url,
    },
];

const WEEKDAY_LABELS: Record<string, string> = {
    '1': 'Lundi',
    '2': 'Mardi',
    '3': 'Mercredi',
    '4': 'Jeudi',
    '5': 'Vendredi',
    '6': 'Samedi',
    '7': 'Dimanche',
};

const formatDays = (days?: string[] | null) => {
    if (!days || days.length === 0) {
        return '-';
    }

    const labels = days
        .map((day) => WEEKDAY_LABELS[day])
        .filter(Boolean);

    return labels.length > 0 ? labels.join(', ') : '-';
};

type Props = {
    collection: PaginatedCollection<Carrier>;
    q?: string | null;
};

const getCsrfToken = (): string =>
    (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';

function TaxgoInput({ carrier }: { carrier: Carrier }) {
    const initialValue = carrier.taxgo === null || carrier.taxgo === undefined ? '' : String(carrier.taxgo);
    const [value, setValue] = useState(initialValue);
    const [savedValue, setSavedValue] = useState(initialValue);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

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
                body: JSON.stringify({ taxgo: value === '' ? null : Number(value) }),
            });

            if (!response.ok) {
                throw new Error('Taxgo update failed');
            }

            const result = await response.json() as { taxgo: number | null };
            const normalizedValue = result.taxgo === null ? '' : String(result.taxgo);
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
            title={status === 'error' ? 'Erreur lors de la mise à jour' : undefined}
            className={`h-8 w-24 text-right ${status === 'saved' ? 'border-green-600' : ''}`}
        />
    );
}

export default withAppLayout(breadcrumbs, true, ({ collection, q }: Props) => {
    const { t } = useI18n();
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

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
        router.get(window.location.pathname, { q: trimmed }, {
            preserveState: false,
            replace: true,
            preserveScroll: false,
        });
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
                            <SortableTableHead field="id">ID</SortableTableHead>
                            <SortableTableHead field="name">{t('Name')}</SortableTableHead>
                            <SortableTableHead field="country">{t('Country')}</SortableTableHead>
                            <SortableTableHead field="days">{t('Days')}</SortableTableHead>
                            <SortableTableHead field="minimum">{t('Minimum')}</SortableTableHead>
                            <SortableTableHead field="taxgo">{t('Taxgo')}</SortableTableHead>
                            <SortableTableHead field="zones_count">{t('Zones')}</SortableTableHead>
                            <TableHead className="text-end">{t('Actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Array.from(new Map(collection.data.map((item) => [item.id, item])).values()).map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>
                                    <Link href={carriers.edit(item.id as number)} className="hover:underline font-medium">
                                        {item.name}
                                    </Link>
                                </TableCell>
                                <TableCell>
                                    <CountryFlag countryCode={item.country} className="w-6" title={item.country ?? undefined} />
                                </TableCell>
                                <TableCell>{formatDays(item.days)}</TableCell>
                                <TableCell>{item.minimum ?? '-'}</TableCell>
                                <TableCell><TaxgoInput carrier={item} /></TableCell>
                                <TableCell>{item.zones_count ?? 0}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2 justify-end">
                                        <Button asChild size="icon" variant="outline">
                                            <Link href={carriers.edit(item.id as number)}>
                                                <EditIcon size={16} />
                                            </Link>
                                        </Button>
                                        <Button asChild size="icon" variant="destructive-outline">
                                            <Link
                                                href={carriers.destroy(item.id as number)}
                                                method="delete"
                                                onBefore={() => confirm(t('Are you sure you want to delete this carrier?'))}
                                            >
                                                <TrashIcon size={16} />
                                            </Link>
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </InfiniteScroll>
        </>
    );
});
