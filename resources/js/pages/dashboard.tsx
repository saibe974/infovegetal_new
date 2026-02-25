import AppLayout from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import { dashboard } from '@/routes';
import { type BreadcrumbItem, type Product } from '@/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Head, router, usePage } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { getCartPricing } from '@/components/cart/cart-pricing';

export default function Dashboard() {
    const { t } = useI18n();
    const { carts } = usePage<{ carts: CartSummary[] }>().props;
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Dashboard'),
            href: dashboard().url,
        },
    ];

    const rows = useMemo(() => {
        return (carts ?? []).map((cart) => {
            const items = cart.products ?? [];
            const total = items.reduce((sum, product) => {
                const qty = product.pivot?.quantity ?? 0;
                const pricing = getCartPricing(product, qty);
                return sum + pricing.lineTotal;
            }, 0);
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
            onFinish: () => setUpdatingId(null),
            preserveScroll: true,
        });
    };

    const handleDelete = (cartId: number) => {
        if (!window.confirm(t('Supprimer cette commande ?'))) return;
        setDeletingId(cartId);
        router.delete(`/cart/${cartId}`, {
            onFinish: () => setDeletingId(null),
            preserveScroll: true,
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Dashboard')} />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4 min-h-screen">
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
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => handleDelete(cart.id)}
                                                disabled={deletingId === cart.id}
                                            >
                                                {t('Supprimer')}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

type CartStatus = 'processing' | 'processed';

type CartProduct = Product & { pivot?: { quantity: number } };

type CartSummary = {
    id: number;
    status: CartStatus;
    user?: { name: string; email: string };
    products?: CartProduct[];
};

const formatCurrency = (value: number) =>
    value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
