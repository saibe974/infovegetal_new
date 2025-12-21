import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import categoryProducts from '@/routes/category-products';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PaginatedCollection, ProductCategory } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router, Head } from '@inertiajs/react';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
import { EditIcon, Loader2Icon, TrashIcon, ChevronDown, ChevronRight, GripVertical, SaveIcon, Undo2, Undo2Icon, RotateCcw, LoaderIcon } from 'lucide-react';
import { StickyBar } from '@/components/ui/sticky-bar';
import SearchSelect from '@/components/app/search-select';
import { useI18n } from '@/lib/i18n';
import SortableTree, { RenderItemProps } from '@/components/sortable-tree';
import { toast } from 'sonner';
import { ButtonsActions } from '@/components/buttons-actions';

type Props = {
    collection: PaginatedCollection<ProductCategory>;
    q: string | null;
    children?: ProductCategory[];
};

function uniqById(items: ProductCategory[]) {
    return Array.from(new Map(items.map((c) => [c.id, c])).values());
}

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
        const { t } = useI18n();
        const [pending, setPending] = useState<ProductCategory[] | null>(null);
        const [saving, setSaving] = useState(false);

        const page = usePage<{ searchPropositions?: string[] }>();
        const initialSearchPropositions = page.props.searchPropositions ?? [];

        const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const [fetching, setFetching] = useState(false);
        const [search, setSearch] = useState('');
        const [searchPropositionsState, setSearchPropositions] = useState<string[]>(initialSearchPropositions);

        // Fusion des données racines et des enfants du premier niveau
        // IMPORTANT: On ne recalcule cette valeur que quand les props changent du serveur
        // Le SortableTree gère les modifications locales en interne
        const allItems = useMemo(() => {
            // Enfants peuvent être une collection Inertia ({ data, links, meta })
            // On ne veut QUE children.data si présent, sinon children si déjà un tableau
            const childrenArray = Array.isArray(children)
                ? children
                : (children && Array.isArray((children as any).data)
                    ? ((children as any).data as ProductCategory[])
                    : []);

            // Filtrage strict: on garde uniquement les objets avec un id numérique
            const roots = (collection?.data ?? []).filter((x: any): x is ProductCategory => x && typeof x.id === 'number');
            const childs = (childrenArray ?? []).filter((x: any): x is ProductCategory => x && typeof x.id === 'number');

            // Regrouper les enfants par parent_id
            const byParent = new Map<number, ProductCategory[]>();
            for (const c of childs) {
                const pid = (c as any).parent_id as number | undefined;
                if (typeof pid === 'number') {
                    const arr = byParent.get(pid) ?? [];
                    arr.push(c);
                    byParent.set(pid, arr);
                }
            }

            // Intercaler: parent puis ses enfants immédiats
            const ordered: ProductCategory[] = [];
            const seenChildIds = new Set<number>();
            for (const p of roots) {
                const pDepth = typeof (p as any).depth === 'number' ? (p as any).depth : 0;
                const pNorm: ProductCategory = { ...(p as any), depth: pDepth };
                ordered.push(pNorm);
                const arr = byParent.get(p.id) ?? [];
                for (const ch of arr) {
                    const chDepth = typeof (ch as any).depth === 'number' ? (ch as any).depth : pDepth + 1;
                    const chNorm: ProductCategory = {
                        ...(ch as any),
                        depth: chDepth,
                        parent_id: (ch as any).parent_id ?? p.id,
                    };
                    ordered.push(chNorm);
                    if (typeof chNorm.id === 'number') seenChildIds.add(chNorm.id);
                }
            }

            // Enfants dont le parent n'est pas dans la page courante: on les met en fin (comportement de secours)
            for (const c of childs) {
                if (typeof c.id === 'number' && !seenChildIds.has(c.id)) {
                    ordered.push(c);
                }
            }

            const merged = uniqById(ordered);

            // console.log('allItems ordered (parent -> child interleaved):', merged);
            // if (merged.length > 0) {
            //     console.log('First item sample:', merged[0], 'has id?', merged[0].id, 'has name?', merged[0].name);
            // }
            return merged;
        }, [collection?.data, children]);  // Ne dépend QUE des props du serveur, pas de pending

        // Déterminer si il y a des changements
        const hasChanges = useMemo(() => {
            if (!pending) return false;
            return JSON.stringify(pending.map(i => ({ id: i.id, parent_id: i.parent_id }))) !==
                JSON.stringify(allItems.map(i => ({ id: i.id, parent_id: i.parent_id })));
        }, [pending, allItems]);

        // Lazy-load des enfants quand on expand
        const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set());

        // Modifier loadChildren pour tracker l'état
        const loadChildren = async (item: ProductCategory): Promise<ProductCategory[]> => {
            setLoadingItems(prev => new Set(prev).add(item.id));
            try {
                const res = await fetch(`/category-products/children?parent_id=${item.id}`);
                const data = await res.json();
                return data.data ?? [];
            } catch (e) {
                console.error('Failed to load children:', e);
                return [];
            } finally {
                setLoadingItems(prev => {
                    const next = new Set(prev);
                    next.delete(item.id);
                    return next;
                });
            }
        };

        // Rendu personnalisé de chaque item
        const renderItem = (props: RenderItemProps<ProductCategory>) => {
            const {
                item,
                depth,
                isExpanded,
                toggleExpand,
                isDragging,
                insertLine, // 'before' | 'after' | null
                isInsideTarget, // true = intention “inside”
                isOver, // survol (optionnel pour un léger highlight)
                setNodeRef,
                attributes,
                listeners,
            } = props;

            const hasValidId = !!item && typeof (item as any).id === 'number' && Number.isFinite((item as any).id);
            const displayName = (item as any)?.name ?? '(sans nom)';
            // Le serveur retourne déjà has_children
            const hasChildren = (item as any).has_children === true;
            return (
                <div
                    ref={setNodeRef}
                    className={[
                        'relative flex items-center gap-2 px-3 py-2 text-sm',
                        'border-b border-border/30 transition-colors',
                        !isDragging ? 'hover:bg-muted/50' : '',
                        isOver ? 'bg-muted/20' : '',
                        isInsideTarget ? 'bg-primary/10 ring-2 ring-primary/50 ring-offset-1' : '',
                        isDragging ? 'opacity-50' : '',
                        item.id === 1 ? 'bg-muted' : '',
                    ].join(' ')}
                    style={{
                        marginLeft: depth * 24,
                    }}
                >
                    <div className='h-6 w-6'>
                        {!isDragging && hasChildren && (
                            <button
                                type="button"
                                onClick={toggleExpand}
                                className="h-full w-full flex items-center justify-center rounded hover:bg-muted flex-shrink-0"
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                                {
                                    isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                                }
                            </button>
                        )}
                    </div>

                    <div
                        {...listeners}
                        {...attributes}
                        className="flex h-6 w-6 items-center justify-center text-muted-foreground cursor-grab flex-shrink-0"
                        aria-label="Drag"
                    >
                        <GripVertical size={14} />
                    </div>

                    <span className="truncate font-medium flex-1 flex items-center gap-2">
                        {displayName} {loadingItems.has(item.id) && <Loader2Icon size={15} className='animate-spin' />}
                    </span>

                    <div className="flex gap-2 justify-end flex-shrink-0">
                        {hasValidId && !isDragging && (
                            <>
                                <Button asChild size="icon" variant="outline">
                                    <Link href={categoryProducts.edit((item as any).id)}>
                                        <EditIcon size={16} />
                                    </Link>
                                </Button>
                                {item.id !== 1 && (
                                    <Button asChild size="icon" variant="destructive-outline">
                                        <Link href={categoryProducts.destroy((item as any).id)} onBefore={() => confirm('Are you sure?')}>
                                            <TrashIcon size={16} />
                                        </Link>
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            );
        };


        const handleTreeChange = (items: ProductCategory[], reason?: 'drag' | 'expand' | 'collapse') => {
            // Ignorer les changements d'expand/collapse (ne pas tracker comme "pending")
            if (reason === 'expand' || reason === 'collapse') return;

            // Pour les drags, mettre à jour le pending
            if (reason === 'drag') {
                // console.log('Tree changed by drag:', items);
                // if (items.length > 0) {
                //     console.log('First item after drag:', items[0], 'has id?', items[0].id, 'has name?', items[0].name);
                // }
                setPending(items);
            }
        };

        const handleSearch = (s: string) => {
            setSearch(s);
            if (timerRef.current) clearTimeout(timerRef.current);
            router.cancelAll();

            if (s.length < 2) return;

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

            if (options?.force && trimmed.length === 0) {
                const url = new URL(window.location.href);
                url.searchParams.delete('q');
                router.visit(url.toString(), { replace: true });
                setSearch('');
                return;
            }

            if (trimmed.length === 0) return;

            setSearch('');
            router.get(window.location.pathname, { q: trimmed }, { preserveState: false, replace: true, preserveScroll: false });
        };

        const save = async () => {
            if (!pending) return;

            setSaving(true);
            try {
                const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

                const payload = (() => {
                    const items = pending.map((i: ProductCategory) => ({
                        id: i.id,
                        parent_id: i.parent_id ?? null,
                        position: 0,
                    }));

                    const posByParent = new Map<number | null, number>();
                    for (const it of items) {
                        const pid = it.parent_id;
                        const pos = posByParent.get(pid) ?? 0;
                        it.position = pos;
                        posByParent.set(pid, pos + 1);
                    }

                    return { items };
                })();

                const res = await fetch(categoryProducts.reorder.url(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-CSRF-TOKEN': csrf,
                    },
                    body: JSON.stringify(payload),
                });

                if (!res.ok) throw new Error(await res.text());

                toast.success('Hiérarchie sauvegardée avec succès');
                setPending(null);
            } catch (e) {
                console.error(e);
                toast.error('Erreur lors de la sauvegarde');
            } finally {
                setSaving(false);
            }
        };

        const cancel = () => {
            setPending(null);
            // router.reload({ only: ['collection', 'children'] });
            router.reload();
        };

        return (
            <>
                <Head title="Categories" />
                <StickyBar className="mb-4">
                    <SearchSelect
                        value={search}
                        onChange={handleSearch}
                        onSubmit={onSelect}
                        propositions={searchPropositionsState}
                        loading={fetching}
                        // count={collection.meta.total}
                        count={allItems.length}
                        query={q ?? ''}
                    />

                    {/* {hasChanges && ( */}
                    <ButtonsActions
                        cancel={hasChanges ? cancel : undefined}
                        save={hasChanges ? save : undefined}
                        saving={saving}
                        add={() => { }}
                    />
                    {/* )} */}
                </StickyBar>

                {q ? (
                    <>
                        <InfiniteScroll data="collection">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <SortableTableHead field="id">ID</SortableTableHead>
                                        <SortableTableHead field="name">Name</SortableTableHead>
                                        <TableHead className="text-end">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {uniqById(collection.data).map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.id}</TableCell>
                                            <TableCell>
                                                <Link href={categoryProducts.edit(item.id)} className="hover:underline flex items-center gap-2">
                                                    <span style={{ marginLeft: `${(item.depth || 0) * 24}px` }} className="flex items-center gap-2">
                                                        {item.depth && item.depth > 0 && <span className="text-muted-foreground">↳</span>}
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
                                                        <Link href={categoryProducts.destroy(item.id)} onBefore={() => confirm('Are you sure?')}>
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

                        {collection.meta.current_page < collection.meta.last_page && (
                            <div className="w-full h-50 flex items-center justify-center mt-4">
                                <Loader2Icon size={50} className="animate-spin text-main-purple dark:text-main-green" />
                            </div>
                        )}
                    </>
                ) : (
                    // <div className="">

                    <div className="border rounded-md overflow-hidden">
                        <SortableTree
                            items={allItems}
                            idKey="id"
                            parentKey="parent_id"
                            depthKey="depth"
                            loadChildren={loadChildren}
                            onChange={handleTreeChange}
                            renderItem={renderItem}
                        />
                    </div>

                    // </div>
                )}
            </>
        );
    },
);
