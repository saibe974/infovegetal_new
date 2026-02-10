import { withAppLayout } from '@/layouts/app-layout';
import carriers from '@/routes/carriers';
import { type BreadcrumbItem, type Carrier, type PaginatedCollection } from '@/types';
import { Head, Link, router, InfiniteScroll } from '@inertiajs/react';
import { useRef, useState } from 'react';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
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

type Props = {
    collection: PaginatedCollection<Carrier>;
    q?: string | null;
};

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
                            <TableHead>{t('Zones')}</TableHead>
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
                                <TableCell>{item.country ?? '-'}</TableCell>
                                <TableCell>{item.days ?? '-'}</TableCell>
                                <TableCell>{item.minimum ?? '-'}</TableCell>
                                <TableCell>{item.taxgo ?? '-'}</TableCell>
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
