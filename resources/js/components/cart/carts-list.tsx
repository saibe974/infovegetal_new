import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ButtonsActions } from '@/components/buttons-actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getCartPricing } from '@/components/cart/cart-pricing';
import { useI18n } from '@/lib/i18n';
import { type Product, type SharedData } from '@/types';
import { leave as impersonateLeave, take as impersonateTake } from '@/actions/App/Http/Controllers/ImpersonationController';
import { router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type CartStatus = 'processing' | 'processed';

type CartProduct = Product & { pivot?: { quantity: number } };

type CartSummary = {
    id: number;
    status: CartStatus;
    computed_total?: number;
    items_total?: number;
    shipping_total?: number;
    pdf_filename?: string;
    created_at?: string;
    updated_at?: string;
    user?: { id?: number; name: string; email: string };
    products?: CartProduct[];
};

const formatCurrency = (value: number) =>
    value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

export function CartsList() {
    const { t } = useI18n();
    const { carts, auth } = usePage<SharedData & { carts: CartSummary[] }>().props;
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [impersonatingCartId, setImpersonatingCartId] = useState<number | null>(null);
    const [deleteConfirmCart, setDeleteConfirmCart] = useState<CartSummary | null>(null);
    const [replaceConfirmCart, setReplaceConfirmCart] = useState<CartSummary | null>(null);
    const [previewPdf, setPreviewPdf] = useState<{ url: string; cartId: number } | null>(null);
    const [previewLoadingCartId, setPreviewLoadingCartId] = useState<number | null>(null);

    const getCartStorageKey = (userId: number) => `cart:${userId}`;

    const readCartItemsLength = (userId: number): number => {
        const raw = localStorage.getItem(getCartStorageKey(userId));
        if (!raw) return 0;

        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.length : 0;
        } catch {
            return 0;
        }
    };

    const writeCartToLocalStorage = (cart: CartSummary, userId: number) => {
        const items = (cart.products ?? []).map((product) => ({
            product,
            quantity: product.pivot?.quantity ?? 1,
        }));

        localStorage.setItem(getCartStorageKey(userId), JSON.stringify(items));
    };

    const switchImpersonationToUser = async (targetUserId: number) => {
        const isImpersonating = !!auth?.impersonate_from;
        const currentImpersonatedUserId = auth?.user?.id;

        if (isImpersonating && currentImpersonatedUserId === targetUserId) {
            return;
        }

        if (isImpersonating) {
            const leaveResponse = await fetch(impersonateLeave().url, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!leaveResponse.ok) {
                throw new Error('Unable to leave impersonation');
            }
        }

        const takeResponse = await fetch(impersonateTake({ id: targetUserId }).url, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'X-Requested-With': 'XMLHttpRequest',
            },
        });

        if (!takeResponse.ok) {
            throw new Error('Impersonation failed');
        }
    };

    const startImpersonateAndEditCart = async (cart: CartSummary) => {
        const userId = cart.user?.id;
        if (!userId) {
            toast.error(t('Impossible de modifier cette commande: client introuvable'));
            return;
        }

        setImpersonatingCartId(cart.id);

        try {
            writeCartToLocalStorage(cart, userId);

            await switchImpersonationToUser(userId);

            router.visit('/cart/checkout');
        } catch {
            toast.error(t('Erreur lors du passage en impersonation'));
        } finally {
            setImpersonatingCartId(null);
            setReplaceConfirmCart(null);
        }
    };

    const handleEdit = (cart: CartSummary) => {
        const userId = cart.user?.id;
        if (!userId) {
            toast.error(t('Impossible de modifier cette commande: client introuvable'));
            return;
        }

        if (readCartItemsLength(userId) > 0) {
            setReplaceConfirmCart(cart);
            return;
        }

        void startImpersonateAndEditCart(cart);
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
                typeof cart.items_total === 'number' || typeof cart.shipping_total === 'number'
                    ? (Number(cart.items_total ?? 0) + Number(cart.shipping_total ?? 0))
                    : null;
            const total =
                storedTotal !== null
                    ? storedTotal
                    : (typeof cart.computed_total === 'number' ? cart.computed_total : fallbackTotal);
            const totalQty = items.reduce((sum, product) => sum + (product.pivot?.quantity ?? 0), 0);

            return {
                ...cart,
                total,
                totalQty,
            };
        });
    }, [carts]);

    const handleStatusChange = (cartId: number, status: CartStatus) => {
        setUpdatingId(cartId);
        router.put(`/cart/${cartId}/status`, { status }, {
            onSuccess: () => toast.success(t('Statut mis a jour')),
            onError: () => toast.error(t('Erreur lors de la mise a jour du statut')),
            onFinish: () => setUpdatingId(null),
            preserveScroll: true,
        });
    };

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
        const userId = cart.user?.id;
        if (!userId) {
            toast.error(t('Impossible d\'ouvrir l\'aperçu: client introuvable'));
            return;
        }

        const orderNumber = String(cart.id).padStart(5, '0');
        const createdDate = cart.created_at ? String(cart.created_at).slice(0, 10) : null;
        const updatedDate = cart.updated_at ? String(cart.updated_at).slice(0, 10) : null;
        const todayDate = new Date().toISOString().slice(0, 10);

        const filenameCandidates = [
            cart.pdf_filename,
            createdDate ? `${orderNumber}-${createdDate}.pdf` : null,
            updatedDate ? `${orderNumber}-${updatedDate}.pdf` : null,
            `${orderNumber}-${todayDate}.pdf`,
        ].filter((value, index, arr): value is string => !!value && arr.indexOf(value) === index);

        const legacyFilename = `${cart.id}.pdf`;
        const candidateUrls = filenameCandidates
            .map((filename) => `/storage/commandes/${userId}/${filename}`)
            .concat(`/storage/commandes/${userId}/${legacyFilename}`);
        setPreviewLoadingCartId(cart.id);

        try {
            let foundUrl: string | null = null;
            for (const url of candidateUrls) {
                const response = await fetch(url, { method: 'HEAD', credentials: 'include' });
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
            toast.error(t('Erreur lors de l\'ouverture de l\'aperçu'));
        } finally {
            setPreviewLoadingCartId(null);
        }
    };

    return (
        <div className="rounded-xl border border-sidebar-border/70 dark:border-sidebar-border">
            <div className="border-b border-sidebar-border/70 px-4 py-3 dark:border-sidebar-border">
                <h2 className="text-lg font-semibold">{t('Commandes')}</h2>
                <p className="text-sm text-muted-foreground">{t('Gestion des commandes par fournisseur')}</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40">
                        <tr>
                            <th className="px-4 py-3 font-medium">{t('ID')}</th>
                            <th className="px-4 py-3 font-medium">{t('Client')}</th>
                            <th className="px-4 py-3 font-medium">{t('Articles')}</th>
                            <th className="px-4 py-3 font-medium">{t('Total')}</th>
                            <th className="px-4 py-3 font-medium">{t('Statut')}</th>
                            <th className="px-4 py-3 font-medium">{t('Actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-sidebar-border/70 dark:divide-sidebar-border">
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                    {t('Aucune commande')}
                                </td>
                            </tr>
                        )}
                        {rows.map((cart) => (
                            <tr key={cart.id} className="hover:bg-muted/30">
                                <td className="px-4 py-3">#{cart.id}</td>
                                <td className="px-4 py-3">
                                    <div className="font-medium">{cart.user?.name ?? t('Inconnu')}</div>
                                    <div className="text-xs text-muted-foreground">{cart.user?.email ?? ''}</div>
                                </td>
                                <td className="px-4 py-3">{cart.totalQty}</td>
                                <td className="px-4 py-3">{formatCurrency(cart.total)}</td>
                                <td className="px-4 py-3">
                                    <Select
                                        value={cart.status}
                                        onValueChange={(value) => handleStatusChange(cart.id, value as CartStatus)}
                                    >
                                        <SelectTrigger className="w-[190px]" disabled={updatingId === cart.id}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="processing">{t('En cours de traitement')}</SelectItem>
                                            <SelectItem value="processed">{t('Traite')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </td>
                                <td className="px-4 py-3">
                                    <ButtonsActions
                                        className="justify-end"
                                        preview={() => void handlePreview(cart)}
                                        edit={() => handleEdit(cart)}
                                        delete={() => setDeleteConfirmCart(cart)}
                                        saving={
                                            deletingId === cart.id ||
                                            updatingId === cart.id ||
                                            impersonatingCartId === cart.id ||
                                            previewLoadingCartId === cart.id
                                        }
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog open={deleteConfirmCart !== null} onOpenChange={(open) => !open && setDeleteConfirmCart(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Confirmer la suppression')}</DialogTitle>
                        <DialogDescription>
                            {t('Voulez-vous vraiment supprimer cette commande ? Cette action est irreversible.')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col gap-2 sm:flex-row">
                        <Button variant="outline" onClick={() => setDeleteConfirmCart(null)}>
                            {t('Annuler')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteConfirmCart && handleDelete(deleteConfirmCart.id)}
                            disabled={!!deleteConfirmCart && deletingId === deleteConfirmCart.id}
                        >
                            {t('Supprimer')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={replaceConfirmCart !== null} onOpenChange={(open) => !open && setReplaceConfirmCart(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('Panier deja rempli')}</DialogTitle>
                        <DialogDescription>
                            {t('Le panier courant de ce client n\'est pas vide. Voulez-vous le remplacer par cette commande avant de modifier ?')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col gap-2 sm:flex-row">
                        <Button variant="outline" onClick={() => setReplaceConfirmCart(null)}>
                            {t('Annuler')}
                        </Button>
                        <Button
                            onClick={() => replaceConfirmCart && void startImpersonateAndEditCart(replaceConfirmCart)}
                            disabled={!!replaceConfirmCart && impersonatingCartId === replaceConfirmCart.id}
                        >
                            {t('Remplacer et modifier')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={previewPdf !== null} onOpenChange={(open) => !open && setPreviewPdf(null)}>
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
                        <Button variant="outline" onClick={() => setPreviewPdf(null)}>
                            {t('Fermer')}
                        </Button>
                        {previewPdf && (
                            <Button asChild>
                                <a href={previewPdf.url} target="_blank" rel="noreferrer">
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
