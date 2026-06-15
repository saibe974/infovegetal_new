import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeftCircle, Minus, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { CartContext } from '@/components/cart/cart.context';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StickyBar } from '@/components/ui/sticky-bar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import BasicSticky from 'react-sticky-el';
import { ButtonsActions } from '@/components/buttons-actions';
import { ProductRoll } from '@/components/products/product-roll';
import { buildCartTransportContext, calculateCartShipping, getSupplierRollPrices } from '@/components/cart/cart-shipping';
import { getCartPricing } from '@/components/cart/cart-pricing';
import { getQuantityStep, getUniteQuantity } from '@/components/cart/cart-quantity-rules';
import { getProductCartImage } from '@/components/products/product-cart-image';
import { formatCurrency } from '@/lib/utils';
import { useCartOrder } from '@/components/cart/cart-order.context';
import { SharedData } from '@/types';

type Props = Record<string, never>;

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

const toText = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

export default withAppLayout<Props>(
    breadcrumbs,
    false,
    () => {
        const { t } = useI18n();
        const { cart } = usePage<SharedData>().props;
        const cartId = cart?.id;
        const { items, updateQuantity, removeFromCart, clearCart, refreshCart } = useContext(CartContext);

        // console.log(user)

        const [deliveryDate, setDeliveryDate] = useState('');

        const [isRefreshingCart, setIsRefreshingCart] = useState(false);
        const {
            isSaving,
            saveMessage,
            handleSaveCart,
            handleGenerateTcpdf,
        } = useCartOrder();
        const [pageMessage, setPageMessage] = useState<string | null>(null);


        const itemsPricing = useMemo(
            () => items.map(({ product, quantity }) => ({ product, quantity, pricing: getCartPricing(product, quantity) })),
            [items],
        );

        const getGroupKey = (product: { db_products_id?: number | null; dbProduct?: { id?: number | null } | null }) =>
            Number(product.db_products_id ?? product.dbProduct?.id ?? 0);

        const getGroupLabel = useCallback((product: { dbProduct?: { name?: string | null } | null; db_products_id?: number | null }) => {
            if (product.dbProduct?.name) return String(product.dbProduct.name);
            if (product.db_products_id) return `DB #${product.db_products_id}`;
            return t('Sans DB');
        }, [t]);

        const groupedItems = useMemo(() => {
            const groups = new Map<number, { id: number; label: string; items: typeof itemsPricing }>();

            itemsPricing.forEach((item) => {
                const groupId = getGroupKey(item.product);
                const label = getGroupLabel(item.product);
                const existing = groups.get(groupId);
                if (existing) {
                    existing.items.push(item);
                    return;
                }
                groups.set(groupId, { id: groupId, label, items: [item] });
            });

            return Array.from(groups.values()).map((group) => {
                const cartItems = group.items.map(({ product, quantity }) => ({ product, quantity }));
                const shippingSummary = calculateCartShipping(cartItems);
                const transport = buildCartTransportContext(cartItems);
                const itemsTotal = group.items.reduce((sum, item) => sum + item.pricing.lineTotal, 0);
                const deliveryTotal = shippingSummary.total;
                const orderTotal = itemsTotal + deliveryTotal;

                return {
                    ...group,
                    cartItems,
                    itemsTotal,
                    shipping: shippingSummary,
                    transportContext: transport,
                    deliveryTotal,
                    orderTotal,
                };
            });
        }, [itemsPricing, getGroupLabel]);

        const itemsTotal = groupedItems.reduce((sum, group) => sum + group.itemsTotal, 0);
        const deliveryTotal = groupedItems.reduce((sum, group) => sum + group.deliveryTotal, 0);
        const orderTotal = itemsTotal + deliveryTotal;

        const handleQuantityChange = (productId: number, next: number) => {
            updateQuantity(productId, next);
        };

        const handleRefreshCart = async () => {
            if (items.length === 0 || isRefreshingCart) {
                return;
            }

            setIsRefreshingCart(true);

            try {
                await refreshCart();
                setPageMessage('Panier mis a jour selon les acces DB utilisateur');
                setTimeout(() => setPageMessage(null), 3000);
            } catch (error) {
                console.error('Error refreshing cart:', error);
                setPageMessage('Erreur lors de la mise a jour du panier');
            } finally {
                setIsRefreshingCart(false);
            }
        };

        const handleCreateNewCart = async () => {
            if (!cartId) {
                return;
            }

            const confirmed = window.confirm(
                t("Voulez-vous vider le panier actif et en preparer un nouveau sans identifiant ?")
            );

            if (!confirmed) {
                return;
            }

            setPageMessage(null);

            try {
                const csrfToken = (
                    document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
                )?.content;

                const response = await fetch(`/cart/${cartId}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken || '',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ status: 'processed' }),
                });

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    setPageMessage(data?.message || t('Erreur lors de la preparation du nouveau panier'));
                    return;
                }

                clearCart();
                setPageMessage(t('Panier actif vide. Enregistrez pour creer un nouvel identifiant.'));
                router.reload({ only: ['cart', 'cart_refresh_token'] });
            } catch (error) {
                console.error('Error creating new cart:', error);
                setPageMessage(t('Erreur lors de la preparation du nouveau panier'));
            } finally {
            }
        };

        const [topOffset, setTopOffset] = useState<number>(0);

        useEffect(() => {
            const getHeight = () => {
                const header = document.querySelector('.top-sticky') as HTMLElement | null;
                const stickyBar = document.querySelector('.sticky-bar-cart') as HTMLElement | null;

                if (!header || !stickyBar) return 0;

                const headerHeight = header.getBoundingClientRect().height;
                const barHeight = stickyBar.getBoundingClientRect().height;
                const total = headerHeight + barHeight;

                // console.log('header height:', headerHeight, 'bar height:', barHeight, 'total:', total);
                return total;
            };

            const update = () => {
                const height = getHeight();
                if (height > 0) {
                    setTopOffset(height);
                }
            };

            // Attendre que le rendu soit complet et que le layout soit stable
            requestAnimationFrame(() => {
                setTimeout(() => {
                    update();
                    // Vérifier à nouveau après un délai
                    setTimeout(update, 200);
                }, 50);
            });

            // Mettre à jour sur resize
            const handleResize = () => {
                requestAnimationFrame(update);
            };
            window.addEventListener('resize', handleResize);



            return () => {
                window.removeEventListener('resize', handleResize);
            };
        }, []);

        return (
            <div className="">
                <Head title={t('Cart')} />
                <StickyBar
                    zIndex={20}
                    borderBottom={false}
                    className='mb-4 sticky-bar-cart'
                >
                    <div className='flex items-center justify-between w-full py-2'>
                        <div className="flex items-center gap-3">
                            <Link
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    window.history.back();
                                }}
                                className="hover:text-gray-500 transition-colors duration-200"
                            >
                                <ArrowLeftCircle size={32} />
                            </Link>
                            <h1 className="text-3xl font-bold">
                                {t('Panier')}
                                {cartId ? (
                                    <button
                                        type="button"
                                        className="rounded"
                                        onClick={handleCreateNewCart}
                                        title={t('Creer un nouveau panier')}
                                        disabled={isSaving}
                                    >
                                        <Badge variant="secondary" style={{ fontSize: '2rem' }}>#{cartId}</Badge>
                                    </button>
                                ) : null}
                            </h1>
                        </div>

                        {items.length > 0 && (
                            // <div className='space-x-2'>

                            //     <Button variant="default" onClick={handleSaveCart} className="" size="sm" disabled={isSaving}>
                            //         {t('Save')} <SaveIcon className="h-4 w-4" />
                            //     </Button>
                            //     <Button variant="ghost" onClick={clearCart} className="text-destructive" size="sm" disabled={isSaving}>
                            //         {t('Clear')}<Trash2 className="h-4 w-4" />
                            //     </Button>
                            // </div>
                            <ButtonsActions
                                refresh={handleRefreshCart}
                                save={handleSaveCart}
                                delete={clearCart}
                                refreshing={isRefreshingCart}
                                saving={isSaving}
                            />
                        )}
                    </div>
                </StickyBar>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-6">
                        {items.length === 0 && (
                            <Card>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
                                        <p>{t('Votre panier est vide')}</p>
                                        <Button asChild>
                                            <Link href={products.index().url}>{t('Voir les produits')}</Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {groupedItems.map((group) => (
                            <div key={group.id} className="space-y-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            {t('Produits')} - {group.label} ({group.items.length})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {group.items.map(({ product, quantity, pricing }) => {
                                            const unitPrice = pricing.unitPrice;
                                            const lineTotal = pricing.lineTotal;
                                            const unite = getUniteQuantity(product);
                                            const step = getQuantityStep(product, quantity);

                                            return (
                                                <div
                                                    key={product.id}
                                                    className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center"
                                                >
                                                    <div className="flex items-center gap-4 md:w-1/2">
                                                        <div className="h-20 w-20 rounded relative shrink-0">
                                                            <img
                                                                src={getProductCartImage(product)}
                                                                alt={product.name}
                                                                className="h-full w-full object-cover"
                                                            />
                                                            <Badge
                                                                className={cn(
                                                                    "absolute -top-1 -right-1 text-xs rounded-full",
                                                                    quantity > 9 ? "size-6 px-1.5" : "size-5 px-2"
                                                                )}
                                                            >
                                                                {quantity}
                                                            </Badge>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-sm font-semibold leading-tight line-clamp-2 capitalize">{product.name}</p>
                                                            {toText(product.ref) ? (
                                                                <p className="text-xs text-muted-foreground">Ref: {toText(product.ref)}</p>
                                                            ) : null}
                                                            <p className="text-xs text-muted-foreground">{t('Prix unitaire')}</p>
                                                            <p className="text-base font-semibold">{formatCurrency(unitPrice)}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-1 flex-wrap items-center justify-between gap-4 md:justify-end">
                                                        <div className="flex items-center gap-3 bg-muted rounded-lg p-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                aria-label={t('Diminuer la quantité')}
                                                                onClick={() => handleQuantityChange(product.id, quantity - step)}
                                                            >
                                                                <Minus className="h-4 w-4" />
                                                            </Button>
                                                            <Input
                                                                type="text"
                                                                min={unite}
                                                                value={quantity}
                                                                onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value, 10))}
                                                                className="w-16 h-8 text-center border-0"
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                aria-label={t('Augmenter la quantité')}
                                                                onClick={() => handleQuantityChange(product.id, quantity + step)}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>

                                                        <div className="text-right">
                                                            <p className="text-xs text-muted-foreground">{t('Total ligne')}</p>
                                                            <p className="text-lg font-semibold">{formatCurrency(lineTotal)}</p>
                                                        </div>

                                                        <Button
                                                            variant="ghost"
                                                            className="text-destructive"
                                                            onClick={() => removeFromCart(product.id)}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>{t('Rolls')}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ProductRoll
                                            items={group.cartItems}
                                            getSupplierPrice={(supplier) => group.shipping.bySupplier[supplier.supplierId] ?? 0}
                                            getRollPrice={(supplier, roll, rollIndex) => {
                                                const prices = getSupplierRollPrices(
                                                    supplier,
                                                    group.transportContext.attrsBySupplier[supplier.supplierId],
                                                    group.transportContext.transportBySupplier[supplier.supplierId],
                                                );

                                                return prices ? prices[rollIndex] ?? null : null;
                                            }}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>

                    <BasicSticky
                        topOffset={-topOffset}
                        stickyStyle={{ top: topOffset, }}
                    >
                        <Card
                            className="h-fit sidebar"
                        >
                            <CardHeader>
                                <CardTitle>{t('Récapitulatif')}</CardTitle>
                                {saveMessage && (
                                    <div
                                        className={`mt-2 text-sm p-2 rounded ${saveMessage.includes("Erreur")
                                            ? " text-destructive border border-destructive"
                                            : " text-green-600 border border-green-600"}`}
                                    >
                                        {saveMessage}
                                    </div>
                                )}
                                {pageMessage && (
                                    <div
                                        className={`mt-2 text-sm p-2 rounded ${pageMessage.includes("Erreur")
                                            ? " text-destructive border border-destructive"
                                            : " text-green-600 border border-green-600"
                                            }`}
                                    >
                                        {saveMessage}
                                    </div>
                                )}
                                {pageMessage && (
                                    <div className={`mt-2 text-sm p-2 rounded ${pageMessage.includes("Erreur") ? " text-destructive border border-destructive" : " text-green-600 border border-green-600"}`}>
                                        {pageMessage}
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    {groupedItems.map((group) => (
                                        <div key={group.id} className="rounded-md border px-3 py-2">
                                            <div className="text-xs text-muted-foreground">{group.label}</div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span>{t('Total produits')}</span>
                                                <span className="font-semibold">{formatCurrency(group.itemsTotal)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm">
                                                <span>{t('Frais de transport')}</span>
                                                <span className="font-semibold">{formatCurrency(group.deliveryTotal)}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-sm font-semibold">
                                                <span>{t('Total')}</span>
                                                <span>{formatCurrency(group.orderTotal)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('Date de livraison souhaitée')}</label>
                                    <Input
                                        type="date"
                                        value={deliveryDate}
                                        onChange={(e) => setDeliveryDate(e.target.value)}
                                    />
                                </div>

                                <div className="rounded-lg border p-3 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span>{t('Total produits')}</span>
                                        <span className="font-semibold">{formatCurrency(itemsTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span>{t('Frais de transport')}</span>
                                        <span className="font-semibold">{formatCurrency(deliveryTotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-base font-semibold">
                                        <span>{t('Total')}</span>
                                        <span>{formatCurrency(orderTotal)}</span>
                                    </div>
                                </div>



                                <div className="grid grid-cols-1 gap-2">
                                    <Button
                                        className="w-full bg-brand-main hover:bg-brand-main-hover"
                                        size="lg"
                                        disabled={items.length === 0 || isSaving}
                                        onClick={handleGenerateTcpdf}
                                    >
                                        {t('Commander')}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </BasicSticky>
                </div>
            </div>
        );
    },
    { showRightSidebar: false },
);
