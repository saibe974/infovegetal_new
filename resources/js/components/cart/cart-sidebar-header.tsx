import { buildRollDistribution } from '@/components/products/product-roll';
import { ProductRollDialog } from '@/components/products/product-roll-dialog';
import { ProductRollMini } from '@/components/products/product-roll-mini';
import { useI18n } from '@/lib/i18n';
import { SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import {
    CheckCircleIcon,
    EyeIcon,
    FlowerIcon,
    SaveIcon,
    Trash2Icon,
    Truck,
} from 'lucide-react';
import { useContext, useEffect, useMemo, useState } from 'react';
import HeadingSmall from '../heading-small';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '../ui/sidebar';
import {
    getCarrierOverridesStorageKey,
    readCarrierOverrides,
    subscribeToCarrierOverrides,
    type CarrierOverrides,
} from './cart-carrier-storage';
import { CartItem } from './cart-item';
import { useCartOrder } from './cart-order.context';
import { getCartPricing } from './cart-pricing';
import {
    buildCartTransportContext,
    calculateCartShipping,
    type CartTransportOption,
} from './cart-shipping';
import { CartContext } from './cart.context';

const validateCartButtonClassName =
    'bg-brand-main text-white dark:text-black hover:bg-brand-main-hover disabled:opacity-50';

export function CartSidebarHeader() {
    const { t } = useI18n();

    const { auth, cart } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;
    const cartId = cart?.id;

    const { items, clearCart } = useContext(CartContext);
    const { isSaving, saveMessage, handleSaveCart } = useCartOrder();
    const [isPreparingNewCart, setIsPreparingNewCart] = useState(false);
    const [newCartMessage, setNewCartMessage] = useState<string | null>(null);
    const [selectedRollSupplierId, setSelectedRollSupplierId] = useState<
        number | null
    >(null);
    const isBusy = isSaving || isPreparingNewCart;
    const feedbackMessage = newCartMessage ?? saveMessage;

    const carrierStorageKey = getCarrierOverridesStorageKey(user?.id, cartId);
    const [carrierOverrides, setCarrierOverrides] = useState<CarrierOverrides>(
        () => readCarrierOverrides(carrierStorageKey) ?? {},
    );

    useEffect(() => {
        setCarrierOverrides(readCarrierOverrides(carrierStorageKey) ?? {});
        return subscribeToCarrierOverrides(
            carrierStorageKey,
            setCarrierOverrides,
        );
    }, [carrierStorageKey]);

    const transportOptions = useMemo(
        () =>
            Object.fromEntries(
                Object.values(carrierOverrides)
                    .filter(
                        (
                            choice,
                        ): choice is typeof choice & {
                            transport: CartTransportOption;
                        } => !!choice.transport,
                    )
                    .map((choice) => [
                        `${choice.carrierId}:${choice.zoneId}`,
                        choice.transport,
                    ]),
            ),
        [carrierOverrides],
    );

    const shipping = useMemo(
        () => calculateCartShipping(items, carrierOverrides, transportOptions),
        [carrierOverrides, items, transportOptions],
    );

    const pricingByProductId = useMemo(() => {
        const result: Record<number, ReturnType<typeof getCartPricing>> = {};
        const itemsBySupplier = new Map<number, typeof items>();

        items.forEach((item) => {
            const supplierId = Number(
                item.product.db_products_id ?? item.product.dbProduct?.id ?? 0,
            );
            const group = itemsBySupplier.get(supplierId) ?? [];
            group.push(item);
            itemsBySupplier.set(supplierId, group);
        });

        itemsBySupplier.forEach((supplierItems, supplierId) => {
            const transportContext = buildCartTransportContext(supplierItems);
            const attributes = transportContext.attrsBySupplier[supplierId];
            const originalTransport =
                transportContext.transportBySupplier[supplierId];
            const override = carrierOverrides[supplierId];
            const selectedAttributes =
                override && attributes
                    ? {
                          ...attributes,
                          t: override.carrierId,
                          z: override.zoneId,
                      }
                    : attributes;
            const selectedTransport =
                override?.transport ??
                (override &&
                originalTransport?.carrier_id === override.carrierId &&
                originalTransport.zone_id === override.zoneId
                    ? originalTransport
                    : !override
                      ? originalTransport
                      : undefined);
            const supplier =
                buildRollDistribution(supplierItems).suppliers[supplierId];
            const renderedDeliveryPerRoll =
                shipping.renderedPerRoll[supplierId] ?? null;

            supplierItems.forEach((item) => {
                result[item.product.id] = getCartPricing(
                    item.product,
                    item.quantity,
                    renderedDeliveryPerRoll === null
                        ? {}
                        : { renderedDeliveryPerRoll },
                );
            });
        });

        return result;
    }, [carrierOverrides, items, shipping]);

    const total = items.reduce(
        (sum, item) =>
            sum +
            (
                pricingByProductId[item.product.id] ??
                getCartPricing(item.product, item.quantity)
            ).lineTotal,
        0,
    );
    const orderTotal = total + shipping.total;
    const selectedRollItems = useMemo(
        () =>
            selectedRollSupplierId === null
                ? []
                : items.filter(
                      (item) =>
                          Number(
                              item.product.db_products_id ??
                                  item.product.dbProduct?.id ??
                                  0,
                          ) === selectedRollSupplierId,
                  ),
        [items, selectedRollSupplierId],
    );
    const selectedRollTransport = useMemo(() => {
        if (selectedRollSupplierId === null || selectedRollItems.length === 0)
            return null;

        const context = buildCartTransportContext(selectedRollItems);
        const attributes = context.attrsBySupplier[selectedRollSupplierId];
        const originalTransport =
            context.transportBySupplier[selectedRollSupplierId];
        const override = carrierOverrides[selectedRollSupplierId];

        return {
            attributes:
                override && attributes
                    ? {
                          ...attributes,
                          t: override.carrierId,
                          z: override.zoneId,
                      }
                    : attributes,
            transport:
                override?.transport ??
                (override &&
                originalTransport?.carrier_id === override.carrierId &&
                originalTransport.zone_id === override.zoneId
                    ? originalTransport
                    : !override
                      ? originalTransport
                      : undefined),
        };
    }, [carrierOverrides, selectedRollItems, selectedRollSupplierId]);

    useEffect(() => {
        if (selectedRollSupplierId !== null && selectedRollItems.length === 0) {
            setSelectedRollSupplierId(null);
        }
    }, [selectedRollItems, selectedRollSupplierId]);
    const orderOverrides = useMemo(
        () => ({
            transportSelection: Object.fromEntries(
                Object.entries(carrierOverrides).map(([supplierId, choice]) => [
                    Number(supplierId),
                    { carrier_id: choice.carrierId, zone_id: choice.zoneId },
                ]),
            ),
            pricingByProductId: Object.fromEntries(
                Object.entries(pricingByProductId).map(
                    ([productId, pricing]) => [
                        Number(productId),
                        {
                            unitPrice: pricing.unitPrice,
                            lineTotal: pricing.lineTotal,
                        },
                    ],
                ),
            ),
            shippingTotal: shipping.total,
        }),
        [carrierOverrides, pricingByProductId, shipping.total],
    );

    const getFiltersUrl = () => {
        const location =
            typeof window !== 'undefined' ? window.location : { search: '' };
        const urlParams = new URLSearchParams(location.search);
        const params = new URLSearchParams();

        if (urlParams.get('q')) params.set('q', urlParams.get('q')!);
        if (urlParams.get('active'))
            params.set('active', urlParams.get('active')!);
        if (urlParams.get('category'))
            params.set('category', urlParams.get('category')!);
        if (urlParams.get('country'))
            params.set('country', urlParams.get('country')!);
        if (urlParams.get('pot')) params.set('pot', urlParams.get('pot')!);
        if (urlParams.get('height'))
            params.set('height', urlParams.get('height')!);

        params.set('cart', '1');

        return `/products?${params.toString()}`;
    };

    const handleCreateNewCart = async () => {
        if (!cartId) {
            return;
        }

        const confirmed = window.confirm(
            t(
                'Voulez-vous vider le panier actif et en preparer un nouveau sans identifiant ?',
            ),
        );

        if (!confirmed) {
            return;
        }

        setIsPreparingNewCart(true);
        setNewCartMessage(null);

        try {
            const csrfToken = (
                document.querySelector(
                    'meta[name="csrf-token"]',
                ) as HTMLMetaElement
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
                setNewCartMessage(
                    data?.message ||
                        t('Erreur lors de la preparation du nouveau panier'),
                );
                return;
            }

            clearCart({ skipConfirmation: true });
            setNewCartMessage(
                t(
                    'Panier actif vide. Enregistrez pour creer un nouvel identifiant.',
                ),
            );
            router.reload({ only: ['cart', 'cart_refresh_token'] });
        } catch (error) {
            console.error('Error creating new cart:', error);
            setNewCartMessage(
                t('Erreur lors de la preparation du nouveau panier'),
            );
        } finally {
            setIsPreparingNewCart(false);
        }
    };

    return (
        <div className="flex h-screen flex-col">
            {!isAuthenticated ? (
                <SidebarContent className="md:mt-14">
                    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
                        <div className="text-muted-foreground">
                            <HeadingSmall
                                title={t('Login required')}
                                description={t('to add products to the cart')}
                            />
                        </div>
                        <div className="flex w-full flex-col gap-2">
                            <Button
                                onClick={() => router.visit('/login')}
                                className=""
                            >
                                {t('Log in')}
                            </Button>
                            <Button
                                variant={'secondary'}
                                onClick={() => router.visit('/register')}
                                className=""
                            >
                                {t('Register')}
                            </Button>
                        </div>
                    </div>
                </SidebarContent>
            ) : (
                <>
                    <SidebarHeader className="pl-0">
                        {items.length > 0 && (
                            <>
                                <SidebarMenu className="flex w-full flex-shrink-0 flex-row justify-between gap-2 md:mt-14">
                                    <SidebarMenuItem className="w-fit">
                                        <SidebarMenuButton
                                            asChild
                                            title={t('Vider le panier')}
                                        >
                                            <button
                                                type="button"
                                                className="rounded p-2 hover:bg-muted"
                                                onClick={() => clearCart()}
                                            >
                                                <Trash2Icon className="size-5 text-destructive" />
                                            </button>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>

                                    {/* <SidebarMenuItem className="w-fit">
                                <SidebarMenuButton asChild title={t("Insérer dans le panier")}>
                                    <button
                                        type="button"
                                        className="p-2 rounded hover:bg-muted"
                                    >
                                        <DownloadIcon className="size-5" />
                                    </button>
                                </SidebarMenuButton>
                            </SidebarMenuItem> */}

                                    <SidebarMenuItem className="w-fit">
                                        <SidebarMenuButton
                                            asChild
                                            title={t('Voir le panier')}
                                        >
                                            <button
                                                type="button"
                                                className="rounded p-2 hover:bg-muted"
                                                onClick={() =>
                                                    router.visit(
                                                        getFiltersUrl(),
                                                    )
                                                }
                                            >
                                                <EyeIcon className="size-5" />
                                            </button>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>

                                    <SidebarMenuItem className="w-fit">
                                        <SidebarMenuButton
                                            asChild
                                            title={t('Sauvegarder le panier')}
                                        >
                                            <button
                                                type="button"
                                                className="rounded p-2 hover:bg-muted disabled:opacity-50"
                                                onClick={() =>
                                                    void handleSaveCart(
                                                        orderOverrides,
                                                    )
                                                }
                                                disabled={isBusy}
                                            >
                                                <SaveIcon className="size-5 text-primary" />
                                            </button>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>

                                    {cartId ? (
                                        <button
                                            type="button"
                                            className="rounded"
                                            onClick={handleCreateNewCart}
                                            title={t('Creer un nouveau panier')}
                                            disabled={isBusy}
                                        >
                                            <Badge variant="secondary">
                                                #{cartId}
                                            </Badge>
                                        </button>
                                    ) : null}

                                    <SidebarMenuItem className="flex w-fit items-center">
                                        <button
                                            type="button"
                                            className={`flex items-center rounded p-1 ${validateCartButtonClassName}`}
                                            onClick={() =>
                                                router.visit('/cart/checkout')
                                            }
                                            title={t('Valider le panier')}
                                            disabled={isBusy}
                                        >
                                            <CheckCircleIcon className="size-4" />
                                        </button>
                                    </SidebarMenuItem>
                                </SidebarMenu>

                                <div className="flex-shrink-0 rounded-md bg-muted px-2 py-1.5">
                                    <div className="my-1 flex items-center justify-between gap-4 text-sm font-medium">
                                        <span className="flex items-center gap-2">
                                            <FlowerIcon
                                                size={20}
                                                aria-hidden="true"
                                            />
                                            {total.toFixed(2)} €
                                        </span>
                                        <span
                                            className="flex items-center gap-2"
                                            title={t('Livraison')}
                                            aria-label={`${t('Livraison')} : ${shipping.total.toFixed(2)} €`}
                                        >
                                            <Truck
                                                size={20}
                                                aria-hidden="true"
                                            />
                                            {shipping.total.toFixed(2)} €
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between border-t pt-2 text-lg font-bold">
                                        <span>{t('Total')}</span>
                                        <span>
                                            {orderTotal?.toFixed(2) ?? 0} €
                                        </span>
                                    </div>

                                    {feedbackMessage && (
                                        <div
                                            className={`mt-2 rounded p-2 text-sm ${
                                                feedbackMessage.includes(
                                                    'Erreur',
                                                )
                                                    ? 'border border-destructive text-destructive'
                                                    : 'border border-green-600 text-green-600'
                                            }`}
                                        >
                                            {feedbackMessage}
                                        </div>
                                    )}
                                </div>

                                {items.length > 0 && (
                                    <div className="mt-1">
                                        <ProductRollMini
                                            items={items}
                                            getSupplierPrice={(supplier) =>
                                                shipping.bySupplier[
                                                    supplier.supplierId
                                                ] ?? 0
                                            }
                                            onSupplierClick={
                                                setSelectedRollSupplierId
                                            }
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </SidebarHeader>

                    <SidebarContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
                        <div className="my-2 flex w-full flex-col items-center justify-center gap-2">
                            {items.length === 0 && (
                                <>
                                    <div className="py-8 text-center text-sm text-muted-foreground">
                                        {t('Panier vide')}
                                    </div>
                                    <Link href="/products">
                                        <Button className="w-40 bg-brand-main underline transition-all duration-75 hover:bg-brand-main-hover">
                                            {t('Voir le catalogue')}
                                        </Button>
                                    </Link>
                                </>
                            )}

                            {items.map((item) => (
                                <CartItem
                                    key={item.product.id}
                                    product={item.product}
                                    quantity={item.quantity}
                                    comment={item.comment}
                                    pricingOverride={
                                        pricingByProductId[item.product.id]
                                    }
                                />
                            ))}
                        </div>
                    </SidebarContent>

                    {items.length > 0 && (
                        <SidebarFooter className="pb-6">
                            <Button
                                onClick={() => router.visit('/cart/checkout')}
                                className={validateCartButtonClassName}
                            >
                                {t('Valider le panier')}
                            </Button>
                        </SidebarFooter>
                    )}
                    <ProductRollDialog
                        open={selectedRollSupplierId !== null}
                        onOpenChange={(open) =>
                            !open && setSelectedRollSupplierId(null)
                        }
                        items={selectedRollItems}
                        getSupplierPrice={(supplier) =>
                            shipping.bySupplier[supplier.supplierId] ?? 0
                        }
                        getSupplierRollPrices={(supplier) =>
                            shipping.rollPrices[supplier.supplierId] ?? null
                        }
                    />
                </>
            )}
        </div>
    );
}
