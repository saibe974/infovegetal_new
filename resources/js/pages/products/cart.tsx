import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeftCircle, FlowerIcon, Minus, Pencil, Plus, RefreshCw, Trash2, TruckIcon } from 'lucide-react';
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
import { getCarrierOverridesStorageKey, readCarrierOverrides, writeCarrierOverrides, type CarrierOverrides } from '@/components/cart/cart-carrier-storage';
import { getEffectiveUser, hasAnyRole, hasPermission } from '@/lib/roles';
import {
    getCartDiscountsStorageKey,
    readCartDiscounts,
    writeCartDiscounts,
    type CartDiscountDraft as DbDiscountDraft,
    type CartDiscountType as DiscountType,
} from '@/components/cart/cart-discount-storage';

type Props = Record<string, never>;

const parseDiscountValue = (value: string): number => {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const calculateDiscountAmount = (grossTotal: number, discount?: DbDiscountDraft): number => {
    if (!discount || grossTotal <= 0) return 0;

    const value = parseDiscountValue(discount.value);
    const amount = discount.type === 'percent'
        ? grossTotal * Math.min(100, value) / 100
        : Math.min(grossTotal, value);

    return Math.round(amount * 100) / 100;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

const toText = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

type CartCarrierTiming = {
    name: string;
    days: string[] | null;
    minimum_delay_hours: number;
    order_cutoff_time: string;
};

const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getDayOfWeek = (dateStr: string): number => {
    const date = new Date(`${dateStr}T00:00:00`);
    return ((date.getDay() + 6) % 7) + 1;
};

const getCarrierMinimumDeliveryDate = (carrier: CartCarrierTiming, now = new Date()): string => {
    const delayHours = Math.max(0, Number(carrier.minimum_delay_hours ?? 24));
    const cutoffMatch = String(carrier.order_cutoff_time ?? '12:00').match(/^(\d{1,2}):(\d{2})/);
    const cutoffMinutes = cutoffMatch
        ? Number(cutoffMatch[1]) * 60 + Number(cutoffMatch[2])
        : 12 * 60;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const cutoffPenaltyHours = currentMinutes >= cutoffMinutes ? 24 : 0;
    const candidate = new Date(now.getTime() + (delayHours + cutoffPenaltyHours) * 60 * 60 * 1000);
    const allowedDays = new Set((carrier.days ?? []).map(Number));

    if (allowedDays.size > 0) {
        for (let offset = 0; offset < 14; offset += 1) {
            const weekday = ((candidate.getDay() + 6) % 7) + 1;
            if (allowedDays.has(weekday)) break;
            candidate.setDate(candidate.getDate() + 1);
            candidate.setHours(0, 0, 0, 0);
        }
    }

    return formatLocalDate(candidate);
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
    cartCarriers: Record<string, CartCarrierTiming>;
    t: (key: string) => string;
}) => {
    const allowedDays = getAllowedDays(groupedItems, carrierOverrides, cartCarriers);
    const minimumDate = groupedItems.reduce((latestDate, group) => {
        const carrierId = carrierOverrides[group.id]?.carrierId ?? group.carrierOptions?.[0]?.carrierId;
        const carrier = carrierId ? cartCarriers[String(carrierId)] : undefined;
        if (!carrier) return latestDate;
        const carrierDate = getCarrierMinimumDeliveryDate(carrier);
        return carrierDate > latestDate ? carrierDate : latestDate;
    }, '');

    useEffect(() => {
        if (!minimumDate) return;

        const deliveryWeekday = deliveryDate ? getDayOfWeek(deliveryDate) : null;
        const invalidWeekday = deliveryWeekday !== null && allowedDays.size > 0 && !allowedDays.has(deliveryWeekday);
        if (!deliveryDate || deliveryDate < minimumDate || invalidWeekday) {
            setDeliveryDate(minimumDate);
        }
    }, [allowedDays, deliveryDate, minimumDate, setDeliveryDate]);

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{t('Date de livraison souhaitée')}</label>
            <DatePicker
                value={deliveryDate}
                onChange={setDeliveryDate}
                allowedDays={allowedDays}
                minDate={minimumDate}
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
        const { auth, cart, cart_contacts: cartContacts = {}, cart_db_countries: cartDbCountries = {}, cart_carriers: cartCarriers = {}, cart_transport_options: cartTransportOptions = {}, cart_transport_selection: storedTransportSelection = {}, cart_discounts: storedDiscounts = {} } = usePage<SharedData & {
            cart_contacts?: Record<string, {
                fact?: { id: number; name: string; email: string } | null;
                com?: { id: number; name: string; email: string } | null;
            }>;
            cart_db_countries?: Record<string, string | null>;
            cart_carriers?: Record<string, CartCarrierTiming>;
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
            cart_discounts?: Record<string, {
                type: DiscountType;
                value: number;
            }>;
        }>().props;
        const cartId = cart?.id;
        const carrierOverridesStorageKey = getCarrierOverridesStorageKey(auth?.user?.id, cartId);
        const discountsStorageKey = getCartDiscountsStorageKey(auth?.user?.id, cartId);
        const {
            items,
            updateQuantity,
            updateComment,
            orderComment,
            setOrderComment,
            removeFromCart,
            clearCart,
            refreshCart,
        } = useContext(CartContext);

        const [deliveryDate, setDeliveryDate] = useState('');
        const [openCommentProductIds, setOpenCommentProductIds] = useState<Set<number>>(() => new Set());
        const [isRefreshingCart, setIsRefreshingCart] = useState(false);

        const toggleProductComment = useCallback((productId: number) => {
            setOpenCommentProductIds((current) => {
                const next = new Set(current);
                if (next.has(productId)) next.delete(productId);
                else next.add(productId);
                return next;
            });
        }, []);
        const getStoredDiscounts = useCallback((): Record<number, DbDiscountDraft> =>
            Object.fromEntries(
                Object.entries(storedDiscounts).map(([dbId, discount]) => [
                    Number(dbId),
                    {
                        type: discount.type === 'percent' ? 'percent' : 'fixed',
                        value: String(discount.value ?? 0),
                    },
                ]),
            ),
            [storedDiscounts]);
        const [discountsByDb, setDiscountsByDb] = useState<Record<number, DbDiscountDraft>>(() =>
            readCartDiscounts(discountsStorageKey) ?? getStoredDiscounts(),
        );
        const discountsStorageKeyRef = useRef(discountsStorageKey);
        const effectiveUser = getEffectiveUser(auth);
        const canEditDiscount = hasAnyRole(effectiveUser, ['dev', 'admin', 'commercial'])
            || hasPermission(effectiveUser, 'order.remise');

        useEffect(() => {
            if (discountsStorageKeyRef.current !== discountsStorageKey) {
                discountsStorageKeyRef.current = discountsStorageKey;
                setDiscountsByDb(readCartDiscounts(discountsStorageKey) ?? getStoredDiscounts());
                return;
            }

            writeCartDiscounts(discountsStorageKey, discountsByDb);
        }, [discountsByDb, discountsStorageKey, getStoredDiscounts]);
        const getStoredTransportSelection = useCallback((): CarrierOverrides =>
            Object.fromEntries(
                Object.entries(storedTransportSelection).map(([supplierId, choice]) => [
                    Number(supplierId),
                    { carrierId: Number(choice.carrier_id), zoneId: Number(choice.zone_id) },
                ]),
            ), [storedTransportSelection]);
        const [carrierOverrides, setCarrierOverrides] = useState<CarrierOverrides>(() => {
            const localOverrides = readCarrierOverrides(carrierOverridesStorageKey);

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
                    readCarrierOverrides(carrierOverridesStorageKey)
                    ?? getStoredTransportSelection(),
                );
                return;
            }

            const overridesWithTransport = Object.fromEntries(
                Object.entries(carrierOverrides).map(([supplierId, choice]) => [
                    Number(supplierId),
                    {
                        ...choice,
                        transport: choice.transport
                            ?? cartTransportOptions[`${choice.carrierId}:${choice.zoneId}`],
                    },
                ]),
            );
            writeCarrierOverrides(carrierOverridesStorageKey, overridesWithTransport);
        }, [carrierOverrides, carrierOverridesStorageKey, cartTransportOptions, getStoredTransportSelection]);

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
                comment: item.comment,
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
                const cartItems = group.items.map(({ product, quantity, comment }) => ({ product, quantity, comment }));
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
                const grossTotal = itemsTotal + deliveryTotal;
                const discountAmount = calculateDiscountAmount(grossTotal, discountsByDb[group.id]);
                const orderTotal = Math.max(0, grossTotal - discountAmount);
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
                    discountAmount,
                    orderTotal,
                    country,
                    facturant,
                    commercial,
                    carrierOptions,
                    selectedAttributes,
                    selectedTransport,
                };
            });
        }, [itemsPricing, getGroupLabel, cartContacts, cartDbCountries, carrierOverrides, cartTransportOptions, discountsByDb]);

        const itemsTotal = groupedItems.reduce((sum, group) => sum + group.itemsTotal, 0);
        const deliveryTotal = groupedItems.reduce((sum, group) => sum + group.deliveryTotal, 0);
        const discountTotal = groupedItems.reduce((sum, group) => sum + group.discountAmount, 0);
        const orderTotal = Math.max(0, itemsTotal + deliveryTotal - discountTotal);

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
            shippingByDb: Object.fromEntries(
                groupedItems.map((group) => [group.id, group.deliveryTotal]),
            ),
            discounts: canEditDiscount
                ? Object.fromEntries(
                    groupedItems
                        .map((group) => {
                            const discount = discountsByDb[group.id];
                            return discount
                                ? [group.id, { type: discount.type, value: parseDiscountValue(discount.value) }]
                                : null;
                        })
                        .filter((entry): entry is [number, { type: DiscountType; value: number }] => entry !== null),
                )
                : undefined,
        }), [carrierOverrides, groupedItems, deliveryTotal, canEditDiscount, discountsByDb]);

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
                [supplierId]: {
                    carrierId: option.carrierId,
                    zoneId: option.zoneId,
                    transport: cartTransportOptions[transportKey],
                },
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

                clearCart({ skipConfirmation: true });
                setPageMessage(t('Panier actif vide. Enregistrez pour creer un nouvel identifiant.'));
                router.reload({ only: ['cart', 'cart_refresh_token'] });
            } catch (error) {
                console.error('Error creating new cart:', error);
                setPageMessage(t('Erreur lors de la preparation du nouveau panier'));
            }
        };

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
                                {t('Order')}
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
                                            &nbsp; {group.items.length} <FlowerIcon className='inline size-4' /> : {formatCurrency(group.itemsTotal)}
                                            &nbsp;-&nbsp;{<TruckIcon className='inline size-4' />}
                                            &nbsp;:&nbsp;{formatCurrency(group.deliveryTotal)}
                                            &nbsp;-&nbsp;Total : {formatCurrency(group.orderTotal)}
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="space-y-6">
                                        {/* Produits */}
                                        <div className="overflow-hidden rounded-lg border">
                                            <div className="hidden grid-cols-[5rem_minmax(0,1fr)_7rem_11rem_7rem_5rem] items-center gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
                                                <span>{t('Photo')}</span>
                                                <span>{t('Désignation')}</span>
                                                <span className="text-right">{t('Prix')}</span>
                                                <span className="text-center">{t('Quantité')}</span>
                                                <span className="text-right">{t('Total')}</span>
                                                <span className="text-center">{t('Actions')}</span>
                                            </div>
                                            {group.items.map(({ product, quantity, comment, pricing }) => {
                                                const unitPrice = pricing.unitPrice;
                                                const lineTotal = pricing.lineTotal;
                                                const unite = getUniteQuantity(product);
                                                const step = getQuantityStep(product, quantity);
                                                const isCommentOpen = openCommentProductIds.has(product.id);
                                                const hasComment = comment.trim() !== '';

                                                return (
                                                    <div
                                                        key={product.id}
                                                        className="border-b last:border-b-0"
                                                    >
                                                        <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 p-3 md:grid-cols-[5rem_minmax(0,1fr)_7rem_11rem_7rem_5rem]">
                                                            <div className="relative row-span-5 h-20 w-20 shrink-0 overflow-hidden rounded md:row-span-1">
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

                                                            <div className="min-w-0 space-y-1">
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
                                                            </div>

                                                            <div className="text-sm font-medium md:text-right">
                                                                <span className="mr-2 text-xs text-muted-foreground md:hidden">{t('Prix')} :</span>
                                                                {formatCurrency(unitPrice)}
                                                            </div>

                                                            <div className="flex w-fit items-center gap-2 rounded-lg bg-muted p-1 md:justify-self-center">
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

                                                            <div className="text-sm font-semibold md:text-right">
                                                                <span className="mr-2 text-xs font-normal text-muted-foreground md:hidden">{t('Total')} :</span>
                                                                {formatCurrency(lineTotal)}
                                                            </div>

                                                            <div className="flex items-center md:justify-center">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className={cn('h-8 w-8', (hasComment || isCommentOpen) && 'text-primary')}
                                                                    onClick={() => toggleProductComment(product.id)}
                                                                    aria-label={t(hasComment ? 'Modifier le commentaire' : 'Ajouter un commentaire')}
                                                                    title={t(hasComment ? 'Modifier le commentaire' : 'Ajouter un commentaire')}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                                                    onClick={() => removeFromCart(product.id)}
                                                                    aria-label={t('Retirer du panier')}
                                                                    title={t('Retirer du panier')}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {(hasComment || isCommentOpen) && (
                                                            <div className="border-t bg-muted/20 px-3 py-2 md:pl-[6.75rem]">
                                                                {isCommentOpen ? (
                                                                    <textarea
                                                                        id={`product-comment-${product.id}`}
                                                                        value={comment}
                                                                        autoFocus
                                                                        maxLength={2000}
                                                                        rows={2}
                                                                        onChange={(event) => updateComment(product.id, event.target.value)}
                                                                        placeholder={t('Ex. couleur souhaitée, consigne de préparation…')}
                                                                        aria-label={t('Commentaire pour ce produit')}
                                                                        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                                    />
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleProductComment(product.id)}
                                                                        className="flex w-full items-start gap-2 text-left text-sm text-muted-foreground hover:text-foreground"
                                                                        title={t('Modifier le commentaire')}
                                                                    >
                                                                        <Pencil className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                                                        <span className="whitespace-pre-wrap">{comment}</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
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
                                                onAddCarton={(productId, cond) => {
                                                    const item = group.cartItems.find(({ product }) => product.id === productId);
                                                    if (item) handleQuantityChange(productId, item.quantity + cond);
                                                }}
                                                onRemoveCarton={(productId, cond) => {
                                                    const item = group.cartItems.find(({ product }) => product.id === productId);
                                                    if (item) handleQuantityChange(productId, item.quantity - cond);
                                                }}
                                                onRemoveProduct={removeFromCart}
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
                        topOffset={0}
                        wrapperClassName="relative z-30"
                        stickyClassName="z-30"
                        stickyStyle={{ top: 0, zIndex: 30 }}
                    >
                        <Card
                            className="sidebar max-h-screen overflow-y-auto overscroll-auto"
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

                                            {canEditDiscount && (
                                                <div className="flex items-center justify-between gap-2 text-sm">
                                                    <span>{t('Remise')}</span>
                                                    <div className="flex items-center gap-1">
                                                        <Input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={discountsByDb[group.id]?.value ?? ''}
                                                            onChange={(event) => setDiscountsByDb((previous) => ({
                                                                ...previous,
                                                                [group.id]: {
                                                                    type: previous[group.id]?.type ?? 'percent',
                                                                    value: event.target.value,
                                                                },
                                                            }))}
                                                            className="h-7 w-20 text-right text-xs"
                                                            aria-label={t('Valeur de la remise')}
                                                        />
                                                        <Select
                                                            value={discountsByDb[group.id]?.type ?? 'percent'}
                                                            onValueChange={(value: DiscountType) => setDiscountsByDb((previous) => ({
                                                                ...previous,
                                                                [group.id]: {
                                                                    type: value,
                                                                    value: previous[group.id]?.value ?? '',
                                                                },
                                                            }))}
                                                        >
                                                            <SelectTrigger className="h-7 w-16 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="fixed">€</SelectItem>
                                                                <SelectItem value="percent">%</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            )}
                                            {!canEditDiscount && group.discountAmount > 0 && (
                                                <div className="flex items-center justify-between text-sm">
                                                    <span>
                                                        {t('Remise')} ({discountsByDb[group.id]?.value}{discountsByDb[group.id]?.type === 'percent' ? ' %' : ' €'})
                                                    </span>
                                                    <span className="font-semibold">- {formatCurrency(group.discountAmount)}</span>
                                                </div>
                                            )}
                                            {canEditDiscount && group.discountAmount > 0 && (
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span>{t('Montant de la remise')}</span>
                                                    <span>- {formatCurrency(group.discountAmount)}</span>
                                                </div>
                                            )}

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

                                <div className="space-y-2">
                                    <label htmlFor="order-comment" className="text-sm font-medium">
                                        {t('Commentaire général de la commande')}
                                    </label>
                                    <textarea
                                        id="order-comment"
                                        value={orderComment}
                                        maxLength={2000}
                                        rows={4}
                                        onChange={(event) => setOrderComment(event.target.value)}
                                        placeholder={t('Ajoutez une consigne valable pour toute la commande…')}
                                        className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                    <p className="text-right text-xs text-muted-foreground">
                                        {orderComment.length}/2000
                                    </p>
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
                                    {discountTotal > 0 && (
                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <span>{t('Remise')}</span>
                                            <span className="font-semibold">- {formatCurrency(discountTotal)}</span>
                                        </div>
                                    )}
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
