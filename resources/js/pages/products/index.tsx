import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { useRef, useState } from 'react';
import { SharedData, type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UploadIcon, EditIcon, TrashIcon } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
import SearchSoham from '@/components/ui/searchSoham';
import { CsvUploadButton } from '@/components/csv-upload-button';
import { isAdmin, hasPermission } from '@/lib/roles';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

type Props = {
    collection: PaginatedCollection<Product>;
    q: string | null;
};

export default withAppLayout(breadcrumbs, ({ collection, q }: Props) => {
    // console.log(collection)
    const { auth, locale } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;
    const canEdit = isAdmin(user) || hasPermission(user, 'edit products');
    const canDelete = isAdmin(user) || hasPermission(user, 'delete products');
    const canImportExport = isAdmin(user) || hasPermission(user, 'import products') || hasPermission(user, 'export products');

    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const handleSearch = (s: string) => {
        setSearch(s);
        // @ts-ignore
        clearTimeout(timerRef.current);
        router.cancelAll();
        if (s.length < 2) {
            return;
        }
        setFetching(true);
        timerRef.current = setTimeout(() => {
            router.reload({
                only: ['searchPropositions'],
                data: { q: s },
                onSuccess: () => setFetching(false),
                // preserveState: true,
            })
        }, 300)
    }

    // @ts-ignore
    const onSelect = (mysearch: string, options?: { force?: boolean }) => {
        const trimmed = (mysearch ?? '').trim();
        // If explicit clear requested, remove q from URL instead of setting q=""
        if (options?.force && trimmed.length === 0) {
            const url = new URL(window.location.href);
            url.searchParams.delete('q');
            router.visit(url.toString(), { replace: true });
            setSearch('');
            return;
        }

        // Otherwise ignore empty submissions
        if (trimmed.length === 0) {
            return;
        }

        setSearch('');
        router.reload({
            data: { q: trimmed },
        })

        console.log("selected:", trimmed);
    };

    // console.log(productsSearch);

    return (
        <div>
            {/* @ts-ignore */}
            <BasicSticky stickyClassName="bg-background" className="relative z-20">
                <div className="flex items-center py-2 relative w-full">
                    <div className="w-200 left-0 top-1 mr-2" >
                        <SearchSoham
                            value={search}
                            onChange={handleSearch}
                            onSubmit={onSelect}
                            propositions={searchPropositions}
                            loading={fetching}
                            count={collection.meta.total}
                            query={q ?? ''}
                        />
                    </div>

                    {canImportExport && (
                        <div className="ml-auto flex items-center gap-2">
                            <CsvUploadButton config={{
                                type: 'products',
                                title: 'Import CSV',
                                description: 'Importez un fichier CSV pour créer/mettre à jour vos produits (~100/s)',
                                uploadUrl: '/admin/products/import/upload',
                                processUrl: '/admin/products/import/process',
                                cancelUrl: '/admin/products/import/cancel',
                                progressUrl: (id) => `/admin/products/import/progress/${id}`,
                                reportUrl: (id) => `/admin/products/import/report/${id}`,
                                successRedirectUrl: products.admin.index().url,
                                buttonLabel: 'Importer'
                            }} />
                            <DownloadCsvButton />
                        </div>
                    )}
                </div>
            </BasicSticky>

            <InfiniteScroll data="collection">
                <Table >
                    <TableHeader>
                        <TableRow>
                            <SortableTableHead field="id">ID</SortableTableHead>
                            <TableHead></TableHead>
                            <SortableTableHead field="name">Name</SortableTableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Price</TableHead>
                            {(canEdit || canDelete) && <TableHead className='text-end'>Actions</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {collection.data.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>
                                    {item.img_link &&
                                        <img src={item.img_link} className="w-20 object-cover" />
                                    }
                                </TableCell>
                                <TableCell>
                                    <Link
                                        href={canEdit ? products.admin.edit(item.id) : products.show(item.id)}
                                        className="hover:underline"
                                    >
                                        {item.name}
                                    </Link>
                                </TableCell>                                <TableCell>{item.category ? item.category.name : ''}</TableCell>
                                <TableCell>
                                    <div className="space-y-2">
                                        <div>{item.description}</div>
                                        {item.tags && item.tags.length > 0 ? (
                                            <div className="flex flex-wrap gap-1.5 pt-1">
                                                {item.tags.map((tag) => (
                                                    <Badge key={tag.id} variant="secondary">
                                                        {tag.name}
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </TableCell>
                                <TableCell>{item.price}</TableCell>
                                {(canEdit || canDelete) && (
                                    <TableCell>
                                        <div className="flex gap-2 justify-end">
                                            {canEdit && (
                                                <Button asChild size="icon" variant="outline">
                                                    <Link href={products.admin.edit(item.id)}>
                                                        <EditIcon size={16} />
                                                    </Link>
                                                </Button>
                                            )}
                                            {canDelete && (
                                                <Button asChild size="icon" variant="destructive-outline">
                                                    <Link href={products.admin.destroy(item.id)}
                                                        onBefore={() => confirm('Are you sure?')}>
                                                        <TrashIcon size={16} />
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>

                </Table>
            </InfiniteScroll>
        </div>

    )
})

function DownloadCsvButton() {
    return (
        <a href="/admin/products/export" className="clickable inline-flex items-center border px-3 py-1 rounded text-sm">
            <UploadIcon />
        </a>
    );
}

