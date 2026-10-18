import React, { useContext, useState } from "react";
import { Table, TableBody, TableHeader, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { router, usePage } from '@inertiajs/react';
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CircleSlash2, EditIcon, MoveVertical, Settings2, Sprout, TrashIcon, Zap } from 'lucide-react';
import { type Product, PaginatedCollection, SharedData } from '@/types';
import { useI18n } from "@/lib/i18n";
import { CartContext } from "../cart/cart.context";
import { addCartonIcon, addEtageIcon, addRollIcon } from "@/lib/icon";
import { resolveProductPrices } from "@/lib/resolve-product-prices";
import { formatCurrency } from '@/lib/utils';
import { CountryFlag } from '@/components/ui/country-flag';
import { useCartAutoOpen } from '@/components/cart/use-cart-auto-open';

type OptionalColumn = 'ref' | 'image' | 'name' | 'producer' | 'potHeight' | 'price' | 'actions';
type ColumnVisibility = Record<OptionalColumn, boolean>;

const defaultColumnVisibility: ColumnVisibility = {
    ref: true,
    image: true,
    name: true,
    producer: true,
    potHeight: true,
    price: true,
    actions: true,
};

type Props = {
    collection: PaginatedCollection<Product>;
    canEdit?: boolean;
    canDelete?: boolean;
};

export default function ProductsTable({ collection, canEdit = false, canDelete = false }: Props) {
    const { t } = useI18n();
    const { auth } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;
    const isPrivileged = !!auth?.user?.roles?.some((role) => ['dev', 'admin', 'commercial'].includes(role.name));

    const buildShowUrl = (id: number) => {
        if (typeof window === 'undefined') return `/products/${id}`;
        const params = new URLSearchParams(window.location.search);
        if (params.get('q')) {
            return `/products/${id}?from=search`;
        }
        return `/products/${id}`;
    };

    const goToProductPage = (id: number) => {
        window.location.href = buildShowUrl(id);
    }

    const handleEditClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        window.location.href = `/admin/products/${id}/edit`;
    }

    const handleDeleteClick = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('Are you sure?')) {
            window.location.href = `/admin/products/${id}/destroy`;
        }
    }

    const { addToCart, items } = useContext(CartContext);
    const openCartAfterAdd = useCartAutoOpen();

    const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
        if (typeof window === 'undefined') return defaultColumnVisibility;

        try {
            const stored = JSON.parse(
                localStorage.getItem('productsTableColumns') || '{}',
            ) as Partial<ColumnVisibility>;

            return {
                ref: stored.ref ?? true,
                image: stored.image ?? true,
                name: stored.name ?? true,
                producer: stored.producer ?? true,
                potHeight: stored.potHeight ?? true,
                price: stored.price ?? true,
                actions: stored.actions ?? true,
            };
        } catch {
            return defaultColumnVisibility;
        }
    });

    const saveVisibleColumns = (columns: ColumnVisibility) => {
        setVisibleColumns(columns);
        if (typeof window !== 'undefined') {
            localStorage.setItem('productsTableColumns', JSON.stringify(columns));
        }
    };

    const handleColumnVisibilityChange = (column: OptionalColumn, visible: boolean) => {
        saveVisibleColumns({ ...visibleColumns, [column]: visible });
    };

    const resetColumns = () => saveVisibleColumns(defaultColumnVisibility);

    const configurableColumns: Array<{ key: OptionalColumn; label: string }> = [
        { key: 'ref', label: t('Ref') },
        { key: 'image', label: t('Image') },
        { key: 'name', label: t('Name') },
        { key: 'producer', label: t('Producer') },
        { key: 'potHeight', label: `${t('Pot')} / ${t('Height')}` },
        { key: 'price', label: t('Price') },
        { key: 'actions', label: t('Actions') },
    ];

    const filterByProducer = (e: React.MouseEvent, producerId: number) => {
        e.stopPropagation();
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        params.delete('producer');
        params.append('producer[]', String(producerId));
        router.visit(`/products?${params.toString()}`, { preserveScroll: true });
    };

    return (
        <Table>


            <TableHeader>
                <TableRow>
                    <SortableTableHead field='ref'>
                        <div className="flex items-center gap-1">
                            <span>Ref</span>
                            <span
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
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
                    {visibleColumns.image && <TableHead></TableHead>}
                    {visibleColumns.name && <SortableTableHead field='name'>{t('Name')}</SortableTableHead>}
                    {visibleColumns.producer && <TableHead>{t('Producer')}</TableHead>}
                    {/* <SortableTableHead field='category_products_id'>{t('Category')}</SortableTableHead> */}
                    {visibleColumns.potHeight && (
                        <TableHead className="flex items-center">
                            <CircleSlash2 className="size-3 mr-1" />{t('Pot')} / <MoveVertical className="size-3" />{t('Height')}
                        </TableHead>
                    )}
                    {isAuthenticated && visibleColumns.price && (
                        <>
                            <SortableTableHead field='price'>{t('Price')}</SortableTableHead>
                        </>
                    )}

                    {(canEdit || canDelete) && visibleColumns.actions && <TableHead className="text-end">{t('Actions')}</TableHead>}

                </TableRow>
            </TableHeader>


            <TableBody className="">
                {collection.data.map((item) => {
                    const isInCart = items.some((cartItem) => cartItem.product.id === item.id);
                    const { price, price_floor: priceFloor, price_roll: priceRoll, price_promo: pricePromo } = resolveProductPrices(item);
                    const countryCode = (item.dbProduct?.country ?? '').trim().toUpperCase();
                    return (
                        <TableRow
                            key={item.id}
                            className={`group hover:cursor-pointer ${isInCart ? 'bg-green-50/60 dark:bg-green-950/20' : ''}`}
                            onClick={() => goToProductPage(item.id)}
                        >
                            {visibleColumns.ref && <TableCell>{String(item.ref)}</TableCell>}
                            {visibleColumns.image && (
                            <TableCell>
                                <div className="relative size-20">
                                    {item.img_link ? (
                                        <img src={item.image_thumb ?? item.img_link} className="size-full rounded-md object-cover object-center" alt={item.name} />
                                    ) : (
                                        <img src={'/placeholder.png'} className="size-full rounded-md object-cover object-center" alt="Placeholder" />
                                    )}
                                    {countryCode ? (
                                        <span className="absolute right-1 top-1">
                                            <CountryFlag countryCode={countryCode} title={countryCode} className="w-4" />
                                        </span>
                                    ) : null}
                                    {item?.price_promo && Number(item.price_promo) > 0 ? (
                                        <span className="absolute -left-2 -top-1 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold" title="promo">
                                            <Zap className="w-5 h-5" />
                                        </span>
                                    ) : null}
                                </div>
                            </TableCell>
                            )}
                            {visibleColumns.name && (
                            <TableCell className=''>
                                <div className="flex flex-col justify-center gap-1">
                                    <span className="group group-hover:underline underline-offset-2">
                                        {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
                                    </span>
                                    <span className="text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">
                                        {item.description ? item.description : ''}
                                    </span>
                                </div>
                            </TableCell>
                            )}
                            {visibleColumns.producer && (
                            <TableCell>
                                {item.producer ? (
                                    <button
                                        type="button"
                                        className="inline-flex items-center gap-1 rounded-full border border-brand-main/30 bg-brand-main/10 px-2 py-0.5 text-xs text-foreground transition-colors hover:border-brand-main hover:bg-brand-main/20"
                                        title={t('Filter by producer')}
                                        onClick={(e) => filterByProducer(e, item.producer!.id)}
                                    >
                                        <Sprout className="size-3.5 shrink-0" />
                                        <span>
                                            {isPrivileged
                                                ? (item.producer.name || `#${item.producer.id}`)
                                                : `#${item.producer.id}`}
                                        </span>
                                    </button>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            )}
                            {/* <TableCell>{item.category ? item.category.name.charAt(0).toUpperCase() + item.category.name.slice(1) : ''}</TableCell> */}
                            {visibleColumns.potHeight && (
                            <TableCell>
                                <div className="space-y-2">
                                    {item?.pot ? (
                                        <p className=" flex gap-1" title={t('Pot diameter')}>
                                            <span><CircleSlash2 className="size-4" /></span>
                                            <span>{String(item.pot)} cm</span>
                                        </p>
                                    ) : null}


                                    {item?.height ? (
                                        <p className="flex" title={t('Height')}>
                                            <span><MoveVertical className="size-4" /></span>
                                            <span>{String(item.height)} cm</span>
                                        </p>
                                    ) : null}
                                </div>
                            </TableCell>
                            )}
                            {isAuthenticated && visibleColumns.price && (
                                <>
                                    <TableCell className="text-end">
                                        {item?.unite != null && item.unite > Number(item.cond) ? (
                                            <div className="mb-2 flex justify-end">
                                                <Badge variant="secondary">
                                                    Mini : {String(item.unite)}
                                                </Badge>
                                            </div>
                                        ) : null}
                                        <div className="flex gap-1">
                                            {price !== null && (
                                                <button
                                                    className="w-full text-sm flex items-center border dark:border-accent rounded-md py-1 bg-brand-tertiary hover:bg-brand-tertiary/90 text-white dark:text-black"
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        addToCart(item, Number(item.cond));
                                                        openCartAfterAdd();
                                                    }}
                                                    title={t('Add a tray')}
                                                >
                                                    <div className="w-1/3 flex justify-center">
                                                        <span className="w-6 h-6 mx-1 text-main-purple dark:text-main-green">
                                                            <div dangerouslySetInnerHTML={{ __html: addCartonIcon }} />
                                                        </span>
                                                    </div>
                                                    <div className="w-1/2 flex flex-col items-center">
                                                        <span className="font-semibold">{formatCurrency(price)}</span>
                                                        <span className="text-xs font-light mr-1">X {Number(item.cond)}</span>
                                                    </div>
                                                </button>
                                            )}
                                            {priceFloor !== null ? (
                                                <button
                                                    className="w-full text-sm flex items-center border dark:border-accent rounded-md py-1 bg-brand-secondary hover:bg-brand-secondary/90 text-white dark:text-black"
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        addToCart(item, Number(item.cond) * Number(item.floor));
                                                        openCartAfterAdd();
                                                    }}
                                                    title={t('Add a floor')}
                                                >
                                                    <div className="w-1/3 flex justify-center">
                                                        <span className="w-6 h-6 mx-1 text-main-purple dark:text-main-green">
                                                            <div dangerouslySetInnerHTML={{ __html: addEtageIcon }} />
                                                        </span>
                                                    </div>
                                                    <div className="w-1/2 flex flex-col items-center">
                                                        <span className="font-semibold">{formatCurrency(priceFloor)}</span>
                                                        <span className="text-xs font-light mr-1">X {Number(item.cond) * Number(item.floor)}</span>
                                                    </div>
                                                </button>
                                            ) : null}
                                            {priceRoll !== null ? (
                                                <button
                                                    className="w-full text-sm flex items-center border dark:border-accent rounded-md py-1 bg-brand-main hover:bg-brand-main-hover text-white dark:text-black"
                                                    onClick={(e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        addToCart(item, Number(item.cond) * Number(item.floor) * Number(item.roll));
                                                        openCartAfterAdd();
                                                    }}
                                                    title={t('Add a roll')}
                                                >
                                                    <div className="w-1/3 flex justify-center">
                                                        <span className="w-6 h-6 mx-1 text-main-purple dark:text-main-green">
                                                            <div dangerouslySetInnerHTML={{ __html: addRollIcon }} />
                                                        </span>
                                                    </div>
                                                    <div className="w-1/2 flex flex-col items-center">
                                                        {pricePromo > 0 ? (
                                                            <>
                                                                {/* <span className="font-thin line-through opacity-75 text-[10px]">{String(item.price_roll)} €</span> */}
                                                                <span className="font-semibold line-through opacity-75 text-[10px]">{formatCurrency(priceRoll)}</span>
                                                                <span className="font-semibold text-red-300 dark:text-red-600">{formatCurrency(pricePromo)}</span>
                                                                <span className="text-xs font-light mr-1">X {Number(item.cond) * Number(item.floor) * Number(item.roll)}</span>
                                                            </>

                                                        ) : (
                                                            <>
                                                                <span className="font-semibold">{formatCurrency(priceRoll)}</span>
                                                                <span className="text-xs font-light mr-1">X {Number(item.cond) * Number(item.floor) * Number(item.roll)}</span>
                                                            </>
                                                        )}

                                                    </div>
                                                </button>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                </>
                            )}
                            {(canEdit || canDelete) && visibleColumns.actions && (
                                <TableCell>
                                    <div className="flex gap-2 justify-end" onClick={e => e.stopPropagation()}>
                                        {canEdit && (
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                onClick={(e) => handleEditClick(e, item.id)}
                                            >
                                                <EditIcon size={16} />
                                            </Button>
                                        )}
                                        {canDelete && (
                                            <Button
                                                size="icon"
                                                variant="destructive-outline"
                                                onClick={(e) => handleDeleteClick(e, item.id)}
                                            >
                                                <TrashIcon size={16} />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            )}

                        </TableRow>
                    );
                })
                }
            </TableBody >
        </Table >
    );
}
