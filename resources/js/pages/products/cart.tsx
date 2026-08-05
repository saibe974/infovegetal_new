import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeftCircle, Flower2Icon, Minus, Plus, RefreshCw, Trash2, TruckIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/datePicker';
import { useI18n } from '@/lib/i18n';
import { CartContext } from '@/components/cart/cart.context';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { StickyBar } from '@/components/ui/sticky-bar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import BasicSticky from 'react-sticky-el';
import { ButtonsActions } from '@/components/buttons-actions';
import { buildRollDistribution, ProductRoll } from '@/components/products/product-roll';
import { buildCartTransportContext, calculateCartShipping, getCarrierOptions, getRenderedProductDeliveryPerRoll, getSupplierRollPrices } from '@/components/cart/cart-shipping';
import { getCartPricing } from '@/components/cart/cart-pricing';
import { getQuantityStep, getUniteQuantity } from '@/components/cart/cart-quantity-rules';
import { getProductCartImage } from '@/components/products/product-cart-image';
import { formatCurrency } from '@/lib/utils';
import { useCartOrder } from '@/components/cart/cart-order.context';
import { SharedData } from '@/types';
import { Separator } from '@/components/ui/separator';
import CountryFlag from '@/components/ui/country-flag';

type Props = Record<string, never>;

type CarrierOverrides = Record<number, { carrierId: number; zoneId: number }>;

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

const toText = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

const parseCarrierOverrides = (raw: string | null): CarrierOverrides | null => {
    if (!raw) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }

        const overrides: CarrierOverrides = {};
        Object.entries(parsed).forEach(([supplierId, value]) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) {
                return;
            }

            const carrierId = Number((value as Record<string, unknown>).carrierId);
            const zoneId = Number((value as Record<string, unknown>).zoneId);
            const normalizedSupplierId = Number(supplierId);
            if (normalizedSupplierId > 0 && carrierId > 0 && zoneId > 0) {
                overrides[normalizedSupplierId] = { carrierId, zoneId };
            }
        });

        return overrides;
    } catch {
        return null;
    }
};

const getAllowedDays = (
    groupedItems: Array<{ id: number; carrierOptions?: Array<{ carrierId: number }> }>,
    carrierOverrides: Record<number, { carrierId: number }>,
    cartCarriers: Record<string, { days: string[] | null }>,
): Set<number> => {
    const days = new Set<number>();
    for (const g of groupedItems) {
        const override = carrierOverrides[g.id];
        const cid = override?.carrierId ?? g.carrierOptions?.[0]?.carrierId;
        if (!cid) continue;
        const carrierDays = cartCarriers[String(cid)]?.days;
        if (!carrierDays) return new Set();
        carrierDays.forEach((d) => days.add(Number(d)));
    }
    return days;
};

const CarrierAwareDatePicker = ({
    deliveryDate,
    setDeliveryDate,
    groupedItems,
    carrierOverrides,
    cartCarriers,
    t,
}: {
    deliveryDate: string;
    setDeliveryDate: (v: string) => void;
    groupedItems: Array<{ id: number; carrierOptions?: Array<{ carrierId: number }> }>;
    carrierOverrides: Record<number, { carrierId: number }>;
    cartCarriers: Record<string, { days: string[] | null }>;
    t: (key: string) => string;
}) => {
    const allowedDays = getAllowedDays(groupedItems, carrierOverrides, cartCarriers);
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{t('Date de livraison souhaitée')}</label>
            <DatePicker
                value={deliveryDate}
                onChange={setDeliveryDate}
                allowedDays={allowedDays}
                placeholder={t('Choisir une date')}
            />
        </div>
    );
};

export default withAppLayout<Props>(
    breadcrumbs,
    false,
    () => {
        const { t } = useI18n();
        const { auth, cart, cart_contacts: cartContacts = {}, cart_db_countries: cartDbCountries = {}, cart_carriers: cartCarriers = {}, cart_transport_options: cartTransportOptions = {}, cart_transport_selection: storedTransportSelection = {} } = usePage<SharedData & {
            cart_contacts?: Record<string, {
                fact?: { id: number; name: string; email: string } | null;
                com?: { id: number; name: string; email: string } | null;
            }>;
            cart_db_countries?: Record<string, string | null>;
            cart_carriers?: Record<string, { name: string; days: string[] | null }>;
            cart_transport_options?: Record<string, {
                carrier_id: number;
                zone_id: number;
                zone_name: string;
                taxgo: number;
                tariffs: Record<string, number | string | null>;
            }>;
            cart_transport_selection?: Record<string, {
                carrier_id: number;
                zone_id: number;
            }>;
        }>().props;
        const cartId = cart?.id;
        const carrierOverridesStorageKey = `cart:carrier-overrides:${auth?.user?.id ?? 'guest'}:${cartId ?? 'draft'}`;
        const { items, updateQuantity, removeFromCart, clearCart, refreshCart } = useContext(CartContext);

        const [deliveryDate, setDeliveryDate] = useState('');
        const [isRefreshingCart, setIsRefreshingCart] = useState(false);
        const getStoredTransportSelection = useCallback((): CarrierOverrides =>
            Object.fromEntries(
                Object.entries(storedTransportSelection).map(([supplierId, choice]) => [
                    Number(supplierId),
                    { carrierId: Number(choice.carrier_id), zoneId: Number(choice.zone_id) },
                ]),
            ), [storedTransportSelection]);
        const [carrierOverrides, setCarrierOverrides] = useState<CarrierOverrides>(() => {
            const localOverrides = typeof window !== 'undefined'
                ? parseCarrierOverrides(localStorage.getItem(carrierOverridesStorageKey))
                : null;

            return localOverrides ?? getStoredTransportSelection();
        });
        const carrierStorageKeyRef = useRef(carrierOverridesStorageKey);

        useEffect(() => {
            if (typeof window === 'undefined') {
                return;
            }

            if (carrierStorageKeyRef.current !== carrierOverridesStorageKey) {
                carrierStorageKeyRef.current = carrierOverridesStorageKey;
                setCarrierOverrides(
                    parseCarrierOverrides(localStorage.getItem(carrierOverridesStorageKey))
                    ?? getStoredTransportSelection(),
                );
                return;
            }

            localStorage.setItem(carrierOverridesStorageKey, JSON.stringify(carrierOverrides));
        }, [carrierOverrides, carrierOverridesStorageKey, getStoredTransportSelection]);

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
        }, [items.length, refreshCart, t]);

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
                const transport = buildCartTransportContext(cartItems);
                const shippingSummary = calculateCartShipping(cartItems, carrierOverrides, cartTransportOptions);
                const override = carrierOverrides[group.id];
                const originalAttributes = transport.attrsBySupplier[group.id];
                const selectedAttributes = override && originalAttributes
                    ? { ...originalAttributes, t: override.carrierId, z: override.zoneId }
                    : originalAttributes;
                const selectedTransport = override
                    ? cartTransportOptions[`${override.carrierId}:${override.zoneId}`]
                    : transport.transportBySupplier[group.id];
                const supplier = buildRollDistribution(cartItems).suppliers[group.id];
                const renderedDeliveryPerRoll = override && supplier
                    ? getRenderedProductDeliveryPerRoll(supplier, selectedAttributes, selectedTransport)
                    : null;
                const pricedItems = renderedDeliveryPerRoll === null
                    ? group.items
                    : group.items.map((item) => ({
                        ...item,
                        pricing: getCartPricing(item.product, item.quantity, { renderedDeliveryPerRoll }),
                    }));
                const itemsTotal = pricedItems.reduce((sum, item) => sum + item.pricing.lineTotal, 0);
                const deliveryTotal = shippingSummary.total;
                const orderTotal = itemsTotal + deliveryTotal;
                const country = String(cartDbCountries[String(group.id)] ?? '').trim().toUpperCase();
                const contacts = cartContacts[String(group.id)] ?? null;
                const facturant = contacts?.fact ?? null;
                const commercial = contacts?.com ?? null;
                const attrs = transport.attrsBySupplier[group.id];
                const carrierOptions = getCarrierOptions(attrs);

                return {
                    ...group,
                    items: pricedItems,
                    cartItems,
                    itemsTotal,
                    shipping: shippingSummary,
                    transportContext: transport,
                    deliveryTotal,
                    orderTotal,
                    country,
                    facturant,
                    commercial,
                    carrierOptions,
                    selectedAttributes,
                    selectedTransport,
                };
            });
        }, [itemsPricing, getGroupLabel, cartContacts, cartDbCountries, carrierOverrides, cartTransportOptions]);

        const itemsTotal = groupedItems.reduce((sum, group) => sum + group.itemsTotal, 0);
        const deliveryTotal = groupedItems.reduce((sum, group) => sum + group.deliveryTotal, 0);
        const orderTotal = itemsTotal + deliveryTotal;

        const orderOverrides = useMemo(() => ({
            transportSelection: Object.fromEntries(
                Object.entries(carrierOverrides).map(([supplierId, choice]) => [
                    Number(supplierId),
                    { carrier_id: choice.carrierId, zone_id: choice.zoneId },
                ]),
            ),
            pricingByProductId: Object.fromEntries(
                groupedItems.flatMap((group) => group.items.map((item) => [
                    item.product.id,
                    { unitPrice: item.pricing.unitPrice, lineTotal: item.pricing.lineTotal },
                ])),
            ),
            shippingTotal: deliveryTotal,
        }), [carrierOverrides, groupedItems, deliveryTotal]);

        const handleQuantityChange = (productId: number, next: number) => {
            updateQuantity(productId, next);
        };

        const handleCarrierChange = useCallback((
            supplierId: number,
            carrierOptions: Array<{ carrierId: number; zoneId: number }>,
            selectedIndex: string,
        ) => {
            const option = carrierOptions[Number(selectedIndex)];
            if (!option) {
                return;
            }

            const transportKey = `${option.carrierId}:${option.zoneId}`;
            if (!cartTransportOptions[transportKey]) {
                setPageMessage(t('Tarifs indisponibles pour le transporteur sélectionné'));
                return;
            }

            setPageMessage(null);
            setCarrierOverrides((previous) => ({
                ...previous,
                [supplierId]: { carrierId: option.carrierId, zoneId: option.zoneId },
            }));
        }, [cartTransportOptions, t]);

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
                                    save={() => void handleSaveCart(orderOverrides)}
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
                                                        group.selectedAttributes,
                                                        group.selectedTransport,
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
                                            {group.carrierOptions && group.carrierOptions.length > 1 ? (() => {
                                                const override = carrierOverrides[group.id];
                                                const currentIdx = override
                                                    ? group.carrierOptions!.findIndex(
                                                        (o) => o.carrierId === override.carrierId && o.zoneId === override.zoneId
                                                      )
                                                    : 0;
                                                const value = String(currentIdx >= 0 ? currentIdx : 0);
                                                return (
                                                    <div className="flex items-center justify-between gap-2 text-sm">
                                                        <span>{t('Transporteur')}</span>
                                                        <Select
                                                            value={value}
                                                            onValueChange={(value) =>
                                                                handleCarrierChange(group.id, group.carrierOptions!, value)
                                                            }
                                                        >
                                                            <SelectTrigger className="h-7 w-48 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {group.carrierOptions.map((option, idx) => (
                                                                    <SelectItem key={`${option.carrierId}-${option.zoneId}`} value={String(idx)}>
                                                                        {cartCarriers[String(option.carrierId)]?.name ?? `#${option.carrierId}`}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                );
                                            })() : group.carrierOptions && group.carrierOptions.length === 1 ? (
                                                <div className="flex items-center justify-between text-sm">
                                                    <span>{t('Transporteur')}</span>
                                                    <span className="text-muted-foreground">
                                                        {cartCarriers[String(group.carrierOptions[0].carrierId)]?.name ?? `#${group.carrierOptions[0].carrierId}`}
                                                    </span>
                                                </div>
                                            ) : null}
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
                                                    {!group.facturant ? (
                                                        '-'
                                                    ) : group.facturant.email ? (
                                                        <a
                                                            href={`mailto:${group.facturant.email}`}
                                                            className="text-primary hover:underline"
                                                        >
                                                            {group.facturant.name || group.facturant.email}
                                                        </a>
                                                    ) : (
                                                        group.facturant.name || '-'
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex flex-col text-sm font-semibold">
                                                <span>{t('Commercial')} : </span>
                                                <span className="text-right">
                                                    {!group.commercial ? (
                                                        '-'
                                                    ) : group.commercial.email ? (
                                                        <a href={`mailto:${group.commercial.email}`} className="text-primary hover:underline">
                                                            {group.commercial.name || group.commercial.email}
                                                        </a>
                                                    ) : (
                                                        group.commercial.name || '-'
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <CarrierAwareDatePicker
                                    deliveryDate={deliveryDate}
                                    setDeliveryDate={setDeliveryDate}
                                    groupedItems={groupedItems}
                                    carrierOverrides={carrierOverrides}
                                    cartCarriers={cartCarriers}
                                    t={t}
                                />

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
                                        onClick={() => void handleGenerateTcpdf(orderOverrides)}
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
