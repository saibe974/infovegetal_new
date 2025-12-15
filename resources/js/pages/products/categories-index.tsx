import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import categoryProducts from '@/routes/category-products';
import { useEffect, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection, ProductCategory } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
import { EditIcon, Loader2Icon, TrashIcon, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { StickyBar } from '@/components/ui/sticky-bar';
import SearchSelect from '@/components/app/search-select';
import { useI18n } from '@/lib/i18n';
import SortableTree, { MovePayload } from '@/components/sortable-tree';
import { toast } from 'sonner';

type Props = {
    collection: PaginatedCollection<ProductCategory>;
    q: string | null;
    children?: ProductCategory[];
};

export default withAppLayout(
    () => {
        const { t } = useI18n();
        return [
            { title: t('Products'), href: products.index().url },
            { title: t('Categories'), href: categoryProducts.index().url },
        ];
    },
    true,
    ({ collection, q, children }: Props) => {
        const [pending, setPending] = useState<ProductCategory[] | null>(null);
        const [saving, setSaving] = useState(false);
        const hasChanges = Array.isArray(pending) && pending.length > 0;
        const page = usePage<{ searchPropositions?: string[] }>();
        const searchPropositions = page.props.searchPropositions ?? [];
        // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
        const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const [fetching, setFetching] = useState(false);
        const [search, setSearch] = useState('');
        const [searchPropositionsState, setSearchPropositions] = useState<string[]>(searchPropositions ?? []);

        const handleSearch = (s: string) => {
            setSearch(s);
            // @ts-ignore
            clearTimeout(timerRef.current);
            router.cancelAll();
            if (s.length < 2) {
                return;
            }
            setFetching(true);
            timerRef.current = setTimeout(async () => {
                try {
                    const res = await fetch(`/search-propositions?context=categories&q=${encodeURIComponent(s)}&limit=10`);
                    const json = await res.json();
                    setSearchPropositions((json.propositions || []) as string[]);
                } finally {
                    setFetching(false);
                }
            }, 300);
        };

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
            // Validation: navigation complète pour réactualiser la page
            router.get(window.location.pathname, { q: trimmed }, {
                preserveState: false,
                replace: true,
                preserveScroll: false,
            });

            // console.log("selected:", trimmed);
        };

        return (
            <div>
                {/* @ts-ignore */}
                <StickyBar
                    className='mb-4'
                >
                    <div className="flex items-center py-2 relative w-full">

                        <div className="w-200 left-0 top-1 z-100 mr-2" >
                            <SearchSelect
                                value={search}
                                onChange={handleSearch}
                                onSubmit={onSelect}
                                propositions={searchPropositionsState}
                                loading={fetching}
                                count={collection.meta.total}
                                query={q ?? ''}
                            />
                        </div>


                        {/* <div className="ml-auto flex items-center gap-2">
                        <DownloadCsvButton />
                        <UploadCsvButton />
                    </div> */}
                    </div>
                </StickyBar>

                {q ? (
                    // Mode recherche : affichage classique avec InfiniteScroll
                    // à redéfinir en composant table-hiearchable
                    <>
                        <InfiniteScroll data="collection">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableTableHead field="id">ID</SortableTableHead>
                                        <SortableTableHead field="name">Name</SortableTableHead>
                                        <TableHead className='text-end'>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Array.from(new Map(collection.data.map((item) => [item.id, item])).values()).map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.id}</TableCell>
                                            <TableCell>
                                                <Link href={categoryProducts.edit(item.id)} className="hover:underline flex items-center gap-2">
                                                    <span style={{ marginLeft: `${(item.depth || 0) * 24}px` }} className="flex items-center gap-2">
                                                        {item.depth && item.depth > 0 && (
                                                            <span className="text-muted-foreground">↳</span>
                                                        )}
                                                        {item.name}
                                                    </span>
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-2 justify-end">
                                                    <Button asChild size="icon" variant="outline">
                                                        <Link href={categoryProducts.edit(item.id)}>
                                                            <EditIcon size={16} />
                                                        </Link>
                                                    </Button>
                                                    <Button asChild size="icon" variant="destructive-outline">
                                                        <Link href={categoryProducts.destroy(item.id)}
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

                        {collection.meta.current_page < collection.meta.last_page &&
                            <div className='w-full h-50 flex items-center justify-center mt-4'>
                                <Loader2Icon size={50} className='animate-spin text-main-purple dark:text-main-green' />
                            </div>
                        }
                    </>
                ) : (
                    <div className="space-y-2">
                        {hasChanges && (
                            <div className="mb-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded flex items-center justify-between">
                                <span className="text-sm">Vous avez des modifications non sauvegardées</span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => { setPending(null); router.reload({ only: ['collection', 'children'] }); }}
                                        disabled={saving}
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={async () => {
                                            if (!pending) return;
                                            setSaving(true);
                                            try {
                                                const csrf = document.querySelector('meta[name=\"csrf-token\"]')?.getAttribute('content') || '';
                                                const payload = { items: pending.map(i => ({ id: i.id, parent_id: i.parent_id ?? null })) };
                                                const res = await fetch(categoryProducts.reorder.url(), {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-TOKEN': csrf },
                                                    body: JSON.stringify(payload),
                                                });
                                                if (!res.ok) throw new Error(await res.text());
                                                toast.success('Hiérarchie sauvegardée avec succès');
                                                setPending(null);
                                                router.reload({ only: ['collection', 'children'] });
                                            } catch (e) {
                                                console.error(e);
                                                toast.error('Erreur lors de la sauvegarde');
                                            } finally {
                                                setSaving(false);
                                            }
                                        }}
                                        disabled={saving}
                                    >
                                        {saving ? 'Sauvegarde…' : 'Sauvegarder'}
                                    </Button>
                                </div>
                            </div>
                        )}
                        <SortableTree<ProductCategory>
                            items={Array.from(new Map([...(collection?.data ?? []), ...(children ?? [])].map(c => [c.id, c])).values())}
                            maxDepth={3}
                            autoSave={false}
                            onChange={(next) => setPending(next)}
                            loadChildren={async (item) => {
                                const url = categoryProducts.children.url({ query: { parent_id: item.id } });
                                const res = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                                const json = await res.json();
                                const data: ProductCategory[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
                                return data;
                            }}
                            renderItem={({ item, depth, isExpanded, isLoading, attributes, listeners, setNodeRef, toggleExpand }) => (
                                <div ref={setNodeRef} className={`flex items-center justify-between rounded border bg-background px-2 py-1 ${depth > 0 ? 'bg-muted/30' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <button className="cursor-grab active:cursor-grabbing hover:bg-accent rounded p-1" {...attributes} {...listeners}>
                                            <GripVertical size={16} className="text-muted-foreground" />
                                        </button>
                                        <div className="flex items-center" aria-hidden>
                                            {Array.from({ length: Math.max(0, depth) }).map((_, i) => (
                                                <span key={i} className="w-6 h-6 mr-1 border-muted-foreground/40" />
                                            ))}
                                        </div>
                                        {depth > 0 && (
                                            <span className="w-4 h-4 mr-1 relative" aria-hidden>
                                                <svg viewBox="0 0 8 8" className="absolute inset-0 text-muted-foreground/60" width="16" height="16">
                                                    <path d="M1 0 v7 h7" fill="none" stroke="currentColor" strokeWidth="1" />
                                                </svg>
                                            </span>
                                        )}
                                        <button className="hover:underline flex items-center gap-1" onClick={(e) => { e.preventDefault(); toggleExpand(); }}>
                                            <span>{item.name}</span>
                                            {(item as any).has_children && (
                                                isExpanded ? (
                                                    isLoading ? (
                                                        <Loader2Icon size={14 + Math.min(6, depth * 2)} className="animate-spin text-muted-foreground" />
                                                    ) : (
                                                        <ChevronDown size={14 + Math.min(6, depth * 2)} className="text-muted-foreground" />
                                                    )
                                                ) : (
                                                    <ChevronRight size={14 + Math.min(6, depth * 2)} className="text-muted-foreground" />
                                                )
                                            )}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button asChild size="icon" variant="outline">
                                            <Link href={categoryProducts.edit(item.id)}>
                                                <EditIcon size={16} />
                                            </Link>
                                        </Button>
                                        <Button asChild size="icon" variant="destructive-outline">
                                            <Link href={categoryProducts.destroy(item.id)} onBefore={() => confirm('Are you sure?')}>
                                                <TrashIcon size={16} />
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        />
                        {collection.meta && collection.meta.current_page < collection.meta.last_page && (
                            <div className='w-full h-50 flex items-center justify-center mt-4'>
                                <Loader2Icon size={50} className='animate-spin text-main-purple dark:text-main-green' />
                            </div>
                        )}
                    </div>
                )}
            </div>

        )
    })

