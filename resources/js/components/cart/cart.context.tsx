import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
    const { auth, cart_refresh_token } = usePage<SharedData & { cart_refresh_token?: number | string | null }>().props;
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

    const itemsRef = useRef<CartItem[]>(items);
    useEffect(() => {
        itemsRef.current = items;
    }, [items]);

    const [pendingProductId, setPendingProductId] = useState<number | null>(null);

    // Vérifier s'il y a une intention d'ajout au panier après connexion
    useEffect(() => {
        if (userId && typeof window !== 'undefined') {
            const pendingAdd = sessionStorage.getItem('pendingCartAdd');
            if (pendingAdd) {
                const { productId } = JSON.parse(pendingAdd);
                setPendingProductId(productId);
                sessionStorage.removeItem('pendingCartAdd');
            }
        }
    }, [userId]);

    // Récupérer le produit et l'ajouter au panier
    useEffect(() => {
        if (!pendingProductId) {
            return;
        }

        const url = userId
            ? `/api/auth/products/${pendingProductId}`
            : `/api/products/${pendingProductId}`;

        fetch(url, { credentials: 'include' })
            .then(res => res.json())
            .then(product => {
                addToCart(product, 1);
                setPendingProductId(null);
            })
            .catch(err => {
                console.error('Erreur lors de la récupération du produit:', err);
                setPendingProductId(null);
            });
    }, [pendingProductId, userId]);

    const lastRefreshTokenRef = useRef<number | string | null>(null);
    const lastUserRefreshRef = useRef<number | null>(null);

    const refreshCartProducts = async (itemsToRefresh: CartItem[]) => {
        const uniqueIds = Array.from(new Set(itemsToRefresh.map((item) => item.product.id)));
        if (uniqueIds.length === 0) {
            return;
        }

        try {
            const responses = await Promise.all(
                uniqueIds.map((id) =>
                    fetch(`/api/auth/products/${id}`, { credentials: 'include' }).then((res) => (res.ok ? res.json() : null))
                )
            );

            const productsById = new Map<number, Product>();
            responses.forEach((product) => {
                if (product && typeof product.id === 'number') {
                    productsById.set(product.id, product as Product);
                }
            });


            setItems((prev) =>
                prev.map((item) => {
                    const refreshed = productsById.get(item.product.id);
                    if (!refreshed) {
                        return item;
                    }

                    const hadUserMeta = !!item.product.db_user_attributes || !!item.product.db_user_transport;
                    const hasUserMeta = !!refreshed.db_user_attributes || !!refreshed.db_user_transport;

                    if (hadUserMeta && !hasUserMeta) {
                        return item;
                    }

                    return { ...item, product: refreshed };
                })
            );
        } catch (error) {
            console.error('Erreur lors du rafraichissement du panier:', error);
        }
    };

    useEffect(() => {
        if (!userId || typeof window === 'undefined') {
            lastUserRefreshRef.current = null;
            return;
        }

        if (lastUserRefreshRef.current === userId) {
            return;
        }

        const currentItems = itemsRef.current;
        if (currentItems.length === 0) {
            const stored = localStorage.getItem(getCartKey());
            const nextItems: CartItem[] = stored ? JSON.parse(stored) : [];
            setItems(nextItems);

            if (nextItems.length > 0) {
                void refreshCartProducts(nextItems);
            }
        } else {
            void refreshCartProducts(currentItems);
        }

        lastUserRefreshRef.current = userId;
    }, [userId]);

    useEffect(() => {
        if (!userId || !cart_refresh_token || items.length === 0) {
            lastRefreshTokenRef.current = cart_refresh_token ?? null;
            return;
        }

        if (lastRefreshTokenRef.current === cart_refresh_token) {
            return;
        }

        const currentItems = itemsRef.current;
        if (currentItems.length === 0) {
            lastRefreshTokenRef.current = cart_refresh_token ?? null;
            return;
        }

        void refreshCartProducts(currentItems).finally(() => {
            lastRefreshTokenRef.current = cart_refresh_token ?? null;
        });
    }, [cart_refresh_token, userId]);

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
