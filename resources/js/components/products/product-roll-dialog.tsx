import React, { useContext } from 'react';
import { CartContext, type CartItem } from '@/components/cart/cart.context';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import { ProductRoll, type SupplierDistribution } from './product-roll';

type ProductRollDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    items: CartItem[];
    getSupplierPrice?: (supplier: SupplierDistribution) => number | null;
    getSupplierRollPrices?: (supplier: SupplierDistribution) => number[] | null;
};

export function ProductRollDialog({
    open,
    onOpenChange,
    items,
    getSupplierPrice,
    getSupplierRollPrices,
}: ProductRollDialogProps) {
    const { t } = useI18n();
    const { updateQuantity, removeFromCart } = useContext(CartContext);

    const changeQuantity = (productId: number, delta: number) => {
        const item = items.find(({ product }) => product.id === productId);
        if (item) updateQuantity(productId, item.quantity + delta);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="grid h-[90vh] grid-rows-[auto_1fr] gap-0 overflow-hidden p-0 sm:max-w-6xl" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader className="border-b px-6 py-4 pr-12">
                    <DialogTitle>{t('Chargement des rolls')}</DialogTitle>
                    <DialogDescription>
                        {t('Ajustez les cartons directement depuis le roll.')}
                    </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto px-4 py-6 sm:px-6">
                    <ProductRoll
                        items={items}
                        getSupplierPrice={getSupplierPrice}
                        getRollPrice={getSupplierRollPrices
                            ? (supplier, _roll, rollIndex) => getSupplierRollPrices(supplier)?.[rollIndex] ?? null
                            : undefined}
                        onAddCarton={(productId, quantity) => changeQuantity(productId, quantity)}
                        onRemoveCarton={(productId, quantity) => changeQuantity(productId, -quantity)}
                        onRemoveProduct={removeFromCart}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
