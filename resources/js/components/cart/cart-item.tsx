import React, { ComponentType, useContext, useState } from 'react';
import { type Product } from '@/types';
import { CartContext } from './cart.context';
import { Trash2, Minus, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { getCartPricing, type CartPricing } from './cart-pricing';
import { getProductCartImage } from '@/components/products/product-cart-image';
import { getCondQuantity, getQuantityStep, getUniteQuantity, isProductMultiple } from './cart-quantity-rules';
import * as Flags from "country-flag-icons/react/3x2";

export type CartItemProps = {
    product: Product;
    quantity: number;
    comment?: string;
    pricingOverride?: CartPricing;
};

export function CartItem({ product, quantity, comment = '', pricingOverride }: CartItemProps) {
    const { t } = useI18n();
    const { removeFromCart, updateQuantity, updateComment } = useContext(CartContext);
    const [isCommentOpen, setIsCommentOpen] = useState(false);
    const hasComment = comment.trim() !== '';

    const pricing = pricingOverride ?? getCartPricing(product, quantity);
    const total = pricing.lineTotal.toFixed(2);

    const countryCode = (product.dbProduct?.country ?? '').trim().toUpperCase();
    const CountryFlag = countryCode.length === 2
        ? (Flags as Record<string, ComponentType<{ title?: string; className?: string }>>)[countryCode]
        : undefined;
    const productImage = getProductCartImage(product);

    const unite = getUniteQuantity(product);
    const decreaseStep = getQuantityStep(product, quantity);
    const increaseStep = isProductMultiple(product)
        ? unite
        : (quantity >= unite ? getCondQuantity(product) : unite);

    return (
        <div className="group relative border-b pb-3 last:border-b-0">
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    'absolute top-0 right-7 size-6',
                    (hasComment || isCommentOpen) && 'text-primary',
                )}
                aria-label={t(hasComment ? 'Modifier le commentaire' : 'Ajouter un commentaire')}
                title={t(hasComment ? 'Modifier le commentaire' : 'Ajouter un commentaire')}
                onClick={() => setIsCommentOpen((open) => !open)}
            >
                <Pencil className="size-3.5" />
            </Button>
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
                        src={productImage}
                        alt={product.name}
                        className="size-15 object-cover rounded"
                    />
                    {CountryFlag && <CountryFlag title={String(product.dbProduct?.country)} className="absolute top-0 left-0 w-5" />}
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
                <div className="flex-1 min-w-0 pr-12">
                    <h4 className="font-medium text-sm leading-tight line-clamp-2">
                        {product.name}
                    </h4>
                    <div className="text-xs text-muted-foreground mb-2">
                        {product.ref}
                    </div>
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
                                onClick={() => updateQuantity(product.id, quantity - decreaseStep)}
                            >
                                <Minus className="size-3" />
                            </Button>
                            {/* <span className="min-w-[1.25rem] text-center text-xs font-medium">
                                {quantity}
                            </span> */}
                            <input
                                type="text"
                                min={unite}
                                value={quantity}
                                onChange={(e) => {
                                    const newQuantity = parseInt(e.target.value, 10);
                                    updateQuantity(product.id, newQuantity);
                                }}
                                className="w-[1.25rem] text-center text-xs font-medium bg-transparent outline-none"
                            />
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-5 hover:bg-background"
                                aria-label="Augmenter la quantité"
                                onClick={() => updateQuantity(product.id, quantity + increaseStep)}
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
            {isCommentOpen ? (
                <textarea
                    value={comment}
                    autoFocus
                    maxLength={2000}
                    rows={2}
                    onChange={(event) => updateComment(product.id, event.target.value)}
                    placeholder={t('Commentaire pour ce produit')}
                    aria-label={t('Commentaire pour ce produit')}
                    className="mt-2 w-full resize-y rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
            ) : hasComment ? (
                <button
                    type="button"
                    className="mt-2 flex w-full items-start gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setIsCommentOpen(true)}
                    title={t('Modifier le commentaire')}
                >
                    <Pencil className="mt-0.5 size-3 shrink-0" />
                    <span className="whitespace-pre-wrap">{comment}</span>
                </button>
            ) : null}
        </div>
    );
}
