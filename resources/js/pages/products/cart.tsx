import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeftCircle, Flower2Icon, FlowerIcon, Minus, Plus, RefreshCw, Trash2, TruckIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { CartContext } from '@/components/cart/cart.context';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { Separator } from '@/components/ui/separator';
import CountryFlag from '@/components/ui/country-flag';

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
        const { cart, cart_contacts: cartContacts = {}, cart_db_countries: cartDbCountries = {} } = usePage<SharedData & {
            cart_contacts?: Record<string, {
                fact?: { id: number; name: string; email: string } | null;
                com?: { id: number; name: string; email: string } | null;
            }>;
            cart_db_countries?: Record<string, string | null>;
        }>().props;
        const cartId = cart?.id;
        const { items, updateQuantity, removeFromCart, clearCart, refreshCart } = useContext(CartContext);

        const [deliveryDate, setDeliveryDate] = useState('');
        const [isRefreshingCart, setIsRefreshingCart] = useState(false);

        // const [isRefreshingCart, setIsRefreshingCart] = useState(false);
        const {
            isSaving,
            saveMessage,
            handleSaveCart,
            handleGenerateTcpdf,
        } = useCartOrder();
        const [pageMessage, setPageMessage] = useState<string | null>(null);
        const hasRefreshedCartRef = useRef(false);

        useEffect(() => {
            if (hasRefreshedCartRef.current || items.length === 0) {
                return;
            }

            hasRefreshedCartRef.current = true;
            void refreshCart().catch(() => {
                setPageMessage(t('Erreur lors du rafraichissement des prix transport'));
            });
        }, [items.length, refreshCart]);

        const handleRefreshCart = useCallback(async () => {
            if (items.length === 0 || isRefreshingCart) {
                return;
            }

            setIsRefreshingCart(true);
            setPageMessage(null);
            try {
                await refreshCart();
                setPageMessage(t('Panier rafraichi avec les prix et transports utilisateur'));
                setTimeout(() => setPageMessage(null), 3000);
            } catch {
                setPageMessage(t('Erreur lors du rafraichissement des prix transport'));
            } finally {
                setIsRefreshingCart(false);
            }
        }, [items.length, isRefreshingCart, refreshCart, t]);


        const itemsPricing = useMemo(() =>
            items.map((item) => ({
                product: item.product,
                quantity: item.quantity,
                pricing: getCartPricing(item.product, item.quantity),
            })),
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
                const country = String(cartDbCountries[String(group.id)] ?? '').trim().toUpperCase();
                const contacts = cartContacts[String(group.id)] ?? null;
                const facturant = contacts?.fact ?? null;
                const commercial = contacts?.com ?? null;

                return {
                    ...group,
                    cartItems,
                    itemsTotal,
                    shipping: shippingSummary,
                    transportContext: transport,
                    transportDebugRows: Object.keys({
                        ...transport.attrsBySupplier,
                        ...transport.transportBySupplier,
                        ...shippingSummary.bySupplier,
                    })
                        .map((rawSupplierId) => Number(rawSupplierId))
                        .filter((supplierId) => Number.isFinite(supplierId) && supplierId > 0)
                        .sort((a, b) => a - b)
                        .map((supplierId) => {
                            const attrs = transport.attrsBySupplier[supplierId] ?? null;
                            const resolved = transport.transportBySupplier[supplierId] ?? null;
                            return {
                                supplierId,
                                rawT: attrs?.t ?? null,
                                rawZ: attrs?.z ?? null,
                                carrierId: resolved?.carrier_id ?? null,
                                zoneId: resolved?.zone_id ?? null,
                                zoneName: resolved?.zone_name ?? null,
                                taxgo: resolved?.taxgo ?? null,
                                mini: resolved?.tariffs?.mini ?? null,
                                shipping: shippingSummary.bySupplier[supplierId] ?? 0,
                            };
                        }),
                    deliveryTotal,
                    orderTotal,
                    country,
                    facturant,
                    commercial,
                };
            });
        }, [itemsPricing, getGroupLabel, cartContacts, cartDbCountries]);

        const itemsTotal = groupedItems.reduce((sum, group) => sum + group.itemsTotal, 0);
        const deliveryTotal = groupedItems.reduce((sum, group) => sum + group.deliveryTotal, 0);
        const orderTotal = itemsTotal + deliveryTotal;

        const handleQuantityChange = (productId: number, next: number) => {
            updateQuantity(productId, next);
        };

        // const handleRefreshCart = async () => {
        //     if (items.length === 0 || isRefreshingCart) {
        //         return;
        //     }

        //     setIsRefreshingCart(true);

        //     try {
        //         await refreshCart();
        //         setPageMessage('Panier mis a jour selon les acces DB utilisateur');
        //         setTimeout(() => setPageMessage(null), 3000);
        //     } catch (error) {
        //         console.error('Error refreshing cart:', error);
        //         setPageMessage('Erreur lors de la mise a jour du panier');
        //     } finally {
        //         setIsRefreshingCart(false);
        //     }
        // };

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
                                    <>
                                        &nbsp;<button
                                            type="button"
                                            className="rounded"
                                            onClick={handleCreateNewCart}
                                            title={t('Creer un nouveau panier')}
                                            disabled={isSaving}
                                        >
                                            <Badge variant="secondary" style={{ fontSize: '2rem' }}>#{cartId}</Badge>
                                        </button></>
                                ) : null}
                            </h1>
                        </div>

                        {items.length > 0 && (
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleRefreshCart}
                                    disabled={isRefreshingCart || isSaving}
                                >
                                    <RefreshCw className={cn('mr-2 h-4 w-4', isRefreshingCart ? 'animate-spin' : '')} />
                                    {t('Rafraichir')}
                                </Button>
                                <ButtonsActions
                                    save={handleSaveCart}
                                    delete={clearCart}
                                    saving={isSaving}
                                />
                            </div>
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
                            <div key={group.id}>
                                <Card>
                                    <CardHeader>
                                        <CardTitle>
                                            {<CountryFlag countryCode={group.country} className="inline-block w-6" />}
                                            &nbsp; {group.items.length} <Flower2Icon className='inline size-4' /> : {formatCurrency(group.itemsTotal)}
                                            &nbsp;-&nbsp;{<TruckIcon className='inline size-4' />}
                                            &nbsp;:&nbsp;{formatCurrency(group.deliveryTotal)}
                                            &nbsp;-&nbsp;Total : {formatCurrency(group.orderTotal)}
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="space-y-6">
                                        {/* Produits */}
                                        <div className="space-y-4">
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
                                                            <div className="relative h-20 w-20 shrink-0 rounded">
                                                                <img
                                                                    src={getProductCartImage(product)}
                                                                    alt={product.name}
                                                                    className="h-full w-full object-cover"
                                                                />
                                                                <Badge
                                                                    className={cn(
                                                                        "absolute -top-1 -right-1 rounded-full text-xs",
                                                                        quantity > 9 ? "size-6 px-1.5" : "size-5 px-2"
                                                                    )}
                                                                >
                                                                    {quantity}
                                                                </Badge>
                                                            </div>

                                                            <div className="space-y-1">
                                                                <p className="line-clamp-2 text-sm font-semibold leading-tight capitalize">
                                                                    {product.name}
                                                                </p>

                                                                {toText(product.ref) ? (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Ref: {toText(product.ref)}
                                                                    </p>
                                                                ) : null}

                                                                <p className="text-xs text-muted-foreground">
                                                                    {product.description}
                                                                </p>

                                                                <p className="text-base font-semibold">
                                                                    {formatCurrency(unitPrice)}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-1 flex-wrap items-center justify-between gap-4 md:justify-end">
                                                            <div className="flex items-center gap-3 rounded-lg bg-muted p-2">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() =>
                                                                        handleQuantityChange(product.id, quantity - step)
                                                                    }
                                                                >
                                                                    <Minus className="h-4 w-4" />
                                                                </Button>

                                                                <Input
                                                                    type="text"
                                                                    min={unite}
                                                                    value={quantity}
                                                                    onChange={(e) =>
                                                                        handleQuantityChange(
                                                                            product.id,
                                                                            parseInt(e.target.value, 10)
                                                                        )
                                                                    }
                                                                    className="h-8 w-16 border-0 text-center"
                                                                />

                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8"
                                                                    onClick={() =>
                                                                        handleQuantityChange(product.id, quantity + step)
                                                                    }
                                                                >
                                                                    <Plus className="h-4 w-4" />
                                                                </Button>
                                                            </div>

                                                            <div className="text-right">
                                                                <p className="text-lg font-semibold">
                                                                    {formatCurrency(lineTotal)}
                                                                </p>
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
                                        </div>

                                        {/* Séparateur */}
                                        <Separator />

                                        {/* Rolls */}
                                        <div className="space-y-4">

                                            <ProductRoll
                                                items={group.cartItems}
                                                getSupplierPrice={(supplier) =>
                                                    group.shipping.bySupplier[supplier.supplierId] ?? 0
                                                }
                                                getRollPrice={(supplier, roll, rollIndex) => {
                                                    const prices = getSupplierRollPrices(
                                                        supplier,
                                                        group.transportContext.attrsBySupplier[supplier.supplierId],
                                                        group.transportContext.transportBySupplier[supplier.supplierId],
                                                    );

                                                    return prices ? prices[rollIndex] ?? null : null;
                                                }}
                                            />
                                        </div>
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
                                    <div className={`mt-2 text-sm p-2 rounded ${pageMessage.includes("Erreur") ? " text-destructive border border-destructive" : " text-green-600 border border-green-600"}`}>
                                        {pageMessage}
                                    </div>
                                )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    {groupedItems.map((group) => (
                                        <div key={group.id} className="relative rounded-md border px-3 py-2">
                                            <div className="absolute -top-1 -left-2 shadow-sm">
                                                <CountryFlag countryCode={group.country} className="w-4" />
                                                {/* {isAdminUser && group.label ? ` ${group.label}` : ''} */}
                                            </div>
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
                                            <Separator className="my-2" />
                                            <div className="flex flex-col text-sm font-semibold">
                                                <span>{t('Facturant')} : </span>
                                                <span className="text-right">
                                                    {group.facturant?.email ? (
                                                        <a
                                                            href={`mailto:${group.facturant.email}`}
                                                            className="text-primary hover:underline"
                                                        >
                                                            {group.facturant.email}
                                                        </a>
                                                    ) : '-'}
                                                </span>
                                            </div>
                                            <div className="flex flex-col text-sm font-semibold">
                                                <span>{t('Commercial')} : </span>
                                                <span className="text-right">
                                                    {group.commercial?.email ? (
                                                        <a href={`mailto:${group.commercial.email}`} className="text-primary hover:underline">
                                                            {group.commercial.email}
                                                        </a>
                                                    ) : '-'}
                                                </span>
                                            </div>
                                            <Separator className="my-2" />
                                            <div className="text-xs text-muted-foreground space-y-1">
                                                <div className="font-semibold text-foreground">Debug transport</div>
                                                {group.transportDebugRows.length === 0 ? (
                                                    <div>Aucune donnee transport</div>
                                                ) : (
                                                    group.transportDebugRows.map((row) => (
                                                        <div key={`${group.id}-${row.supplierId}`} className="rounded border px-2 py-1">
                                                            <div>DB {row.supplierId} - cout {formatCurrency(row.shipping)}</div>
                                                            <div>t={typeof row.rawT === 'string' ? row.rawT : JSON.stringify(row.rawT)}</div>
                                                            <div>z={String(row.rawZ ?? '')}</div>
                                                            <div>carrier={String(row.carrierId ?? '')} zone={String(row.zoneId ?? '')} ({row.zoneName ?? ''})</div>
                                                            <div>mini={String(row.mini ?? '')} tva={String(row.taxgo ?? '')}</div>
                                                        </div>
                                                    ))
                                                )}
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
