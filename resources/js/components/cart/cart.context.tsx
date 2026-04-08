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

type StoredCartItem = {
    product: Product;
    quantity: number;
};


export type CartContextType = {
    items: CartItem[];
    addToCart: (product: Product, quantity?: number) => void;
    removeFromCart: (productId: number) => void;
    updateQuantity: (productId: number, quantity: number) => void;
    clearCart: () => void;
    refreshCart: () => Promise<void>;
};

export const CartContext = createContext<CartContextType>({
    items: [],
    addToCart: () => { },
    removeFromCart: () => { },
    updateQuantity: () => { },
    clearCart: () => { },
    refreshCart: async () => { },
});

const sanitizeProductForStorage = (product: Product): Product => {
    const {
        dbProduct,
        category,
        tags,
        attributes,
        ...rest
    } = product;

    return {
        ...rest,
        dbProduct: dbProduct
            ? {
                id: typeof dbProduct.id === 'number' ? dbProduct.id : undefined,
                name: typeof dbProduct.name === 'string' ? dbProduct.name : undefined,
            }
            : null,
        category: category
            ? {
                id: category.id,
                name: category.name,
                parent_id: category.parent_id ?? null,
                depth: category.depth,
                has_children: category.has_children,
            }
            : null,
        tags: Array.isArray(tags)
            ? tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug }))
            : [],
        attributes: attributes ?? null,
    } as Product;
};

const parseStoredCart = (raw: string | null): CartItem[] => {
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed
            .filter((entry): entry is StoredCartItem => {
                return !!entry
                    && typeof entry === 'object'
                    && typeof (entry as StoredCartItem).quantity === 'number'
                    && !!(entry as StoredCartItem).product
                    && typeof (entry as StoredCartItem).product.id === 'number';
            })
            .map((entry) => ({
                product: entry.product,
                quantity: Math.max(1, Math.floor(entry.quantity)),
            }));
    } catch {
        return [];
    }
};

const serializeCart = (items: CartItem[]): string => {
    const compact = items.map((item) => ({
        product: sanitizeProductForStorage(item.product),
        quantity: item.quantity,
    }));

    return JSON.stringify(compact);
};


export function CartProvider({ children }: { children: React.ReactNode }) {
    const { auth, cart_refresh_token } = usePage<SharedData & { cart_refresh_token?: number | string | null }>().props;
    const userId = auth?.user?.id;

    const getCartKey = () => {
        return userId ? `cart:${userId}` : 'cart';
    };

    const [items, setItems] = useState<CartItem[]>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(getCartKey());
            return parseStoredCart(stored);
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

        const responses = await Promise.allSettled(
            uniqueIds.map(async (id) => {
                const res = await fetch(`/api/auth/products/${id}`, {
                    credentials: 'include',
                    cache: 'no-store',
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (!res.ok) {
                    throw new Error(`Cart refresh failed for product ${id} with status ${res.status}`);
                }

                return res.json();
            })
        );

        const productsById = new Map<number, Product>();
        responses.forEach((result) => {
            if (result.status !== 'fulfilled') {
                return;
            }

            const product = result.value;
            if (product && typeof product.id === 'number') {
                productsById.set(product.id, product as Product);
            }
        });

        if (productsById.size === 0) {
            throw new Error('Cart refresh failed for all products');
        }

        setItems((prev) =>
            prev.map((item) => {
                const refreshed = productsById.get(item.product.id);
                if (!refreshed) {
                    return item;
                }

                return { ...item, product: refreshed };
            })
        );
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
            const nextItems = parseStoredCart(stored);
            setItems(nextItems);

            if (nextItems.length > 0) {
                void refreshCartProducts(nextItems);
            }
        } else {
            void refreshCartProducts(currentItems);
        }

        lastUserRefreshRef.current = userId;
    }, [userId]);

    const refreshCart = async () => {
        const currentItems = itemsRef.current;
        if (!userId || currentItems.length === 0) {
            return;
        }

        await refreshCartProducts(currentItems);
    };

    useEffect(() => {
        if (!userId || !cart_refresh_token || items.length === 0) {
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
    }, [cart_refresh_token, userId, items.length]);

    useEffect(() => {
        localStorage.setItem(getCartKey(), serializeCart(items));

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
                        ? { ...item, product, quantity: item.quantity + quantity }
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
        <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, refreshCart }}>
            {children}
        </CartContext.Provider>
    );
}
