import React, { useContext } from 'react';
import { type Product } from '@/types';
import { CartContext } from './cart.context';
import { Trash2 } from 'lucide-react';

export type CartItemProps = {
    product: Product;
    quantity: number;
};

export function CartItem({ product, quantity }: CartItemProps) {
    const { removeFromCart, updateQuantity } = useContext(CartContext);
    return (
        <div className="flex items-center gap-2 p-2 border-b">
            <img src={product.img_link ?? '/placeholder.png'} alt={product.name} className="w-12 h-12 object-cover rounded" />
            <div className="flex-1">
                <div className="font-semibold max-w-10  whitespace-nowrap overflow-hidden text-ellipsis">{product.name}</div>
                <div className="text-xs text-gray-500">{product.price} €</div>
            </div>
            <div className="flex items-center gap-1">
                <button
                    className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                    aria-label="Diminuer la quantité"
                    onClick={() => updateQuantity(product.id, quantity - 1)}
                    disabled={quantity <= 1}
                >
                    -
                </button>
                <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={e => updateQuantity(product.id, Number(e.target.value))}
                    className="w-10 text-center border rounded"
                />
                <button
                    className="px-2 py-1 rounded bg-gray-200 hover:bg-gray-300"
                    aria-label="Augmenter la quantité"
                    onClick={() => updateQuantity(product.id, quantity + 1)}
                >
                    +
                </button>
            </div>
            <button
                className="ml-2 p-1 rounded hover:bg-destructive/10"
                aria-label="Retirer du panier"
                onClick={() => removeFromCart(product.id)}
            >
                <Trash2 className="size-4 text-destructive" />
            </button>
        </div>
    );
}
