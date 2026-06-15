import React, { useContext, useEffect, useMemo } from "react";
import { CheckCircleIcon, EyeIcon, SaveIcon, Trash2Icon, Truck } from "lucide-react";
import {
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "../ui/sidebar";
import { CartContext } from "./cart.context";
import { useCartOrder } from "./cart-order.context";
import { router, usePage } from "@inertiajs/react";
import { CartItem } from "./cart-item";
import { getCartPricing } from "./cart-pricing";
import { useI18n } from "@/lib/i18n";
import { SharedData } from "@/types";
import { Button } from "../ui/button";
import HeadingSmall from "../heading-small";
import { ProductRollMini } from "@/components/products/product-roll-mini";
import { calculateCartShipping } from "./cart-shipping";
import { Badge } from "../ui/badge";

const validateCartButtonClassName = "bg-brand-main text-black hover:bg-brand-main-hover disabled:opacity-50";

export function CartSidebarHeader() {
    const { t } = useI18n();

    const { toggleSidebar } = useSidebar();

    const { auth, cart } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;
    const cartId = cart?.id;

    const { items, clearCart } = useContext(CartContext);
    const { isSaving, saveMessage, handleSaveCart, handleGenerateTcpdf } = useCartOrder();

    const total = items.reduce((sum, item) => {
        const pricing = getCartPricing(item.product, item.quantity);
        return sum + pricing.lineTotal;
    }, 0);
    const shipping = useMemo(() => calculateCartShipping(items), [items]);
    const orderTotal = total + shipping.total;

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

        setIsSaving(true);
        setSaveMessage(null);

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
                setSaveMessage(data?.message || t("Erreur lors de la preparation du nouveau panier"));
                return;
            }

            clearCart();
            setSaveMessage(t("Panier actif vide. Enregistrez pour creer un nouvel identifiant."));
            router.reload({ only: ["cart", "cart_refresh_token"] });
        } catch (error) {
            console.error("Error creating new cart:", error);
            setSaveMessage(t("Erreur lors de la preparation du nouveau panier"));
        } finally {
            setIsSaving(false);
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
                    <SidebarHeader>
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
                                        onClick={handleSaveCart}
                                        disabled={isSaving}
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
                                    disabled={isSaving}
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
                                        disabled={isSaving}
                                    >
                                        <CheckCircleIcon className="size-6" />
                                    </button>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>


                        <div className="flex-shrink-0">
                            <div className="my-1 text-sm flex gap-2 items-center"><Truck size={20} /> : {shipping.total.toFixed(2)} €</div>
                            <div className="my-1">Total : {orderTotal?.toFixed(2) ?? 0} €</div>

                            {saveMessage && (
                                <div
                                    className={`mt-2 text-sm p-2 rounded ${saveMessage.includes("Erreur")
                                        ? " text-destructive border border-destructive"
                                        : " text-green-600 border border-green-600"
                                        }`}
                                >
                                    {saveMessage}
                                </div>
                            )}
                        </div>

                        {items.length > 0 && (
                            <div className="mt-4">
                                <ProductRollMini
                                    items={items}
                                    getSupplierPrice={(supplier) => shipping.bySupplier[supplier.supplierId] ?? 0}
                                />
                            </div>
                        )}
                    </SidebarHeader>

                    <SidebarContent className="flex flex-col gap-3 flex-1 overflow-y-auto min-h-0">
                        <div className="my-2 ">
                            {items.length === 0 && (
                                <div className="text-center text-muted-foreground text-sm py-8">
                                    {t("Panier vide")}
                                </div>
                            )}

                            {items.map((item) => (
                                <CartItem
                                    key={item.product.id}
                                    product={item.product}
                                    quantity={item.quantity}
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
