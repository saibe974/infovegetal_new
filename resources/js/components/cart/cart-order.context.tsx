import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CartContext } from './cart.context';
import { getCartPricing } from './cart-pricing';
import { calculateCartShipping } from './cart-shipping';

export type TransportSelection = Record<number, { carrier_id: number; zone_id: number; tva?: number }>;
export type DiscountSelection = Record<number, { type: 'fixed' | 'percent'; value: number }>;

export type CartOrderOverrides = {
    transportSelection?: TransportSelection;
    pricingByProductId?: Record<number, { unitPrice: number; lineTotal: number }>;
    shippingTotal?: number;
    shippingByDb?: Record<number, number>;
    discounts?: DiscountSelection;
};

export type PdfResult = {
    url: string;
    filename: string;
    orderNumber: string | null;
    itemsTotal?: number;
    shippingTotal?: number;
    csvCount?: number;
    origin: 'save' | 'order';
};

export type OrderConflict = {
    orderNumber?: string | null;
    resolve: (action: 'new' | 'append') => void;
};

export type CartOrderContextType = {
    isSaving: boolean;
    isPdfGenerating: boolean;
    pdfPhaseIndex: number;
    pdfCurrentGroup: { index: number; total: number; label: string } | null;
    pdfResult: PdfResult | null;
    orderConflict: OrderConflict | null;
    saveMessage: string | null;
    handleSaveCart: (overrides?: CartOrderOverrides) => Promise<void>;
    handleGenerateTcpdf: (overrides?: CartOrderOverrides) => Promise<void>;
    closePdfModal: () => void;
    handleDownloadGeneratedPdf: () => void;
    handleClearCartFromModal: () => void;
};

const CartOrderContext = createContext<CartOrderContextType>({
    isSaving: false,
    isPdfGenerating: false,
    pdfPhaseIndex: 0,
    pdfCurrentGroup: null,
    pdfResult: null,
    orderConflict: null,
    saveMessage: null,
    handleSaveCart: async () => { },
    handleGenerateTcpdf: async () => { },
    closePdfModal: () => { },
    handleDownloadGeneratedPdf: () => { },
    handleClearCartFromModal: () => { },
});

function getCsrfToken(): string {
    return (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null)?.content ?? '';
}

export function CartOrderProvider({ children }: { children: React.ReactNode }) {
    const { items, orderComment, clearCart } = useContext(CartContext);

    const [isSaving, setIsSaving] = useState(false);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    const [pdfPhaseIndex, setPdfPhaseIndex] = useState(0);
    const [pdfCurrentGroup, setPdfCurrentGroup] = useState<{ index: number; total: number; label: string } | null>(null);
    const [pdfResult, setPdfResult] = useState<PdfResult | null>(null);
    const [orderConflict] = useState<OrderConflict | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const buildTransportSelection = useCallback((selected?: TransportSelection): TransportSelection => {
        const selection: TransportSelection = {};

        items.forEach(({ product }) => {
            const dbProductId = Number(product.db_products_id ?? product.dbProduct?.id ?? 0);
            if (!Number.isFinite(dbProductId) || dbProductId <= 0 || selection[dbProductId]) {
                return;
            }

            const transport = product.db_user_transport;
            if (!transport || typeof transport !== 'object' || Array.isArray(transport)) {
                return;
            }

            const carrierId = Number((transport as { carrier_id?: unknown }).carrier_id ?? 0);
            const zoneId = Number((transport as { zone_id?: unknown }).zone_id ?? 0);
            if (!Number.isFinite(carrierId) || !Number.isFinite(zoneId) || carrierId <= 0 || zoneId <= 0) {
                return;
            }

            const taxgo = Number((transport as { taxgo?: unknown }).taxgo ?? 0);
            selection[dbProductId] = {
                carrier_id: carrierId,
                zone_id: zoneId,
                ...(Number.isFinite(taxgo) ? { tva: taxgo } : {}),
            };
        });

        return { ...selection, ...selected };
    }, [items]);

    const buildPayload = useCallback((overrides: CartOrderOverrides = {}) => {
        const itemsPricing = items.map(({ product, quantity, comment }) => ({
            product,
            quantity,
            comment,
            pricing: overrides.pricingByProductId?.[product.id] ?? getCartPricing(product, quantity),
        }));
        const shippingSummary = calculateCartShipping(items);
        const requestedShippingTotal = overrides.shippingTotal ?? shippingSummary.total;
        const deliveryTotal = Number.isFinite(requestedShippingTotal)
            ? Math.round(requestedShippingTotal * 100) / 100
            : 0;

        return {
            payload: {
                items: itemsPricing.map(({ product, quantity, comment, pricing }) => ({
                    id: product.id,
                    quantity,
                    comment,
                    unit_price: pricing.unitPrice,
                    line_total: pricing.lineTotal,
                })),
                comment: orderComment,
                shipping_total: deliveryTotal,
                ...(overrides.shippingByDb !== undefined ? { shipping_by_db: overrides.shippingByDb } : {}),
                ...(overrides.discounts !== undefined ? { discounts: overrides.discounts } : {}),
                transport_selection: buildTransportSelection(overrides.transportSelection),
            },
            itemsTotal: itemsPricing.reduce((sum, { pricing }) => sum + pricing.lineTotal, 0),
            deliveryTotal,
        };
    }, [items, orderComment, buildTransportSelection]);

    const closePdfModal = useCallback(() => {
        if (isPdfGenerating) return;
        if (pdfResult?.url && pdfResult.url.startsWith('blob:')) {
            window.URL.revokeObjectURL(pdfResult.url);
        }
        setPdfResult(null);
        setPdfCurrentGroup(null);
        setPdfPhaseIndex(0);
    }, [isPdfGenerating, pdfResult]);

    const handleDownloadGeneratedPdf = useCallback(() => {
        if (!pdfResult) return;
        const link = document.createElement('a');
        link.href = pdfResult.url;
        link.download = pdfResult.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [pdfResult]);

    const handleClearCartFromModal = useCallback(() => {
        clearCart({ skipConfirmation: true });
        closePdfModal();
        setSaveMessage('Panier vide');
        setTimeout(() => setSaveMessage(null), 3000);
    }, [clearCart, closePdfModal]);

    const handleSaveCart = useCallback(async (overrides: CartOrderOverrides = {}) => {
        if (items.length === 0) {
            setSaveMessage('Le panier est vide');
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            const { payload, itemsTotal, deliveryTotal } = buildPayload(overrides);
            const response = await fetch('/cart/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken(),
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (response.ok) {
                if (data?.pdf_download_url && data?.pdf_filename) {
                    setPdfResult({
                        url: data.pdf_download_url,
                        filename: data.pdf_filename,
                        orderNumber: data?.order_number ? String(data.order_number) : null,
                        itemsTotal: typeof data.items_total === 'number' ? data.items_total : itemsTotal,
                        shippingTotal: typeof data.shipping_total === 'number' ? data.shipping_total : deliveryTotal,
                        csvCount: typeof data.csv_files_count === 'number' ? data.csv_files_count : 0,
                        origin: 'save',
                    });
                }
                setSaveMessage('Panier enregistré avec succès, PDF généré');
                setTimeout(() => setSaveMessage(null), 3000);
            } else {
                setSaveMessage(data.message || 'Erreur lors de la sauvegarde');
            }
        } catch {
            setSaveMessage('Erreur lors de la sauvegarde');
        } finally {
            setIsSaving(false);
        }
    }, [items, buildPayload]);

    const handleGenerateTcpdf = useCallback(async (overrides: CartOrderOverrides = {}) => {
        if (items.length === 0) {
            setSaveMessage('Le panier est vide');
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setIsPdfGenerating(true);
        setPdfPhaseIndex(0);
        setPdfCurrentGroup(null);
        if (pdfResult?.url && pdfResult.url.startsWith('blob:')) {
            window.URL.revokeObjectURL(pdfResult.url);
        }
        setPdfResult(null);
        setSaveMessage(null);

        try {
            const { payload, itemsTotal, deliveryTotal } = buildPayload(overrides);
            const response = await fetch('/cart/generate-pdf-tcpdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': getCsrfToken(),
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                setSaveMessage(data?.message || 'Erreur lors de la generation TCPDF');
                return;
            }

            const blob = await response.blob();
            const csvCount = Number(response.headers.get('x-generated-csv-count') ?? 0);
            const url = window.URL.createObjectURL(blob);
            const contentDisposition = response.headers.get('content-disposition') ?? '';
            const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
            const extractedFilename = filenameMatch
                ? decodeURIComponent(filenameMatch[1] || filenameMatch[2] || '')
                : `panier-${new Date().toISOString().split('T')[0]}.pdf`;
            const orderMatch = extractedFilename.match(/^(\d{5})[_-]/);

            setPdfResult({
                url,
                filename: extractedFilename,
                orderNumber: orderMatch ? orderMatch[1] : null,
                itemsTotal,
                shippingTotal: deliveryTotal,
                csvCount: Number.isFinite(csvCount) ? csvCount : 0,
                origin: 'order',
            });

            setSaveMessage('Commande enregistree et PDF genere avec succes');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch {
            setSaveMessage('Erreur lors de la generation TCPDF');
        } finally {
            setIsSaving(false);
            setIsPdfGenerating(false);
        }
    }, [items, buildPayload, pdfResult]);

    const value = useMemo(() => ({
        isSaving,
        isPdfGenerating,
        pdfPhaseIndex,
        pdfCurrentGroup,
        pdfResult,
        orderConflict,
        saveMessage,
        handleSaveCart,
        handleGenerateTcpdf,
        closePdfModal,
        handleDownloadGeneratedPdf,
        handleClearCartFromModal,
    }), [
        isSaving, isPdfGenerating, pdfPhaseIndex, pdfCurrentGroup,
        pdfResult, orderConflict, saveMessage,
        handleSaveCart, handleGenerateTcpdf, closePdfModal,
        handleDownloadGeneratedPdf, handleClearCartFromModal,
    ]);

    return (
        <CartOrderContext.Provider value={value}>
            {children}
        </CartOrderContext.Provider>
    );
}

export function useCartOrder() {
    return useContext(CartOrderContext);
}
