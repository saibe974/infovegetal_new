import React, { useContext } from 'react';
import { type Product } from '@/types';
import { CartContext } from './cart.context';
import { Trash2, Minus, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { getCartPricing } from './cart-pricing';

export type CartItemProps = {
    product: Product;
    quantity: number;
};

export function CartItem({ product, quantity }: CartItemProps) {
    const { t } = useI18n();
    const { removeFromCart, updateQuantity } = useContext(CartContext);

    const pricing = getCartPricing(product, quantity);
    const total = pricing.lineTotal.toFixed(2);
    const tierLabels: Record<typeof pricing.tier, string> = {
        roll: t('Roll'),
        floor: t('Floor'),
        tray: t('Tray'),
        unit: t('Unit'),
    };

    return (
        <div className="group relative border-b pb-3 last:border-b-0">
            {/* Bouton supprimer en haut à droite */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-0 right-0 size-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                aria-label={t('Retirer du panier')}
                title={t('Retirer du panier')}
                onClick={() => removeFromCart(product.id)}
            >
                <Trash2 className="size-3.5" />
            </Button>

            <div className="flex gap-2.5">
                {/* Image produit */}
                <div className="relative shrink-0">
                    <img
                        src={product.img_link ?? '/placeholder.png'}
                        alt={product.name}
                        className="size-15 object-cover rounded"
                    />
                    <Badge
                        // variant={''}
                        className={cn(
                            "absolute -top-1 -right-1 text-xs rounded-full",
                            quantity > 9 ? "size-6 px-1.5" : "size-5 px-2"
                        )}
                    >
                        {quantity}
                    </Badge>
                </div>

                {/* Infos produit */}
                <div className="flex-1 min-w-0 pr-6">
                    <h4 className="font-medium text-sm leading-tight line-clamp-2 mb-1">
                        {product.name}
                    </h4>
                    <div className="text-xs text-muted-foreground mb-2">
                        {pricing.unitPrice.toFixed(2)} €
                    </div>

                    {/* Contrôles quantité + Total */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-0.5 bg-muted rounded p-0.5">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-5 hover:bg-background"
                                aria-label="Diminuer la quantité"
                                onClick={() => updateQuantity(product.id, quantity - 1)}
                                disabled={quantity <= 1}
                            >
                                <Minus className="size-3" />
                            </Button>
                            {/* <span className="min-w-[1.25rem] text-center text-xs font-medium">
                                {quantity}
                            </span> */}
                            <input
                                type="text"
                                min={1}
                                value={quantity}
                                onChange={(e) => {
                                    const newQuantity = Math.max(1, parseInt(e.target.value) || 1);
                                    updateQuantity(product.id, newQuantity);
                                }}
                                className="w-[1.25rem] text-center text-xs font-medium bg-transparent outline-none"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-5 hover:bg-background"
                                aria-label="Augmenter la quantité"
                                onClick={() => updateQuantity(product.id, quantity + 1)}
                            >
                                <Plus className="size-3" />
                            </Button>
                        </div>

                        <div className="font-semibold text-sm text-nowrap">
                            {total} €
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
