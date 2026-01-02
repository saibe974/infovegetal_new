import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { type Product } from '@/types';
import { type SharedData } from '@/types';

const getCsrfToken = (): string => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    const token = meta ? meta.getAttribute('content') || '' : '';
    return token;
};

const syncCartToServer = (cartIds: number[]): void => {
    const token = getCsrfToken();

    // Seulement envoyer si on a un token valide
    if (!token) {
        console.warn('CSRF token not found, cart sync skipped');
        return;
    }

    fetch('/products/save-cart-filter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': token,
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ cart_ids: cartIds }),
    }).catch(err => console.error('Erreur sync panier:', err));
};

export type CartItem = {
    product: Product;
    quantity: number;
};


export type CartContextType = {
    items: CartItem[];
    addToCart: (product: Product, quantity?: number) => void;
    removeFromCart: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    clearCart: () => void;
};

export const CartContext = createContext<CartContextType>({
    items: [],
    addToCart: () => { },
    removeFromCart: () => { },
    updateQuantity: () => { },
    clearCart: () => { },
});


export function CartProvider({ children }: { children: React.ReactNode }) {
    const { auth } = usePage<SharedData>().props;
    const userId = auth?.user?.id;

    const getCartKey = () => {
        return userId ? `cart:${userId}` : 'cart';
    };

    const [items, setItems] = useState<CartItem[]>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(getCartKey());
            return stored ? JSON.parse(stored) : [];
        }
        return [];
    });

    useEffect(() => {
        localStorage.setItem(getCartKey(), JSON.stringify(items));

        // Synchroniser les IDs du panier avec le serveur si l'utilisateur est authentifié
        if (userId && typeof window !== 'undefined') {
            const cartIds = items.map(item => item.product.id);
            syncCartToServer(cartIds);
        }
    }, [items, userId]);

    const addToCart = (product: Product, quantity: number = 1) => {
        setItems((prev) => {
            const existing = prev.find((item) => item.product.id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            }
            return [...prev, { product, quantity }];
        });
    };

    const removeFromCart = (productId: number) => {
        setItems((prev) => prev.filter((item) => item.product.id !== productId));
    };

    const updateQuantity = (productId: number, quantity: number) => {
        setItems((prev) => prev.map((item) =>
            item.product.id === productId ? { ...item, quantity: Math.max(1, quantity) } : item
        ));
    };

    const clearCart = () => setItems([]);

    return (
        <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart }}>
            {children}
        </CartContext.Provider>
    );
}
