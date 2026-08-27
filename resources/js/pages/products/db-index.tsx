import SearchSelect from '@/components/app/search-select';
import { ButtonsActions } from '@/components/buttons-actions';
import { DialogUpload } from '@/components/dialog-upload';
import ProductsImportTreatment from '@/components/products/import';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CountryFlag } from '@/components/ui/country-flag';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { StickyBar } from '@/components/ui/sticky-bar';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    ViewModeToggle,
    type ViewMode,
} from '@/components/ui/view-mode-toggle';
import { withAppLayout } from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import dbProducts from '@/routes/db-products';
import products from '@/routes/products';
import {
    PaginatedCollection,
    type BreadcrumbItem,
    type dbProduct,
} from '@/types';
import { Head, InfiniteScroll, Link, router, usePage } from '@inertiajs/react';
import {
    CalendarClockIcon,
    DatabaseIcon,
    EditIcon,
    ShellIcon,
    TrashIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Products', href: products.index().url },
    { title: 'Database', href: dbProducts.index().url },
];

type DbProduct = Omit<dbProduct, 'id'> & { id: number };

type Props = {
    collection: PaginatedCollection<DbProduct>;
    q?: string | null;
};

function DbProductActions({ item }: { item: DbProduct }) {
    const { t } = useI18n();

    return (
        <div className="flex justify-end gap-2">
            {item.abilities?.manage ? (
                <DialogUpload
                    title={`Mettre à jour la base de données ${item.name}`}
                    uploadUrl="/upload"
                    importProcessUrl={products.admin.import.process.url()}
                    importProcessChunkUrl={products.admin.import.process_chunk.url()}
                    importCancelUrl={products.admin.import.cancel.url()}
                    importProgressUrl={(id) =>
                        products.admin.import.progress.url({ id })
                    }
                    postTreatmentComponent={ProductsImportTreatment}
                    postTreatmentProps={{ dbProductsId: item.id }}
                    successRedirectUrl={products.index().url}
                    buttonLabel=""
                />
            ) : null}
            {item.abilities?.update ? (
                <Button asChild size="icon" variant="outline">
                    <Link href={dbProducts.edit(item.id).url} title={t('Edit')}>
                        <EditIcon size={16} />
                    </Link>
                </Button>
            ) : null}
            {item.abilities?.billing ? (
                <Button asChild size="icon" variant="outline">
                    <Link
                        href={dbProducts.billing(item.id).url}
                        title={t('Billing')}
                    >
                        <ShellIcon size={16} />
                    </Link>
                </Button>
            ) : null}
            {item.abilities?.delete ? (
                <Button asChild size="icon" variant="destructive-outline">
                    <Link
                        href={dbProducts.destroy(item.id).url}
                        method="delete"
                        title={t('Delete')}
                        onBefore={() =>
                            confirm(
                                t(
                                    'Are you sure you want to delete this database?',
                                ),
                            )
                        }
                    >
                        <TrashIcon size={16} />
                    </Link>
                </Button>
            ) : null}
        </div>
    );
}

function DbProductsMiniCards({ items }: { items: DbProduct[] }) {
    const { t } = useI18n();

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => {
                const destination = item.abilities?.update
                    ? dbProducts.edit(item.id).url
                    : item.abilities?.billing
                      ? dbProducts.billing(item.id).url
                      : null;

                return (
                    <Card
                        key={item.id}
                        className="gap-3 p-3 transition-shadow hover:shadow-md"
                    >
                        <div className="flex min-w-0 gap-3">
                            <div className="relative flex size-16 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                                <DatabaseIcon className="size-7" />
                                {item.country ? (
                                    <span className="absolute top-1 right-1 rounded border bg-background/90 px-1 py-0.5 shadow-sm">
                                        <CountryFlag
                                            countryCode={item.country}
                                            title={item.country}
                                            className="w-4"
                                        />
                                    </span>
                                ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                                {destination ? (
                                    <Link
                                        href={destination}
                                        className="font-semibold hover:underline hover:underline-offset-2"
                                    >
                                        {item.name}
                                    </Link>
                                ) : (
                                    <h3 className="font-semibold">
                                        {item.name}
                                    </h3>
                                )}
                                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                    {item.description || '-'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 border-t pt-3">
                            <p
                                className="flex items-center gap-1 text-xs text-muted-foreground"
                                title={t('maj')}
                            >
                                <CalendarClockIcon className="size-3.5" />
                                {item.updated_at
                                    ? new Date(
                                          item.updated_at,
                                      ).toLocaleDateString()
                                    : '-'}
                            </p>
                            <DbProductActions item={item} />
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}

export default withAppLayout(breadcrumbs, true, ({ collection, q }: Props) => {
    const { t } = useI18n();
    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window === 'undefined') return 'table';
        try {
            const views = JSON.parse(localStorage.getItem('views') || '{}');
            return views.dbProducts === 'list' ? 'list' : 'table';
        } catch {
            return 'table';
        }
    });

    const handleSearch = (value: string) => {
        setSearch(value);
        if (timerRef.current) clearTimeout(timerRef.current);
        router.cancelAll();
        if (value.length < 2) return;
        setFetching(true);
        timerRef.current = setTimeout(() => {
            router.reload({
                only: ['searchPropositions'],
                data: { q: value },
                onSuccess: () => setFetching(false),
            });
        }, 300);
    };

    const onSelect = (
        selectedSearch: string,
        options?: { force?: boolean },
    ) => {
        const trimmed = (selectedSearch ?? '').trim();
        if (options?.force && trimmed.length === 0) {
            const url = new URL(window.location.href);
            url.searchParams.delete('q');
            router.visit(url.toString(), { replace: true });
            setSearch('');
            return;
        }
        if (trimmed.length === 0) return;
        setSearch('');
        router.reload({ data: { q: trimmed } });
    };

    return (
        <>
            <Head title={t('Database')} />
            <StickyBar className="header-search z-25 mb-4">
                <div className="hidden sm:block">
                    <ViewModeToggle
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        pageKey="dbProducts"
                        modes={['table', 'list']}
                        mobileMenuModes={['list']}
                    />
                </div>
                <SearchSelect
                    className="w-auto flex-1"
                    value={search}
                    onChange={handleSearch}
                    onSubmit={onSelect}
                    propositions={searchPropositions}
                    loading={fetching}
                    count={collection.meta.total}
                    compactMobile
                    query={q ?? ''}
                />
                <ButtonsActions
                    add={() => router.visit(dbProducts.create().url)}
                />
            </StickyBar>

            <InfiniteScroll data="collection">
                {viewMode === 'table' ? (
                    <div className="hidden sm:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <SortableTableHead field="id">
                                        ID
                                    </SortableTableHead>
                                    <SortableTableHead field="country">
                                        {t('Country')}
                                    </SortableTableHead>
                                    <SortableTableHead field="name">
                                        {t('Name')}
                                    </SortableTableHead>
                                    <TableHead>{t('Description')}</TableHead>
                                    <TableHead>{t('maj')}</TableHead>
                                    <TableHead className="text-end">
                                        {t('Actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {collection.data.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{item.id}</TableCell>
                                        <TableCell>
                                            {item.country ? (
                                                <CountryFlag
                                                    countryCode={item.country}
                                                    title={item.country}
                                                    className="w-4"
                                                />
                                            ) : (
                                                ''
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {item.abilities?.update ? (
                                                <Link
                                                    href={
                                                        dbProducts.edit(item.id)
                                                            .url
                                                    }
                                                    className="font-medium hover:underline"
                                                >
                                                    {item.name}
                                                </Link>
                                            ) : item.abilities?.billing ? (
                                                <Link
                                                    href={
                                                        dbProducts.billing(
                                                            item.id,
                                                        ).url
                                                    }
                                                    className="font-medium hover:underline"
                                                >
                                                    {item.name}
                                                </Link>
                                            ) : (
                                                <span className="font-medium">
                                                    {item.name}
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {item.description || '-'}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {item.updated_at
                                                ? new Date(
                                                      item.updated_at,
                                                  ).toLocaleDateString()
                                                : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <DbProductActions item={item} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <DbProductsMiniCards items={collection.data} />
                )}
            </InfiniteScroll>
        </>
    );
});
