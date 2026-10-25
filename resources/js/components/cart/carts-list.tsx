import { ButtonsActions } from '@/components/buttons-actions';
import { getCartPricing } from '@/components/cart/cart-pricing';
import { OrderStatusBadge } from '@/components/cart/order-status-badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import { type Product, type SharedData } from '@/types';
import { router, usePage } from '@inertiajs/react';
import { Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type CartStatus =
    | 'current'
    | 'processing'
    | 'delivering'
    | 'delivered'
    | 'closed'
    | 'processed';

const statusLabels: Record<string, string> = {
    current: 'En cours',
    processing: 'En cours de traitement',
    delivering: 'En cours de livraison',
    delivered: 'Livrée',
    closed: 'Clôturée',
    processed: 'Traitée (ancienne commande)',
};

type OptionalColumn =
    | 'client'
    | 'articles'
    | 'total'
    | 'date'
    | 'status'
    | 'actions';
type ColumnVisibility = Record<OptionalColumn, boolean>;

const defaultColumnVisibility: ColumnVisibility = {
    client: true,
    articles: true,
    total: true,
    date: true,
    status: true,
    actions: true,
};

type CartProduct = Product & { pivot?: { quantity: number; comment?: string } };

type CartSummary = {
    id: number;
    status: CartStatus;
    comment?: string;
    computed_total?: number;
    items_total?: number;
    shipping_total?: number;
    pdf_filename?: string;
    created_at?: string;
    updated_at?: string;
    user?: { id?: number; name: string; email: string };
    products?: CartProduct[];
};

export function CartsList() {
    const { t } = useI18n();
    const { carts, auth, cart } = usePage<
        SharedData & { carts: CartSummary[] }
    >().props;
    const openedCartId = cart?.id ?? null;
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [deleteConfirmCart, setDeleteConfirmCart] =
        useState<CartSummary | null>(null);
    const [previewPdf, setPreviewPdf] = useState<{
        url: string;
        cartId: number;
    } | null>(null);
    const [previewLoadingCartId, setPreviewLoadingCartId] = useState<
        number | null
    >(null);

    const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(
        () => {
            if (typeof window === 'undefined') return defaultColumnVisibility;

            try {
                const stored = JSON.parse(
                    localStorage.getItem('cartsListColumns') || '{}',
                ) as Partial<ColumnVisibility>;

                return {
                    client: stored.client ?? true,
                    articles: stored.articles ?? true,
                    total: stored.total ?? true,
                    date: stored.date ?? true,
                    status: stored.status ?? true,
                    actions: stored.actions ?? true,
                };
            } catch {
                return defaultColumnVisibility;
            }
        },
    );

    const saveVisibleColumns = (columns: ColumnVisibility) => {
        setVisibleColumns(columns);
        if (typeof window !== 'undefined') {
            localStorage.setItem('cartsListColumns', JSON.stringify(columns));
        }
    };

    const handleColumnVisibilityChange = (
        column: OptionalColumn,
        visible: boolean,
    ) => {
        saveVisibleColumns({ ...visibleColumns, [column]: visible });
    };

    const resetColumns = () => saveVisibleColumns(defaultColumnVisibility);

    const configurableColumns: Array<{ key: OptionalColumn; label: string }> = [
        { key: 'client', label: t('Client') },
        { key: 'articles', label: t('Articles') },
        { key: 'total', label: t('Total') },
        { key: 'date', label: t('Date') },
        { key: 'status', label: t('Statut') },
        { key: 'actions', label: t('Actions') },
    ];

    const visibleColumnsCount = configurableColumns.filter(
        (column) => visibleColumns[column.key],
    ).length;

    const handleEdit = (cart: CartSummary) => {
        if (cart.status === 'current' && cart.user?.id === auth.user?.id) {
            localStorage.setItem(
                `cart:${auth.user?.id}`,
                JSON.stringify(
                    (cart.products ?? []).map((product) => ({
                        product,
                        quantity: product.pivot?.quantity ?? 1,
                        comment: product.pivot?.comment ?? '',
                    })),
                ),
            );
            localStorage.setItem(
                `cart:${auth.user?.id}:comment`,
                cart.comment ?? '',
            );
            window.location.assign('/cart/checkout');
        } else {
            router.visit('/orders/' + cart.id);
        }
    };

    const rows = useMemo(() => {
        return (carts ?? []).map((cart) => {
            const items = cart.products ?? [];
            const fallbackTotal = items.reduce((sum, product) => {
                const qty = product.pivot?.quantity ?? 0;
                const pricing = getCartPricing(product, qty);
                return sum + pricing.lineTotal;
            }, 0);
            const storedTotal =
                typeof cart.items_total === 'number' ||
                typeof cart.shipping_total === 'number'
                    ? Number(cart.items_total ?? 0) +
                      Number(cart.shipping_total ?? 0)
                    : null;
            const total =
                storedTotal !== null
                    ? storedTotal
                    : typeof cart.computed_total === 'number'
                      ? cart.computed_total
                      : fallbackTotal;
            const totalQty = items.reduce(
                (sum, product) => sum + (product.pivot?.quantity ?? 0),
                0,
            );

            return {
                ...cart,
                total,
                totalQty,
            };
        });
    }, [carts]);

    const handleDelete = (cartId: number) => {
        setDeletingId(cartId);
        router.delete(`/cart/${cartId}`, {
            onSuccess: () => toast.success(t('Commande supprimee')),
            onError: () => toast.error(t('Erreur lors de la suppression')),
            onFinish: () => {
                setDeletingId(null);
                setDeleteConfirmCart(null);
            },
            preserveScroll: true,
        });
    };

    const handlePreview = async (cart: CartSummary) => {
        const candidateUrls = [`/order-files/cart/${cart.id}/pdf`];
        setPreviewLoadingCartId(cart.id);

        try {
            let foundUrl: string | null = null;
            for (const url of candidateUrls) {
                const response = await fetch(url, {
                    method: 'HEAD',
                    credentials: 'include',
                });
                if (response.ok) {
                    foundUrl = url;
                    break;
                }
            }

            if (!foundUrl) {
                toast.error(t('Aucun PDF genere pour cette commande'));
                return;
            }

            setPreviewPdf({ url: foundUrl, cartId: cart.id });
        } catch {
            toast.error(t("Erreur lors de l'ouverture de l'aperçu"));
        } finally {
            setPreviewLoadingCartId(null);
        }
    };

    return (
        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
            {/* <div className="border-b border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                <h2 className="text-lg font-semibold">{t('Commandes')}</h2>
                <p className="text-sm text-muted-foreground">{t('Gestion des commandes par fournisseur')}</p>
            </div> */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40">
                        <tr>
                            <th className="px-4 py-3 font-medium">
                                <div className="flex items-center gap-2">
                                    <span>{t('ID')}</span>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="ghost"
                                                className="size-7"
                                                title={t(
                                                    'Choisir les colonnes',
                                                )}
                                                aria-label={t(
                                                    'Choisir les colonnes',
                                                )}
                                            >
                                                <Settings2 className="size-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="start"
                                            className="w-56"
                                        >
                                            <DropdownMenuLabel>
                                                {t('Colonnes affichees')}
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            {configurableColumns.map(
                                                (column) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={column.key}
                                                        checked={
                                                            visibleColumns[
                                                                column.key
                                                            ]
                                                        }
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            handleColumnVisibilityChange(
                                                                column.key,
                                                                Boolean(
                                                                    checked,
                                                                ),
                                                            )
                                                        }
                                                        onSelect={(event) =>
                                                            event.preventDefault()
                                                        }
                                                    >
                                                        {column.label}
                                                    </DropdownMenuCheckboxItem>
                                                ),
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onSelect={resetColumns}
                                            >
                                                {t(
                                                    'Reinitialiser les colonnes',
                                                )}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </th>
                            {visibleColumns.client && (
                                <th className="px-4 py-3 font-medium">
                                    {t('Client')}
                                </th>
                            )}
                            {visibleColumns.articles && (
                                <th className="px-4 py-3 font-medium">
                                    {t('Articles')}
                                </th>
                            )}
                            {visibleColumns.total && (
                                <th className="px-4 py-3 font-medium">
                                    {t('Total')}
                                </th>
                            )}
                            {visibleColumns.date && (
                                <th className="px-4 py-3 font-medium">
                                    {t('Date')}
                                </th>
                            )}
                            {visibleColumns.status && (
                                <th className="px-4 py-3 font-medium">
                                    {t('Statut')}
                                </th>
                            )}
                            {visibleColumns.actions && (
                                <th className="px-4 py-3 font-medium">
                                    {t('Actions')}
                                </th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-sidebar-border/70 dark:divide-sidebar-border">
                        {rows.length === 0 && (
                            <tr>
                                <td
                                    colSpan={1 + visibleColumnsCount}
                                    className="px-4 py-8 text-center text-muted-foreground"
                                >
                                    {t('Aucune commande')}
                                </td>
                            </tr>
                        )}
                        {rows.map((cart) => (
                            <tr
                                key={cart.id}
                                className={
                                    cart.id === openedCartId
                                        ? 'bg-brand-main/15 hover:bg-brand-main/20'
                                        : 'hover:bg-muted/30'
                                }
                            >
                                <td
                                    className={`px-4 py-3 ${cart.id === openedCartId ? 'font-semibold text-brand-main' : ''}`}
                                >
                                    #{cart.id}
                                </td>
                                {visibleColumns.client && (
                                    <td className="px-4 py-3">
                                        <div className="font-medium">
                                            {cart.user?.name ?? t('Inconnu')}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {cart.user?.email ?? ''}
                                        </div>
                                    </td>
                                )}
                                {visibleColumns.articles && (
                                    <td className="px-4 py-3">
                                        {cart.totalQty}
                                    </td>
                                )}
                                {visibleColumns.total && (
                                    <td className="px-4 py-3">
                                        {formatCurrency(cart.total)}
                                    </td>
                                )}
                                {visibleColumns.date && (
                                    <td className="px-4 py-3">
                                        {cart.updated_at
                                            ? new Intl.DateTimeFormat('fr-FR', {
                                                  dateStyle: 'medium',
                                                  timeStyle: 'short',
                                              }).format(
                                                  new Date(cart.updated_at),
                                              )
                                            : '-'}
                                    </td>
                                )}
                                {visibleColumns.status && (
                                    <td className="px-4 py-3">
                                        <OrderStatusBadge
                                            status={cart.status}
                                            label={t(
                                                statusLabels[cart.status] ??
                                                    cart.status,
                                            )}
                                        />
                                    </td>
                                )}
                                {visibleColumns.actions && (
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            {cart.status !== 'current' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleEdit(cart)
                                                    }
                                                >
                                                    Suivre
                                                </Button>
                                            )}
                                            <ButtonsActions
                                                className="justify-end"
                                                preview={() =>
                                                    void handlePreview(cart)
                                                }
                                                edit={
                                                    cart.status === 'current' &&
                                                    cart.user?.id ===
                                                        auth.user?.id
                                                        ? () => handleEdit(cart)
                                                        : undefined
                                                }
                                                delete={
                                                    cart.status === 'current' &&
                                                    (cart.user?.id ===
                                                        auth.user?.id ||
                                                        auth.user?.roles?.some(
                                                            (role) =>
                                                                role.name ===
                                                                'admin',
                                                        ))
                                                        ? () =>
                                                              setDeleteConfirmCart(
                                                                  cart,
                                                              )
                                                        : undefined
                                                }
                                                saving={
                                                    deletingId === cart.id ||
                                                    previewLoadingCartId ===
                                                        cart.id
                                                }
                                            />
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog
                open={deleteConfirmCart !== null}
                onOpenChange={(open) => !open && setDeleteConfirmCart(null)}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            {t('Confirmer la suppression')}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'Voulez-vous vraiment supprimer cette commande ? Cette action est irreversible.',
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col gap-2 sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteConfirmCart(null)}
                        >
                            {t('Annuler')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() =>
                                deleteConfirmCart &&
                                handleDelete(deleteConfirmCart.id)
                            }
                            disabled={
                                !!deleteConfirmCart &&
                                deletingId === deleteConfirmCart.id
                            }
                        >
                            {t('Supprimer')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={previewPdf !== null}
                onOpenChange={(open) => !open && setPreviewPdf(null)}
            >
                <DialogContent className="sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>{t('Apercu de la commande')}</DialogTitle>
                        <DialogDescription>
                            {previewPdf ? `Commande #${previewPdf.cartId}` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="h-[70vh] w-full overflow-hidden rounded-md border">
                        {previewPdf && (
                            <iframe
                                src={previewPdf.url}
                                title={`pdf-cart-${previewPdf.cartId}`}
                                className="h-full w-full"
                            />
                        )}
                    </div>
                    <DialogFooter className="flex-col gap-2 sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={() => setPreviewPdf(null)}
                        >
                            {t('Fermer')}
                        </Button>
                        {previewPdf && (
                            <Button asChild>
                                <a
                                    href={previewPdf.url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {t('Ouvrir dans un nouvel onglet')}
                                </a>
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
