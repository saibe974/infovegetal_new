import React, { useContext, useState } from "react";
import { CheckCircle, Eye, PlusCircle, Save, Trash2 } from "lucide-react";
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "../ui/sidebar";
import { CartContext } from "./cart.context";
import { router } from "@inertiajs/react";
import { CartItem } from "./cart-item";
import { useI18n } from "@/lib/i18n";

export function CartSidebarHeader() {
    const { t } = useI18n();
    const { items, clearCart } = useContext(CartContext);
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const total = items.reduce(
        (sum, item) => sum + item.product.price * item.quantity,
        0
    );

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

    return (
        <div className="flex flex-col h-screen">
            <SidebarMenu className="flex flex-row w-full justify-between gap-2 md:mt-14 flex-shrink-0">
                <SidebarMenuItem className="w-fit">
                    <SidebarMenuButton asChild title={t("Vider le panier")}>
                        <button
                            type="button"
                            className="p-2 rounded hover:bg-muted"
                            onClick={clearCart}
                        >
                            <Trash2 className="size-5 text-destructive" />
                        </button>
                    </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem className="w-fit">
                    <SidebarMenuButton asChild title={t("Insérer dans le panier")}>
                        <button
                            type="button"
                            className="p-2 rounded hover:bg-muted"
                        >
                            <PlusCircle className="size-5" />
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
                            <Eye className="size-5" />
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
                            <Save className="size-5 text-primary" />
                        </button>
                    </SidebarMenuButton>
                </SidebarMenuItem>

                <SidebarMenuItem className="w-fit">
                    <SidebarMenuButton asChild title={t("Valider le panier")}>
                        <button
                            type="button"
                            className="p-2 rounded hover:bg-muted"
                        >
                            <CheckCircle className="size-5 text-green-600" />
                        </button>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>

            <div className="flex-shrink-0">
                <div className="my-2">Total : {total.toFixed(2)} €</div>

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

            <div className="flex flex-col gap-3 mt-4 flex-1 overflow-y-auto min-h-0 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40 scrollbar-thumb-rounded-full pt-3">
                {items.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-8">
                        Panier vide
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
        </div>
    );
}
