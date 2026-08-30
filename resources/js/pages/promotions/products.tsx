import SearchSelect, { type Option as SearchOption } from '@/components/app/search-select';
import { PromotionProductFilters, type PromotionProductFilterValues } from '@/components/promotions/promotion-product-filters';
import { PromotionWorkspaceNav } from '@/components/promotions/promotion-workspace-nav';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { getCountryLabel, normalizeCountry } from '@/lib/country';
import { withAppLayout } from '@/layouts/app-layout';
import { type PaginatedCollection, type ProductCategory, type Promotion, type PromotionProductSelection } from '@/types';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Head, router, useForm } from '@inertiajs/react';
import { AlertCircle, Check, GripVertical, ImageOff, ListPlus, ListX, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

type Option = { id: number; name: string };

type Props = {
    promotion: Promotion;
    selectedProducts: PromotionProductSelection[];
    productOptions: PaginatedCollection<PromotionProductSelection>;
    categories: ProductCategory[];
    databaseOptions: Option[];
    categoryOptions: number[];
    countryOptions: string[];
    potOptions: string[];
    heightOptions: string[];
    maxSelectedProducts: number;
    filters: {
        q: string;
        database: string;
        category: string;
        availability: string;
        country: string[] | string | null;
        pot: string[] | string | null;
        height: string[] | string | null;
        image: string | null;
        promo: boolean;
    };
};

const normalizeMultiFilter = (value?: string[] | string | null): string[] => {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    return Array.from(new Set(values.map((item) => String(item).trim()).filter(Boolean)));
};

type SelectedProduct = PromotionProductSelection & {
    featured: boolean;
    show_before_availability: boolean;
    custom_title: string;
    custom_description: string;
};

type SelectionForm = { products: SelectedProduct[] };

const availabilityLabels = {
    available: 'Disponible',
    upcoming: 'À venir',
    ended: 'Terminé',
    inactive: 'Inactif',
} as const;

const formatAvailabilityDate = (value?: string | null) => {
    if (!value) return null;
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
};

function AvailabilityBadge({ product }: { product: PromotionProductSelection }) {
    const variant = product.availability_status === 'available'
        ? 'outline'
        : product.availability_status === 'upcoming'
            ? 'secondary'
            : 'destructive';

    return <Badge variant={variant}>{availabilityLabels[product.availability_status]}</Badge>;
}

function ProductImage({ product }: { product: PromotionProductSelection }) {
    return product.img_link ? (
        <img src={product.img_link} alt="" className="size-16 shrink-0 rounded-md border bg-white object-contain" />
    ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"><ImageOff /></div>
    );
}

function SortableSelectedProduct({
    product,
    onChange,
    onRemove,
}: {
    product: SelectedProduct;
    onChange: (changes: Partial<SelectedProduct>) => void;
    onRemove: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product.id });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`rounded-lg border bg-card p-4 shadow-sm ${isDragging ? 'z-10 opacity-70' : ''}`}
        >
            <div className="flex items-start gap-3">
                <button type="button" className="mt-5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing" {...attributes} {...listeners} aria-label={`Déplacer ${product.name}`}>
                    <GripVertical />
                </button>
                <ProductImage product={product} />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-muted-foreground">{product.ref || product.sku || `Produit ${product.id}`}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <AvailabilityBadge product={product} />
                            <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label={`Retirer ${product.name}`}><Trash2 /></Button>
                        </div>
                    </div>

                    {product.availability_status === 'upcoming' && product.available_from && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Disponible le {formatAvailabilityDate(product.available_from)}</p>
                    )}
                    {product.availability_status === 'inactive' && (
                        <p className="mt-1 text-xs text-destructive">Ce produit a été désactivé depuis son ajout. Retirez-le avant publication.</p>
                    )}

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={product.featured} onCheckedChange={(checked) => onChange({ featured: checked === true })} />
                            Mettre en avant
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={product.show_before_availability}
                                onCheckedChange={(checked) => onChange({ show_before_availability: checked === true })}
                                disabled={product.availability_status !== 'upcoming'}
                            />
                            Montrer avant sa disponibilité
                        </label>
                    </div>

                    <div className="mt-3 grid gap-3">
                        <Input value={product.custom_title} onChange={(event) => onChange({ custom_title: event.target.value })} placeholder="Titre personnalisé facultatif" />
                        <textarea
                            value={product.custom_description}
                            onChange={(event) => onChange({ custom_description: event.target.value })}
                            rows={2}
                            placeholder="Texte promotionnel facultatif"
                            className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default withAppLayout<Props>(
    [
        { title: 'Promotions', href: '/promotions' },
        { title: 'Produits', href: '/promotions' },
    ],
    false,
    ({ promotion, selectedProducts, productOptions, categories, databaseOptions, categoryOptions, countryOptions, potOptions, heightOptions, maxSelectedProducts, filters }) => {
        const initialSelection: SelectedProduct[] = selectedProducts.map((product) => ({
            ...product,
            featured: product.featured ?? false,
            show_before_availability: product.show_before_availability ?? false,
            custom_title: product.custom_title ?? '',
            custom_description: product.custom_description ?? '',
        }));
        const { data, setData, put, processing, errors, isDirty, setDefaults } = useForm<SelectionForm>({ products: initialSelection });
        const currentFilters: PromotionProductFilterValues & { q: string } = {
            q: filters.q ?? '',
            database: filters.database || 'all',
            category: filters.category || 'all',
            availability: filters.availability || 'all',
            country: normalizeMultiFilter(filters.country),
            pot: normalizeMultiFilter(filters.pot),
            height: normalizeMultiFilter(filters.height),
            image: filters.image === 'with' || filters.image === 'without' ? filters.image : 'all',
            promo: filters.promo === true,
        };
        const [search, setSearch] = useState('');
        const [searchPropositions, setSearchPropositions] = useState<Array<string | SearchOption>>([]);
        const [fetching, setFetching] = useState(false);
        const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const sensors = useSensors(
            useSensor(PointerSensor),
            useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
        );

        useEffect(() => {
            const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
                if (!isDirty) return;
                event.preventDefault();
            };
            window.addEventListener('beforeunload', warnBeforeLeaving);
            return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
        }, [isDirty]);

        const buildFilterParams = (next: PromotionProductFilterValues & { q?: string }): Record<string, string | string[] | number | undefined> => ({
            q: (next.q ?? currentFilters.q).trim() || undefined,
            database: next.database === 'all' ? undefined : next.database,
            category: next.category === 'all' ? undefined : next.category,
            availability: next.availability === 'all' ? undefined : next.availability,
            country: next.country.length > 0 ? next.country : undefined,
            pot: next.pot.length > 0 ? next.pot : undefined,
            height: next.height.length > 0 ? next.height : undefined,
            image: next.image !== 'all' ? next.image : undefined,
            promo: next.promo ? 1 : undefined,
        });

        const applyFilters = (next: PromotionProductFilterValues & { q?: string }) => {
            router.get(`/promotions/${promotion.id}/edit/products`, buildFilterParams(next), {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ['productOptions', 'filters', 'categoryOptions', 'countryOptions', 'potOptions', 'heightOptions'],
            });
        };

        const handleSearch = (value: string) => {
            setSearch(value);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            if (value.length < 2) {
                setFetching(false);
                return;
            }
            router.cancelAll();
            setFetching(true);
            timerRef.current = setTimeout(async () => {
                try {
                    const res = await fetch(`/search-propositions?context=promotion-products&q=${encodeURIComponent(value)}&limit=10`);
                    const json = await res.json();
                    setSearchPropositions((json.propositions || []) as Array<string | SearchOption>);
                } finally {
                    setFetching(false);
                }
            }, 300);
        };

        const onSubmitSearch = (value: string, options?: { force?: boolean }) => {
            const trimmed = value.trim();
            if (options?.force && trimmed.length === 0) {
                setSearch('');
                applyFilters({ ...currentFilters, q: '' });
                return;
            }
            if (trimmed.length === 0) {
                return;
            }
            setSearch('');
            applyFilters({ ...currentFilters, q: trimmed });
        };

        const handleSelectOption = (option: SearchOption) => {
            if (option.kind !== 'category' || typeof option.id !== 'number') {
                return false;
            }
            setSearch('');
            applyFilters({ ...currentFilters, category: String(option.id) });
            return true;
        };

        const removeFilter = (key: string) => {
            const next: PromotionProductFilterValues & { q: string } = { ...currentFilters };
            if (key === 'database' || key === 'category' || key === 'availability') {
                next[key] = 'all';
            } else if (key === 'country' || key === 'pot' || key === 'height') {
                next[key] = [];
            } else if (key === 'image') {
                next.image = 'all';
            } else if (key === 'promo') {
                next.promo = false;
            } else {
                return;
            }
            applyFilters(next);
        };

        const clearAllFilters = () => {
            setSearch('');
            applyFilters({ q: '', database: 'all', category: 'all', availability: 'all', country: [], pot: [], height: [], image: 'all', promo: false });
        };

        const databaseLabel = databaseOptions.find((option) => String(option.id) === currentFilters.database)?.name;
        const categoryLabel = categories.find((category) => String(category.id) === currentFilters.category)?.name;
        const singleDatabase = databaseOptions.length === 1 && currentFilters.database === 'all' ? databaseOptions[0] : null;
        const categoryChoices = categoryOptions.length > 0
            ? categories.filter((category) => categoryOptions.includes(category.id))
            : categories;
        const singleCategory = categoryChoices.length === 1 && currentFilters.category === 'all' ? categoryChoices[0] : null;
        const countries = Array.from(
            new Set(
                countryOptions
                    .map((value) => normalizeCountry(value))
                    .filter((value): value is string => Boolean(value)),
            ),
        ).sort((a, b) => a.localeCompare(b));
        const potValues = Array.from(new Set(potOptions.map((value) => String(value))))
            .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
        const heightValues = Array.from(new Set(heightOptions.map((value) => String(value))))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        const singleCountry = countries.length === 1 && currentFilters.country.length === 0 ? countries[0] : null;
        const singlePot = potValues.length === 1 && currentFilters.pot.length === 0 ? potValues[0] : null;
        const singleHeight = heightValues.length === 1 && currentFilters.height.length === 0 ? heightValues[0] : null;
        const filtersActive = ([
            currentFilters.image !== 'all'
                ? { name: 'image', label: currentFilters.image === 'with' ? 'Avec image' : 'Sans image', value: currentFilters.image }
                : null,
            currentFilters.promo ? { name: 'promo', label: 'PROMO' } : null,
            currentFilters.database !== 'all' && databaseLabel ? { name: 'database', label: databaseLabel } : null,
            currentFilters.category !== 'all' && categoryLabel ? { name: 'category', label: categoryLabel } : null,
            currentFilters.availability !== 'all'
                ? { name: 'availability', label: availabilityLabels[currentFilters.availability as keyof typeof availabilityLabels] }
                : null,
            currentFilters.country.length > 0
                ? {
                    name: 'country',
                    label: currentFilters.country.map((value) => getCountryLabel(value)).join(', '),
                    values: currentFilters.country,
                }
                : null,
            currentFilters.pot.length > 0
                ? { name: 'pot', label: `Pot : ${currentFilters.pot.join(', ')}`, values: currentFilters.pot }
                : null,
            currentFilters.height.length > 0
                ? { name: 'height', label: `Hauteur : ${currentFilters.height.join(', ')}`, values: currentFilters.height }
                : null,
        ] as Array<{ name: string; label: string; value?: string; values?: string[] } | null>)
            .filter((item): item is { name: string; label: string; value?: string; values?: string[] } => item !== null);
        const fixedFilters = ([
            singleDatabase ? { name: 'database', label: singleDatabase.name } : null,
            singleCategory ? { name: 'category', label: singleCategory.name } : null,
            singleCountry ? { name: 'country', label: getCountryLabel(singleCountry), country: singleCountry } : null,
            singlePot ? { name: 'pot', label: String(singlePot) } : null,
            singleHeight ? { name: 'height', label: String(singleHeight) } : null,
        ] as Array<{ name: string; label: string; country?: string } | null>)
            .filter((item): item is { name: string; label: string; country?: string } => item !== null);

        const addProduct = (product: PromotionProductSelection) => {
            if (data.products.some((selected) => selected.id === product.id)) return;
            if (data.products.length >= maxSelectedProducts) {
                toast.error(`La sélection ne peut pas dépasser ${maxSelectedProducts} produits.`);
                return;
            }
            setData('products', [...data.products, {
                ...product,
                featured: false,
                show_before_availability: product.availability_status === 'upcoming',
                custom_title: '',
                custom_description: '',
            }]);
        };

        const [selectingAll, setSelectingAll] = useState(false);
        const [clearDialogOpen, setClearDialogOpen] = useState(false);
        const [clearConfirmEnabled, setClearConfirmEnabled] = useState(true);

        const selectAllFiltered = async () => {
            setSelectingAll(true);
            try {
                const searchParams = new URLSearchParams();
                Object.entries(buildFilterParams(currentFilters)).forEach(([key, value]) => {
                    if (value === undefined) return;
                    if (Array.isArray(value)) {
                        value.forEach((item) => searchParams.append(`${key}[]`, item));
                    } else {
                        searchParams.set(key, String(value));
                    }
                });
                const res = await fetch(`/promotions/${promotion.id}/products/selectable?${searchParams.toString()}`);
                const json = await res.json().catch(() => null);

                if (!res.ok) {
                    toast.error(json?.message ?? 'Impossible de sélectionner tous les produits.');
                    return;
                }

                const products = (json?.products ?? []) as PromotionProductSelection[];
                const existingIds = new Set(data.products.map((selected) => selected.id));
                const missing = products.filter((product) => !existingIds.has(product.id));

                if (missing.length === 0) {
                    toast.info('Tous les produits filtrés sont déjà dans la sélection.');
                    return;
                }

                const remaining = maxSelectedProducts - data.products.length;
                const toAdd = remaining < missing.length ? missing.slice(0, Math.max(0, remaining)) : missing;

                if (toAdd.length === 0) {
                    toast.error(`La sélection est déjà au maximum (${maxSelectedProducts} produits).`);
                    return;
                }

                setData('products', [...data.products, ...toAdd.map((product) => ({
                    ...product,
                    featured: false,
                    show_before_availability: product.availability_status === 'upcoming',
                    custom_title: '',
                    custom_description: '',
                }))]);

                if (toAdd.length < missing.length) {
                    toast.warning(`${toAdd.length} produits ajoutés, sélection plafonnée à ${maxSelectedProducts}.`);
                } else {
                    toast.success(`${toAdd.length} produit${toAdd.length > 1 ? 's' : ''} ajouté${toAdd.length > 1 ? 's' : ''} à la sélection.`);
                }
            } finally {
                setSelectingAll(false);
            }
        };

        const clearSelection = () => {
            setClearDialogOpen(false);
            setData('products', []);
        };

        const requestClearSelection = () => {
            if (clearConfirmEnabled) {
                setClearDialogOpen(true);
                return;
            }
            clearSelection();
        };

        const updateProduct = (id: number, changes: Partial<SelectedProduct>) => {
            setData('products', data.products.map((product) => product.id === id ? { ...product, ...changes } : product));
        };

        const removeProduct = (id: number) => {
            setData('products', data.products.filter((product) => product.id !== id));
        };

        const handleDragEnd = ({ active, over }: DragEndEvent) => {
            if (!over || active.id === over.id) return;
            const oldIndex = data.products.findIndex((product) => product.id === active.id);
            const newIndex = data.products.findIndex((product) => product.id === over.id);
            if (oldIndex < 0 || newIndex < 0) return;
            setData('products', arrayMove(data.products, oldIndex, newIndex));
        };

        const save = () => {
            put(`/promotions/${promotion.id}/products`, {
                preserveScroll: true,
                onSuccess: () => setDefaults(),
            });
        };

        const visitOptionPage = (url: string | null) => {
            if (!url) return;
            router.visit(url, {
                preserveState: true,
                preserveScroll: true,
                only: ['productOptions', 'filters', 'categoryOptions', 'countryOptions', 'potOptions', 'heightOptions'],
            });
        };

        return (
            <>
                <Head title={`Produits — ${promotion.title}`} />

                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-semibold">{promotion.title}</h1>
                            <Badge variant="secondary">Brouillon</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Construisez et ordonnez la sélection visible sur la page et dans le mailing.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isDirty && <span className="text-sm text-amber-600">Modifications non enregistrées</span>}
                        <Button type="button" onClick={save} disabled={processing}>
                            <Check />{processing ? 'Enregistrement…' : 'Enregistrer la sélection'}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <PromotionWorkspaceNav promotionId={promotion.id} active="products" />

                    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(420px,1.1fr)]">
                        <Card className="h-fit">
                            <CardHeader className="flex-row items-center justify-between">
                                <CardTitle>Catalogue</CardTitle>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={selectAllFiltered}
                                    disabled={
                                        selectingAll
                                        || productOptions.meta.total === 0
                                        || productOptions.meta.total > maxSelectedProducts
                                        || data.products.length >= maxSelectedProducts
                                    }
                                >
                                    <ListPlus />
                                    {selectingAll ? 'Sélection…' : 'Tout sélectionner'}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <SearchSelect
                                    value={search}
                                    onChange={handleSearch}
                                    onSubmit={onSubmitSearch}
                                    onSelectOption={handleSelectOption}
                                    propositions={searchPropositions}
                                    loading={fetching}
                                    count={productOptions.meta.total}
                                    query={filters.q}
                                    placeholder="Nom, référence, SKU ou EAN"
                                    fixedFilters={fixedFilters}
                                    filters={(
                                        <PromotionProductFilters
                                            categories={categories}
                                            categoryOptions={categoryOptions}
                                            databaseOptions={databaseOptions}
                                            countryOptions={countryOptions}
                                            potOptions={potOptions}
                                            heightOptions={heightOptions}
                                            database={currentFilters.database}
                                            category={currentFilters.category}
                                            availability={currentFilters.availability}
                                            country={currentFilters.country}
                                            pot={currentFilters.pot}
                                            height={currentFilters.height}
                                            image={currentFilters.image}
                                            promo={currentFilters.promo}
                                            hideDatabase={singleDatabase !== null}
                                            hideCategory={singleCategory !== null}
                                            onApply={applyFilters}
                                        />
                                    )}
                                    filtersActive={filtersActive}
                                    removeFilter={removeFilter}
                                    clearAll={clearAllFilters}
                                />

                                {productOptions.meta.total > maxSelectedProducts && (
                                    <p className="mt-2 text-xs text-amber-600">
                                        {productOptions.meta.total} produits correspondent aux filtres. Affinez-les pour tout sélectionner (maximum {maxSelectedProducts}).
                                    </p>
                                )}

                                <div className="mt-4 space-y-2">
                                    {productOptions.data.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Aucun produit ne correspond aux filtres.</p>}
                                    {productOptions.data.map((product) => {
                                        const selected = data.products.some((item) => item.id === product.id);
                                        return (
                                            <div key={product.id} className="flex items-center gap-3 rounded-lg border p-3">
                                                <ProductImage product={product} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate font-medium">{product.name}</div>
                                                    <div className="truncate text-xs text-muted-foreground">{product.ref || product.sku || `Produit ${product.id}`}</div>
                                                    <div className="mt-1 flex flex-wrap gap-1"><AvailabilityBadge product={product} /></div>
                                                    {product.availability_status === 'upcoming' && product.available_from && (
                                                        <div className="mt-1 text-xs text-muted-foreground">À partir du {formatAvailabilityDate(product.available_from)}</div>
                                                    )}
                                                </div>
                                                <Button type="button" size="icon" variant={selected ? 'secondary' : 'outline'} disabled={selected} onClick={() => addProduct(product)} aria-label={`Ajouter ${product.name}`}>
                                                    {selected ? <Check /> : <Plus />}
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {(productOptions.links.prev || productOptions.links.next) && (
                                    <div className="mt-4 flex justify-between gap-2">
                                        <Button type="button" variant="outline" disabled={!productOptions.links.prev} onClick={() => visitOptionPage(productOptions.links.prev)}>Précédent</Button>
                                        <Button type="button" variant="outline" disabled={!productOptions.links.next} onClick={() => visitOptionPage(productOptions.links.next)}>Suivant</Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <div>
<div className="mb-3 flex items-center justify-between">
                            <h2 className="font-semibold">Sélection</h2>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline">{data.products.length} produit{data.products.length > 1 ? 's' : ''}</Badge>
                                <Button type="button" size="sm" variant="outline" disabled={data.products.length === 0} onClick={requestClearSelection}>
                                    <ListX />
                                    Tout désélectionner
                                </Button>
                            </div>
                        </div>

                            {errors.products && (
                                <Alert variant="destructive" className="mb-3">
                                    <AlertCircle />
                                    <AlertTitle>Sélection invalide</AlertTitle>
                                    <AlertDescription>{errors.products}</AlertDescription>
                                </Alert>
                            )}

                            {data.products.length === 0 ? (
                                <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">Ajoutez des produits depuis le catalogue.</div>
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                    <SortableContext items={data.products.map((product) => product.id)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-3">
                                            {data.products.map((product) => (
                                                <SortableSelectedProduct
                                                    key={product.id}
                                                    product={product}
                                                    onChange={(changes) => updateProduct(product.id, changes)}
                                                    onRemove={() => removeProduct(product.id)}
                                                />
                                            ))}
                                        </div>
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>
                    </div>
                </div>

                <ConfirmationDialog
                    open={clearDialogOpen}
                    title="Tout désélectionner ?"
                    description={`Les ${data.products.length} produits seront retirés de la sélection. Pensez à enregistrer pour appliquer ce changement.`}
                    confirmLabel="Tout désélectionner"
                    confirmationEnabled={clearConfirmEnabled}
                    onConfirmationEnabledChange={setClearConfirmEnabled}
                    onCancel={() => setClearDialogOpen(false)}
                    onConfirm={clearSelection}
                />
            </>
        );
    },
);
