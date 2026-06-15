import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CartContext } from './cart.context';
import { getCartPricing } from './cart-pricing';
import { calculateCartShipping } from './cart-shipping';

export type PdfResult = {
    url: string;
    filename: string;
    orderNumber: string | null;
    itemsTotal?: number;
    shippingTotal?: number;
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
    handleSaveCart: () => Promise<void>;
    handleGenerateTcpdf: () => Promise<void>;
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
    const { items, clearCart } = useContext(CartContext);

    const [isSaving, setIsSaving] = useState(false);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    const [pdfPhaseIndex, setPdfPhaseIndex] = useState(0);
    const [pdfCurrentGroup, setPdfCurrentGroup] = useState<{ index: number; total: number; label: string } | null>(null);
    const [pdfResult, setPdfResult] = useState<PdfResult | null>(null);
    const [orderConflict, setOrderConflict] = useState<OrderConflict | null>(null);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const buildPayload = useCallback(() => {
        const itemsPricing = items.map(({ product, quantity }) => ({
            product,
            quantity,
            pricing: getCartPricing(product, quantity),
        }));
        const shippingSummary = calculateCartShipping(items);
        const deliveryTotal = Number.isFinite(shippingSummary.total)
            ? Math.round(shippingSummary.total * 100) / 100
            : 0;

        return {
            payload: {
                items: itemsPricing.map(({ product, quantity, pricing }) => ({
                    id: product.id,
                    quantity,
                    unit_price: pricing.unitPrice,
                    line_total: pricing.lineTotal,
                })),
                shipping_total: deliveryTotal,
            },
            itemsTotal: itemsPricing.reduce((sum, { pricing }) => sum + pricing.lineTotal, 0),
            deliveryTotal,
        };
    }, [items]);

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
        clearCart();
        closePdfModal();
        setSaveMessage('Panier vide');
        setTimeout(() => setSaveMessage(null), 3000);
    }, [clearCart, closePdfModal]);

    const handleSaveCart = useCallback(async () => {
        if (items.length === 0) {
            setSaveMessage('Le panier est vide');
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        try {
            const { payload, itemsTotal, deliveryTotal } = buildPayload();
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

    const handleGenerateTcpdf = useCallback(async () => {
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
            const { payload, itemsTotal, deliveryTotal } = buildPayload();
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
