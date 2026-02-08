import React, { useContext, useState } from "react";
import { CheckCircleIcon, DownloadIcon, EyeIcon, PlusCircleIcon, SaveIcon, Trash2Icon } from "lucide-react";
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
import { router, usePage } from "@inertiajs/react";
import { CartItem } from "./cart-item";
import { getCartPricing } from "./cart-pricing";
import { useI18n } from "@/lib/i18n";
import { SharedData } from "@/types";
import { Button } from "../ui/button";
import HeadingSmall from "../heading-small";
import { ProductRollMini } from "@/components/products/product-roll-mini";

export function CartSidebarHeader() {
    const { t } = useI18n();

    const { toggleSidebar } = useSidebar();

    const { auth } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;

    const { items, clearCart } = useContext(CartContext);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const total = items.reduce((sum, item) => {
        const pricing = getCartPricing(item.product, item.quantity);
        return sum + pricing.lineTotal;
    }, 0);

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
        if (urlParams.get("dbProductId"))
            params.set("dbProductId", urlParams.get("dbProductId")!);

        params.set("cart", "1");

        return `/products?${params.toString()}`;
    };

    const handleSaveCart = async () => {
        if (items.length === 0) {
            setSaveMessage("Le panier est vide");
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            const csrfToken = (
                document.querySelector(
                    'meta[name="csrf-token"]'
                ) as HTMLMetaElement
            )?.content;

            const response = await fetch("/cart/save", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken || "",
                },
                body: JSON.stringify({
                    items: items.map((item) => ({
                        id: item.product.id,
                        quantity: item.quantity,
                    })),
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setSaveMessage("Panier enregistré avec succès");
                setTimeout(() => setSaveMessage(null), 3000);
            } else {
                setSaveMessage(
                    data.message || "Erreur lors de la sauvegarde"
                );
            }
        } catch (error) {
            console.error("Error saving cart:", error);
            setSaveMessage("Erreur lors de la sauvegarde");
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePdf = async () => {
        if (items.length === 0) {
            setSaveMessage("Le panier est vide");
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            const csrfToken = (
                document.querySelector(
                    'meta[name="csrf-token"]'
                ) as HTMLMetaElement
            )?.content;

            const response = await fetch("/cart/generate-pdf", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": csrfToken || "",
                },
                body: JSON.stringify({
                    items: items.map((item) => ({
                        id: item.product.id,
                        quantity: item.quantity,
                    })),
                }),
            });

            if (response.ok) {
                // Créer un blob à partir de la réponse
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `panier-${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                setSaveMessage("PDF généré avec succès");
                setTimeout(() => setSaveMessage(null), 3000);
            } else {
                const data = await response.json();
                setSaveMessage(
                    data.message || "Erreur lors de la génération du PDF"
                );
            }
        } catch (error) {
            console.error("Error generating PDF:", error);
            setSaveMessage("Erreur lors de la génération du PDF");
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

                            <SidebarMenuItem className="w-fit">
                                <SidebarMenuButton asChild title={t("Insérer dans le panier")}>
                                    <button
                                        type="button"
                                        className="p-2 rounded hover:bg-muted"
                                    >
                                        <DownloadIcon className="size-5" />
                                    </button>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

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

                            <SidebarMenuItem className="w-fit">
                                <SidebarMenuButton asChild title={t("Valider le panier")}>
                                    <button
                                        type="button"
                                        className="p-2 rounded hover:bg-muted disabled:opacity-50"
                                        onClick={() => router.visit('/cart/checkout')}
                                        disabled={isSaving}
                                    >
                                        <CheckCircleIcon className="size-5 text-green-600" />
                                    </button>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>


                        <div className="flex-shrink-0">
                            <div className="my-2">Total : {total?.toFixed(2) ?? 0} €</div>

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
                                <ProductRollMini items={items} />
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
                                onClick={() => {
                                    router.visit('/cart/checkout');
                                    toggleSidebar('right');
                                }}
                                className="bg-brand-main hover:bg-brand-main-hover"
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
