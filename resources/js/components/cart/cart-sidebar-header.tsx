import React, { useContext, useEffect, useMemo, useState } from "react";
import { CheckCircleIcon, EyeIcon, FlowerIcon, SaveIcon, Trash2Icon, Truck } from "lucide-react";
import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "../ui/sidebar";
import { CartContext } from "./cart.context";
import { useCartOrder } from "./cart-order.context";
import { router, usePage, Link } from "@inertiajs/react";
import { CartItem } from "./cart-item";
import { getCartPricing } from "./cart-pricing";
import { useI18n } from "@/lib/i18n";
import { SharedData } from "@/types";
import { Button } from "../ui/button";
import HeadingSmall from "../heading-small";
import { ProductRollMini } from "@/components/products/product-roll-mini";
import { buildCartTransportContext, calculateCartShipping, getRenderedProductDeliveryPerRoll, type CartTransportOption } from "./cart-shipping";
import { Badge } from "../ui/badge";
import { buildRollDistribution } from '@/components/products/product-roll';
import { getCarrierOverridesStorageKey, readCarrierOverrides, subscribeToCarrierOverrides, type CarrierOverrides } from './cart-carrier-storage';

const validateCartButtonClassName = "bg-brand-main text-black hover:bg-brand-main-hover disabled:opacity-50";

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
    const isBusy = isSaving || isPreparingNewCart;
    const feedbackMessage = newCartMessage ?? saveMessage;

    const carrierStorageKey = getCarrierOverridesStorageKey(user?.id, cartId);
    const [carrierOverrides, setCarrierOverrides] = useState<CarrierOverrides>(() =>
        readCarrierOverrides(carrierStorageKey) ?? {},
    );

    useEffect(() => {
        setCarrierOverrides(readCarrierOverrides(carrierStorageKey) ?? {});
        return subscribeToCarrierOverrides(carrierStorageKey, setCarrierOverrides);
    }, [carrierStorageKey]);

    const transportOptions = useMemo(() => Object.fromEntries(
        Object.values(carrierOverrides)
            .filter((choice): choice is typeof choice & { transport: CartTransportOption } => !!choice.transport)
            .map((choice) => [`${choice.carrierId}:${choice.zoneId}`, choice.transport]),
    ), [carrierOverrides]);

    const pricingByProductId = useMemo(() => {
        const result: Record<number, ReturnType<typeof getCartPricing>> = {};
        const itemsBySupplier = new Map<number, typeof items>();

        items.forEach((item) => {
            const supplierId = Number(item.product.db_products_id ?? item.product.dbProduct?.id ?? 0);
            const group = itemsBySupplier.get(supplierId) ?? [];
            group.push(item);
            itemsBySupplier.set(supplierId, group);
        });

        itemsBySupplier.forEach((supplierItems, supplierId) => {
            const transportContext = buildCartTransportContext(supplierItems);
            const attributes = transportContext.attrsBySupplier[supplierId];
            const originalTransport = transportContext.transportBySupplier[supplierId];
            const override = carrierOverrides[supplierId];
            const selectedAttributes = override && attributes
                ? { ...attributes, t: override.carrierId, z: override.zoneId }
                : attributes;
            const selectedTransport = override?.transport
                ?? (override
                    && originalTransport?.carrier_id === override.carrierId
                    && originalTransport.zone_id === override.zoneId
                    ? originalTransport
                    : !override ? originalTransport : undefined);
            const supplier = buildRollDistribution(supplierItems).suppliers[supplierId];
            const renderedDeliveryPerRoll = override && supplier
                ? getRenderedProductDeliveryPerRoll(supplier, selectedAttributes, selectedTransport)
                : null;

            supplierItems.forEach((item) => {
                result[item.product.id] = getCartPricing(
                    item.product,
                    item.quantity,
                    renderedDeliveryPerRoll === null ? {} : { renderedDeliveryPerRoll },
                );
            });
        });

        return result;
    }, [carrierOverrides, items]);

    const total = items.reduce((sum, item) =>
        sum + (pricingByProductId[item.product.id] ?? getCartPricing(item.product, item.quantity)).lineTotal,
        0);
    const shipping = useMemo(
        () => calculateCartShipping(items, carrierOverrides, transportOptions),
        [carrierOverrides, items, transportOptions],
    );
    const orderTotal = total + shipping.total;
    const orderOverrides = useMemo(() => ({
        transportSelection: Object.fromEntries(
            Object.entries(carrierOverrides).map(([supplierId, choice]) => [
                Number(supplierId),
                { carrier_id: choice.carrierId, zone_id: choice.zoneId },
            ]),
        ),
        pricingByProductId: Object.fromEntries(
            Object.entries(pricingByProductId).map(([productId, pricing]) => [
                Number(productId),
                { unitPrice: pricing.unitPrice, lineTotal: pricing.lineTotal },
            ]),
        ),
        shippingTotal: shipping.total,
    }), [carrierOverrides, pricingByProductId, shipping.total]);

    const getFiltersUrl = () => {
        const location =
            typeof window !== "undefined" ? window.location : { search: "" };
        const urlParams = new URLSearchParams(location.search);
        const params = new URLSearchParams();

        if (urlParams.get("q")) params.set("q", urlParams.get("q")!);
        if (urlParams.get("active"))
            params.set("active", urlParams.get("active")!);
        if (urlParams.get("category"))
            params.set("category", urlParams.get("category")!);
        if (urlParams.get("country"))
            params.set("country", urlParams.get("country")!);
        if (urlParams.get("pot"))
            params.set("pot", urlParams.get("pot")!);
        if (urlParams.get("height"))
            params.set("height", urlParams.get("height")!);

        params.set("cart", "1");

        return `/products?${params.toString()}`;
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

        setIsPreparingNewCart(true);
        setNewCartMessage(null);

        try {
            const csrfToken = (
                document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
            )?.content;

            const response = await fetch(`/cart/${cartId}/status`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken || "",
                    "X-Requested-With": "XMLHttpRequest",
                },
                body: JSON.stringify({ status: "processed" }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                setNewCartMessage(data?.message || t("Erreur lors de la preparation du nouveau panier"));
                return;
            }

            clearCart();
            setNewCartMessage(t("Panier actif vide. Enregistrez pour creer un nouvel identifiant."));
            router.reload({ only: ["cart", "cart_refresh_token"] });
        } catch (error) {
            console.error("Error creating new cart:", error);
            setNewCartMessage(t("Erreur lors de la preparation du nouveau panier"));
        } finally {
            setIsPreparingNewCart(false);
        }
    };

    return (
        <div className="flex flex-col h-screen">
            {!isAuthenticated ? (
                <SidebarContent className="md:mt-14">
                    <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
                        <div className="text-muted-foreground">
                            <HeadingSmall
                                title={t("Login required")}
                                description={t(
                                    "to add products to the cart"
                                )}
                            />
                        </div>
                        <div className="flex flex-col gap-2 w-full">
                            <Button
                                onClick={() => router.visit('/login')}
                                className=""
                            >
                                {t("Log in")}
                            </Button>
                            <Button
                                variant={'secondary'}
                                onClick={() => router.visit('/register')}
                                className=""
                            >
                                {t("Register")}
                            </Button>
                        </div>
                    </div>
                </SidebarContent>
            ) : (
                <>
                    <SidebarHeader className="pl-0">
                        {items.length > 0 && (
                            <>
                                <SidebarMenu className="flex flex-row w-full justify-between gap-2 md:mt-14 flex-shrink-0">
                                    <SidebarMenuItem className="w-fit">
                                        <SidebarMenuButton asChild title={t("Vider le panier")}>
                                            <button
                                                type="button"
                                                className="p-2 rounded hover:bg-muted"
                                                onClick={clearCart}
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
                                        <SidebarMenuButton asChild title={t("Voir le panier")}>
                                            <button
                                                type="button"
                                                className="p-2 rounded hover:bg-muted"
                                                onClick={() => router.visit(getFiltersUrl())}
                                            >
                                                <EyeIcon className="size-5" />
                                            </button>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>

                                    <SidebarMenuItem className="w-fit">
                                        <SidebarMenuButton asChild title={t("Sauvegarder le panier")}>
                                            <button
                                                type="button"
                                                className="p-2 rounded hover:bg-muted disabled:opacity-50"
                                                onClick={() => void handleSaveCart(orderOverrides)}
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
                                            title={t("Creer un nouveau panier")}
                                            disabled={isBusy}
                                        >
                                            <Badge variant="secondary">#{cartId}</Badge>
                                        </button>
                                    ) : null}

                                    <SidebarMenuItem className="w-fit">
                                        <SidebarMenuButton asChild title={t("Valider le panier")}>
                                            <button
                                                type="button"
                                                className={`p-2 rounded ${validateCartButtonClassName}`}
                                                onClick={() => router.visit('/cart/checkout')}
                                                disabled={isBusy}
                                            >
                                                <CheckCircleIcon className="size-6" />
                                            </button>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>


                                <div className="flex-shrink-0 rounded-md bg-muted px-2 py-1.5">
                                    <div className="my-1 flex items-center justify-between gap-4 text-sm font-medium">
                                        <span className="flex items-center gap-2">
                                            <FlowerIcon size={20} aria-hidden="true" />
                                            {total.toFixed(2)} €
                                        </span>
                                        <span
                                            className="flex items-center gap-2"
                                            title={t("Livraison")}
                                            aria-label={`${t("Livraison")} : ${shipping.total.toFixed(2)} €`}
                                        >
                                            <Truck size={20} aria-hidden="true" />
                                            {shipping.total.toFixed(2)} €
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between border-t pt-2 text-lg font-bold">
                                        <span>{t("Total")}</span>
                                        <span>{orderTotal?.toFixed(2) ?? 0} €</span>
                                    </div>

                                    {feedbackMessage && (
                                        <div
                                            className={`mt-2 text-sm p-2 rounded ${feedbackMessage.includes("Erreur")
                                                ? " text-destructive border border-destructive"
                                                : " text-green-600 border border-green-600"
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
                                            getSupplierPrice={(supplier) => shipping.bySupplier[supplier.supplierId] ?? 0}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </SidebarHeader>


                    <SidebarContent className="flex flex-col gap-3 flex-1 overflow-y-auto min-h-0">
                        <div className="my-2 flex w-full flex-col items-center justify-center gap-2">
                            {items.length === 0 && (
                                <>
                                    <div className="text-center text-muted-foreground text-sm py-8">
                                        {t("Panier vide")}
                                    </div>
                                    <Link href='/products'>
                                        <Button className='w-40 underline bg-brand-main hover:bg-brand-main-hover  transition-all duration-75'>
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
                                    pricingOverride={pricingByProductId[item.product.id]}
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
                </>
            )}

        </div>
    );
}
