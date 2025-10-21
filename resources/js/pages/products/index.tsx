import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Form, Link, InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EditIcon, TrashIcon } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
import { useForm } from '@inertiajs/react';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandLoading,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import SearchSoham from '@/components/ui/searchSoham';

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
    const page = usePage<{ search: Product[] }>();
    const productsSearch = page.props.search ?? [{ data: [] }];
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
                only: ['search'],
                data: { q: s },
                onSuccess: () => setFetching(false),
                // preserveState: true,
            })
        }, 300)
    }

    // @ts-ignore
    const onSelect = (mysearch) => {
        setSearch('');
        // products.index().url.q = mysearch;
        // router.visit(products.index().url);
        router.reload({
            data: { q: mysearch },
        })

        console.log("selected:", mysearch);
        // console.log(router);
    };

    // console.log(productsSearch);

    return (
        <div>
            {/* @ts-ignore */}
            <BasicSticky stickyClassName='z-50 bg-background' className="relative z-100">
                <div className="flex items-center py-2 relative w-full">
                    {/* <Form href={products.index().url} className="flex gap-1 items-center">
                        <Input autoFocus placeholder='Rechercher un produit' name='q' defaultValue={q ?? ''} />
                        <Button>Rechercher</Button>
                    </Form> */}



                    <div className="w-200 left-0 top-1 z-100" >
                        {/* <SearchSoham
                            search={search}
                            fetching={fetching}
                            handleSearch={handleSearch}
                            productsSearch={productsSearch}
                            onSelect={onSelect}
                        /> */}
                        <SearchSoham
                            value={search}
                            onChange={handleSearch}
                            onSubmit={onSelect}
                            suggestions={productsSearch}
                            loading={fetching}
                        />
                    </div>

                    <div className="mx-4 opacity-50">
                        {collection.meta.total > 1 ? collection.meta.total + " occurences" :
                            collection.meta.total == 0 ? "aucun résultat" : ""}
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <DownloadCsvButton />
                        <UploadCsvButton />
                    </div>
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
                            <TableHead className='text-end'>Actions</TableHead>
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
                                    <Link href={products.edit(item.id)} className="hover:underline">
                                        {item.name}
                                    </Link>
                                </TableCell>

                                <TableCell>{item.category ? item.category.name : ''}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{item.price}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2 justify-end">
                                        <Button asChild size="icon" variant="outline">
                                            <Link href={products.edit(item.id)}>
                                                <EditIcon size={16} />
                                            </Link>
                                        </Button>
                                        <Button asChild size="icon" variant="destructive-outline">
                                            <Link href={products.destroy(item.id)}
                                                onBefore={() => confirm('Are you sure?')}>
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
        </div>

    )
})

function DownloadCsvButton() {
    return (
        <a href="/products/export" className="inline-flex items-center border px-3 py-1 rounded text-sm hover:bg-gray-100">
            Télécharger CSV
        </a>
    );
}

function UploadCsvButton() {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const { data, setData, post, processing } = useForm({ file: null });

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setData('file', file as any);
        if (file) {
            const form = new FormData();
            form.append('file', file);
            // post to a backend endpoint; if you have a named route for import, change the URL
            post('/products/import', {
                forceFormData: true,
                onFinish: () => {
                    // optional: reload page after import
                    window.location.reload();
                }
            });
        }
    };

    return (
        <>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center border px-3 py-1 rounded text-sm hover:bg-gray-100" disabled={processing}>
                {processing ? 'Uploading...' : 'Importer CSV'}
            </button>
        </>
    );
}

