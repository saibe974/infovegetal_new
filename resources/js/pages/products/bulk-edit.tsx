import { BadgeMultiSelect } from '@/components/ui/badge-multi-select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { SelectWithItems } from '@/components/ui/select-with-items';
import { StickyBar } from '@/components/ui/sticky-bar';
import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import type { BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeftCircle,
    Camera,
    CameraOff,
    Diameter,
    Eye,
    EyeOff,
    FolderTree,
    Globe,
    Info,
    MoveVertical,
    SaveIcon,
    SearchIcon,
    ShoppingCart,
    Sprout,
    TriangleAlert,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';

type Props = {
    selection: string;
    total: number;
    returnUrl: string;
    filterSummary: { label: string; value: string }[];
    categories: { id: number; name: string; parent_id: number | null }[];
    tagOptions: string[];
};

const fields = {
    name: { label: 'Nom', type: 'text', clear: false },
    description: { label: 'Description', type: 'textarea', clear: true },
    category_products_id: { label: 'Catégorie', type: 'category', clear: true },
    active: { label: 'Statut', type: 'boolean', clear: false },
    pot: { label: 'Pot (cm)', type: 'number', clear: true },
    height: { label: 'Hauteur (cm)', type: 'text', clear: true },
    cond: { label: 'Conditionnement', type: 'integer', clear: true },
    floor: { label: 'Quantité par étage', type: 'integer', clear: true },
    roll: { label: 'Quantité par roll', type: 'integer', clear: true },
    price: { label: 'Prix', type: 'number', clear: false },
    price_floor: { label: 'Prix étage', type: 'number', clear: true },
    price_roll: { label: 'Prix roll', type: 'number', clear: true },
    price_promo: { label: 'Prix promotionnel', type: 'number', clear: true },
    available_from: {
        label: 'Disponible à partir du',
        type: 'datetime-local',
        clear: true,
    },
    available_until: {
        label: 'Disponible jusqu’au',
        type: 'datetime-local',
        clear: true,
    },
} as const;
type FieldKey = keyof typeof fields;
type Mode = 'keep' | 'set' | 'clear';
const modifiedFieldClass =
    'rounded-md border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-950/20';
const filterIcons: Record<string, LucideIcon> = {
    Recherche: SearchIcon,
    Statut: Eye,
    Catégorie: FolderTree,
    Pays: Globe,
    Pot: Diameter,
    Hauteur: MoveVertical,
    Producteur: Sprout,
    Image: Camera,
    Promotion: Zap,
    Panier: ShoppingCart,
};
const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Products', href: products.index().url },
    { title: 'Modification en masse', href: '#' },
];

export default withAppLayout<Props>(
    breadcrumbs,
    false,
    ({
        selection,
        total,
        returnUrl,
        filterSummary = [],
        categories,
        tagOptions,
    }) => {
        const [modes, setModes] = useState<Partial<Record<FieldKey, Mode>>>({});
        const [values, setValues] = useState<Partial<Record<FieldKey, string>>>(
            { active: '1' },
        );
        const {
            data,
            setData,
            transform,
            put,
            processing,
            errors,
            setError,
            clearErrors,
        } = useForm({
            selection,
            changes: {} as Record<string, string | boolean | null>,
            tags_mode: 'keep' as 'keep' | 'add' | 'remove',
            tags: [] as string[],
        });
        const formErrors = errors as Record<string, string>;
        const changedFields = (Object.keys(fields) as FieldKey[]).filter(
            (key) => modes[key] && modes[key] !== 'keep',
        );
        const hasChanges =
            changedFields.length > 0 || data.tags_mode !== 'keep';
        const categoriesById = new Map(
            categories.map((category) => [category.id, category]),
        );
        const categoryItems = categories.map((category) => {
            let parentId = category.parent_id;
            let depth = 0;
            const visited = new Set([category.id]);
            while (parentId !== null && !visited.has(parentId)) {
                visited.add(parentId);
                const parent = categoriesById.get(parentId);
                if (!parent) break;
                depth++;
                parentId = parent.parent_id;
            }
            return { value: String(category.id), label: category.name, depth };
        });

        const submit = (event: FormEvent) => {
            event.preventDefault();
            if (
                modes.category_products_id === 'set' &&
                !values.category_products_id
            ) {
                setError('changes', 'Choisissez une catégorie à appliquer.');
                return;
            }
            clearErrors();
            const changes: Record<string, string | boolean | null> = {};
            for (const key of changedFields) {
                changes[key] =
                    modes[key] === 'clear'
                        ? null
                        : key === 'active'
                          ? values.active === '1'
                          : (values[key] ?? '');
            }
            transform((payload) => ({
                ...payload,
                changes,
                tags: payload.tags_mode === 'keep' ? [] : payload.tags,
            }));
            put(products.admin.bulkUpdate.url());
        };

        const fieldLabel = (label: string, modified: boolean) => (
            <span className="flex items-center gap-1.5">
                {label}
                {modified && (
                    <span
                        title={`Cette modification s’appliquera aux ${total} produit(s) du lot.`}
                    >
                        <TriangleAlert
                            className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                            aria-hidden="true"
                        />
                        <span className="sr-only">
                            Modification appliquée à {total} produit(s) du lot.
                        </span>
                    </span>
                )}
            </span>
        );

        const renderField = (key: FieldKey) => {
            const field = fields[key];
            const mode = modes[key] ?? 'keep';
            const disabled = processing || mode !== 'set';
            const id = 'bulk-' + key;
            const placeholder = mode === 'clear' ? 'Valeur supprimée' : '';
            const changeValue = (value: string) =>
                setValues((current) => ({ ...current, [key]: value }));
            return (
                <FormField
                    key={key}
                    label={fieldLabel(field.label, mode !== 'keep')}
                    className={mode !== 'keep' ? modifiedFieldClass : undefined}
                    htmlFor={mode === 'set' ? id : id + '-mode'}
                    error={formErrors['changes.' + key]}
                >
                    <div className="space-y-2">
                        <SelectWithItems
                            id={id + '-mode'}
                            name={key + '_mode'}
                            className="w-full"
                            aria-label={
                                'Action sur ' + field.label.toLowerCase()
                            }
                            disabled={processing}
                            defaultValue={mode}
                            items={[
                                { value: 'keep', label: 'Ne pas modifier' },
                                { value: 'set', label: 'Définir une valeur' },
                                ...(field.clear
                                    ? [
                                          {
                                              value: 'clear',
                                              label: 'Supprimer la valeur',
                                          },
                                      ]
                                    : []),
                            ]}
                            onValueChange={(value) =>
                                setModes((current) => ({
                                    ...current,
                                    [key]: value as Mode,
                                }))
                            }
                        />
                        {mode === 'set' &&
                            (field.type === 'category' ? (
                                <SelectWithItems
                                    id={id}
                                    name={key}
                                    className="w-full"
                                    disabled={disabled}
                                    items={categoryItems}
                                    defaultValue={
                                        mode === 'set' ? values[key] : undefined
                                    }
                                    placeholder={
                                        mode === 'set'
                                            ? 'Choisir une catégorie'
                                            : placeholder
                                    }
                                    onValueChange={changeValue}
                                    aria-invalid={
                                        !!formErrors['changes.' + key]
                                    }
                                />
                            ) : field.type === 'boolean' ? (
                                <SelectWithItems
                                    id={id}
                                    name={key}
                                    className="w-full"
                                    disabled={disabled}
                                    items={[
                                        { value: '1', label: 'Actif' },
                                        { value: '0', label: 'Inactif' },
                                    ]}
                                    defaultValue={
                                        mode === 'set'
                                            ? values.active
                                            : undefined
                                    }
                                    placeholder={placeholder}
                                    onValueChange={changeValue}
                                />
                            ) : field.type === 'textarea' ? (
                                <textarea
                                    id={id}
                                    rows={3}
                                    required={!disabled}
                                    disabled={disabled}
                                    value={
                                        mode === 'set'
                                            ? (values[key] ?? '')
                                            : ''
                                    }
                                    placeholder={
                                        mode === 'set'
                                            ? 'Décrire les produits'
                                            : placeholder
                                    }
                                    onChange={(event) =>
                                        changeValue(event.target.value)
                                    }
                                    aria-invalid={
                                        !!formErrors['changes.' + key]
                                    }
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                />
                            ) : (
                                <Input
                                    id={id}
                                    required={!disabled}
                                    disabled={disabled}
                                    type={
                                        field.type === 'integer'
                                            ? 'number'
                                            : field.type
                                    }
                                    min={
                                        field.type === 'number' ||
                                        field.type === 'integer'
                                            ? 0
                                            : undefined
                                    }
                                    step={
                                        field.type === 'integer'
                                            ? 1
                                            : field.type === 'number'
                                              ? 'any'
                                              : undefined
                                    }
                                    value={
                                        mode === 'set'
                                            ? (values[key] ?? '')
                                            : ''
                                    }
                                    placeholder={
                                        mode === 'set'
                                            ? key === 'height'
                                                ? '30 ou 30-40'
                                                : undefined
                                            : placeholder
                                    }
                                    onChange={(event) =>
                                        changeValue(event.target.value)
                                    }
                                    aria-invalid={
                                        !!formErrors['changes.' + key]
                                    }
                                />
                            ))}
                        {mode === 'clear' && (
                            <p className="text-xs text-muted-foreground">
                                Cette valeur sera supprimée des produits
                                concernés.
                            </p>
                        )}
                    </div>
                </FormField>
            );
        };

        return (
            <form onSubmit={submit} className="m-0 space-y-6 p-0 pb-8">
                <Head title="Modification en masse des produits" />
                <StickyBar className="w-full" borderBottom={false}>
                    <div className="flex w-full flex-wrap items-center justify-between gap-3 py-2">
                        <div className="flex items-center gap-2">
                            <Link
                                href={returnUrl}
                                aria-label="Retour aux produits"
                                className="transition-colors duration-200 hover:text-gray-500"
                            >
                                <ArrowLeftCircle size={35} />
                            </Link>
                            <h1 className="text-xl font-semibold">
                                Modifier les produits filtrés
                            </h1>
                        </div>
                        <Button
                            type="submit"
                            disabled={processing || !total || !hasChanges}
                        >
                            <SaveIcon className="mr-2 size-4" />
                            {processing
                                ? 'Modification en cours…'
                                : 'Appliquer à ' + total + ' produit(s)'}
                        </Button>
                    </div>
                </StickyBar>
                {Object.keys(formErrors).length > 0 && (
                    <div
                        role="alert"
                        className="rounded-md border border-destructive/30 p-4 text-sm text-destructive"
                    >
                        {Object.entries(formErrors).map(([key, message]) => (
                            <p key={key}>{message}</p>
                        ))}
                    </div>
                )}
                <div className="grid items-start gap-8 xl:grid-cols-[2fr_1fr]">
                    <main className="space-y-6">
                        <Card className="space-y-4 p-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                {renderField('name')}
                            </div>
                            {renderField('description')}
                            {renderField('category_products_id')}
                            <FormField
                                label={fieldLabel(
                                    'Tags',
                                    data.tags_mode !== 'keep',
                                )}
                                className={
                                    data.tags_mode !== 'keep'
                                        ? modifiedFieldClass
                                        : undefined
                                }
                                htmlFor={
                                    data.tags_mode === 'keep'
                                        ? 'bulk-tags-mode'
                                        : 'bulk-tags'
                                }
                                error={
                                    formErrors.tags ||
                                    Object.entries(formErrors).find(([key]) =>
                                        key.startsWith('tags.'),
                                    )?.[1]
                                }
                            >
                                <div className="space-y-2">
                                    <SelectWithItems
                                        id="bulk-tags-mode"
                                        name="tags_mode"
                                        className="w-full"
                                        aria-label="Action sur les tags"
                                        disabled={processing}
                                        defaultValue={data.tags_mode}
                                        items={[
                                            {
                                                value: 'keep',
                                                label: 'Ne pas modifier',
                                            },
                                            {
                                                value: 'add',
                                                label: 'Ajouter des tags',
                                            },
                                            {
                                                value: 'remove',
                                                label: 'Supprimer des tags',
                                            },
                                        ]}
                                        onValueChange={(value) =>
                                            setData(
                                                'tags_mode',
                                                value as typeof data.tags_mode,
                                            )
                                        }
                                    />
                                    {data.tags_mode !== 'keep' && (
                                        <BadgeMultiSelect
                                            id="bulk-tags"
                                            value={data.tags}
                                            onChange={(tags) =>
                                                setData('tags', tags)
                                            }
                                            options={Array.from(
                                                new Set([
                                                    ...tagOptions,
                                                    ...data.tags,
                                                ]),
                                            ).map((name) => ({
                                                value: name,
                                                label: name,
                                            }))}
                                            allowCreate={
                                                data.tags_mode === 'add'
                                            }
                                            placeholder={
                                                data.tags_mode === 'add'
                                                    ? 'Choisir ou créer des tags'
                                                    : 'Choisir les tags à supprimer'
                                            }
                                        />
                                    )}
                                    {data.tags_mode !== 'keep' && (
                                        <p className="text-xs text-muted-foreground">
                                            {data.tags_mode === 'add'
                                                ? 'Les tags choisis seront ajoutés en conservant les tags existants.'
                                                : 'Seuls les tags choisis seront retirés. Les autres tags seront conservés.'}
                                        </p>
                                    )}
                                </div>
                            </FormField>
                        </Card>
                        <Card className="space-y-4 p-4">
                            <h2 className="text-sm font-semibold text-muted-foreground">
                                Dimensions et conditionnement
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2">
                                {renderField('pot')}
                                {renderField('height')}
                            </div>
                            <div className="grid gap-4 md:grid-cols-3">
                                {renderField('cond')}
                                {renderField('floor')}
                                {renderField('roll')}
                            </div>
                        </Card>
                        <Card className="space-y-4 p-4">
                            <h2 className="text-sm font-semibold text-muted-foreground">
                                Tarification
                            </h2>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                {renderField('price')}
                                {renderField('price_floor')}
                                {renderField('price_roll')}
                                {renderField('price_promo')}
                            </div>
                        </Card>
                        <Card className="space-y-4 p-4">
                            <div>
                                <h2 className="text-sm font-semibold text-muted-foreground">
                                    Disponibilité commerciale
                                </h2>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Le produit reste administrativement actif,
                                    mais ne peut être commandé que pendant cette
                                    période.
                                </p>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                {renderField('available_from')}
                                {renderField('available_until')}
                            </div>
                        </Card>
                    </main>
                    <aside className="space-y-4">
                        <Card className="space-y-4 p-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <h2 className="text-sm font-semibold text-muted-foreground">
                                        Sélection filtrée
                                    </h2>
                                    <Popover modal={false}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-10 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-950 dark:hover:text-blue-300"
                                                aria-label="Informations sur la modification en masse"
                                                title="Informations"
                                            >
                                                <Info
                                                    className="size-6"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            align="end"
                                            className="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-sm"
                                            aria-label="Informations sur la modification en masse"
                                        >
                                            <h3 className="font-medium">
                                                Modification en masse
                                            </h3>
                                            <p className="text-muted-foreground">
                                                Le nombre de produits concernés
                                                inclut toutes les pages des
                                                résultats filtrés.
                                            </p>
                                            <p className="text-muted-foreground">
                                                Seuls les paramètres activés
                                                seront modifiés. Chaque valeur
                                                définie sera appliquée à tous
                                                les produits sélectionnés.
                                            </p>
                                            <p className="text-muted-foreground">
                                                La sélection est conservée
                                                pendant une heure à partir de
                                                l’ouverture de cette page.
                                            </p>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <p className="text-3xl font-semibold tabular-nums">
                                    {total}{' '}
                                    <span className="text-base font-normal text-muted-foreground">
                                        produit(s)
                                    </span>
                                </p>
                                {filterSummary.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {filterSummary.map((filter) => {
                                            const Icon =
                                                filter.label === 'Image' &&
                                                filter.value === 'Sans image'
                                                    ? CameraOff
                                                    : filter.label ===
                                                            'Statut' &&
                                                        filter.value ===
                                                            'Inactifs'
                                                      ? EyeOff
                                                      : filterIcons[
                                                            filter.label
                                                        ];
                                            return (
                                                <span
                                                    key={filter.label}
                                                    title={`${filter.label} : ${filter.value}`}
                                                    className={`flex max-w-full items-center gap-1 rounded-xl px-2 py-0.5 text-sm break-words ${filter.label === 'Image' ? 'border border-border bg-muted/70 text-foreground' : 'bg-brand-main text-white dark:text-black'}`}
                                                >
                                                    {Icon && (
                                                        <Icon
                                                            className="size-3.5 shrink-0"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    <span className="sr-only">
                                                        {filter.label} :{' '}
                                                    </span>
                                                    {filter.value}
                                                </span>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Aucun filtre : tous les produits.
                                    </p>
                                )}
                            </div>
                            {!total && (
                                <p role="status" className="text-sm">
                                    Aucun produit ne correspond aux filtres.
                                    Revenez à la liste pour les ajuster.
                                </p>
                            )}
                            {renderField('active')}
                        </Card>
                        <Card className="space-y-3 p-4">
                            <h2 className="text-sm font-semibold text-muted-foreground">
                                Modifications prévues
                            </h2>
                            {!hasChanges ? (
                                <p className="text-sm text-muted-foreground">
                                    Aucune modification sélectionnée.
                                </p>
                            ) : (
                                <ul className="space-y-2 text-sm">
                                    {changedFields.map((key) => (
                                        <li
                                            key={key}
                                            className="flex items-start justify-between gap-3"
                                        >
                                            <span>{fields[key].label}</span>
                                            <span className="text-right text-muted-foreground">
                                                {modes[key] === 'clear'
                                                    ? 'Supprimer'
                                                    : 'Modifier'}
                                            </span>
                                        </li>
                                    ))}
                                    {data.tags_mode !== 'keep' && (
                                        <li className="flex items-start justify-between gap-3">
                                            <span>Tags</span>
                                            <span className="text-right text-muted-foreground">
                                                {data.tags_mode === 'add'
                                                    ? 'Ajouter'
                                                    : 'Supprimer'}{' '}
                                                ({data.tags.length})
                                            </span>
                                        </li>
                                    )}
                                </ul>
                            )}
                        </Card>
                    </aside>
                </div>
            </form>
        );
    },
);
