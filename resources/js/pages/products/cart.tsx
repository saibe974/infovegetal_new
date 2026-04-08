import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Head, Link } from '@inertiajs/react';
import { ArrowLeftCircle, Loader2, Minus, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { CartContext } from '@/components/cart/cart.context';
import { useContext, useEffect, useMemo, useState } from 'react';
import { StickyBar } from '@/components/ui/sticky-bar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import BasicSticky from 'react-sticky-el';
import { ButtonsActions } from '@/components/buttons-actions';
import { ProductRoll } from '@/components/products/product-roll';
import { buildCartTransportContext, calculateCartShipping, getSupplierRollPrices } from '@/components/cart/cart-shipping';
import { getCartPricing } from '@/components/cart/cart-pricing';
import { getProductCartImage } from '@/components/products/product-cart-image';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type Props = Record<string, never>;

const pdfGenerationPhases = [
    'Verification des produits et des quantites',
    'Recherche des images locales disponibles',
    'Telechargement des images manquantes si necessaire',
    'Generation des vignettes et conversions',
    'Composition et export du PDF',
];

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

const formatCurrency = (value: number) =>
    value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

const toText = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

export default withAppLayout<Props>(breadcrumbs, false, () => {
    const { t } = useI18n();
    const { items, updateQuantity, removeFromCart, clearCart, refreshCart } = useContext(CartContext);

    // console.log(user)

    const [deliveryDate, setDeliveryDate] = useState('');

    const [isSaving, setIsSaving] = useState(false);
    const [isRefreshingCart, setIsRefreshingCart] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [isPdfGenerating, setIsPdfGenerating] = useState(false);
    const [pdfPhaseIndex, setPdfPhaseIndex] = useState(0);
    const [pdfCurrentGroup, setPdfCurrentGroup] = useState<{ index: number; total: number; label: string } | null>(null);
    const [pdfResult, setPdfResult] = useState<{ url: string; filename: string; orderNumber: string | null } | null>(null);
    const [orderConflict, setOrderConflict] = useState<{ orderNumber: string | null; resolve: (choice: 'append' | 'new') => void } | null>(null);


    const itemsPricing = useMemo(
        () => items.map(({ product, quantity }) => ({ product, quantity, pricing: getCartPricing(product, quantity) })),
        [items],
    );

    const getGroupKey = (product: { db_products_id?: number | null; dbProduct?: { id?: number | null } | null }) =>
        Number(product.db_products_id ?? product.dbProduct?.id ?? 0);

    const getGroupLabel = (product: { dbProduct?: { name?: string | null } | null; db_products_id?: number | null }) => {
        if (product.dbProduct?.name) return String(product.dbProduct.name);
        if (product.db_products_id) return `DB #${product.db_products_id}`;
        return t('Sans DB');
    };

    const toFileSlug = (value: string) =>
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || 'panier';

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

            return {
                ...group,
                cartItems,
                itemsTotal,
                shipping: shippingSummary,
                transportContext: transport,
                deliveryTotal,
                orderTotal,
            };
        });
    }, [itemsPricing]);

    const itemsTotal = groupedItems.reduce((sum, group) => sum + group.itemsTotal, 0);
    const deliveryTotal = groupedItems.reduce((sum, group) => sum + group.deliveryTotal, 0);
    const orderTotal = itemsTotal + deliveryTotal;

    const handleQuantityChange = (productId: number, next: number) => {
        updateQuantity(productId, Math.max(1, next || 1));
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

    const handleRefreshCart = async () => {
        if (items.length === 0 || isRefreshingCart) {
            return;
        }

        setIsRefreshingCart(true);
        setSaveMessage(null);

        try {
            await refreshCart();
            setSaveMessage('Panier mis a jour selon les acces DB utilisateur');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error('Error refreshing cart:', error);
            setSaveMessage('Erreur lors de la mise a jour du panier');
        } finally {
            setIsRefreshingCart(false);
        }
    };

    const handleGeneratePdf = async () => {
        if (items.length === 0) {
            setSaveMessage("Le panier est vide");
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setIsPdfGenerating(true);
        setPdfPhaseIndex(0);
        setPdfCurrentGroup(null);
        setSaveMessage(null);

        try {
            const csrfToken = (
                document.querySelector(
                    'meta[name="csrf-token"]'
                ) as HTMLMetaElement
            )?.content;

            const basePayload = {
                items: items.map((item) => ({
                    id: item.product.id,
                    quantity: item.quantity,
                })),
                shipping_total: deliveryTotal,
            };

            const placeOrder = async (choice?: 'append' | 'new') => {
                return fetch('/cart/order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken || '',
                    },
                    body: JSON.stringify({
                        ...basePayload,
                        ...(choice ? { choice } : {}),
                    }),
                });
            };

            let response = await placeOrder();

            if (response.status === 409) {
                const data = await response.json();
                if (data?.requires_choice) {
                    const orderNumber = data?.existing_order?.number ?? null;
                    const choice = await new Promise<'append' | 'new'>((resolve) => {
                        setOrderConflict({ orderNumber, resolve });
                    });
                    setOrderConflict(null);
                    response = await placeOrder(choice);
                }
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                setSaveMessage(data?.message || 'Erreur lors de la commande');
                return;
            }

            const data = await response.json();
            const pdfUrl = data?.pdf_download_url;
            const orderNumber = data?.order_number;
            if (pdfUrl) {
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = orderNumber ? `commande-${orderNumber}.pdf` : 'commande.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            setSaveMessage(orderNumber
                ? `Commande #${orderNumber} enregistree, PDF genere et emails envoyes`
                : 'Commande enregistree, PDF genere et emails envoyes');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error('Error placing order:', error);
            setSaveMessage('Erreur lors de la commande');
        } finally {
            setIsSaving(false);
            setIsPdfGenerating(false);
            setPdfCurrentGroup(null);
            setPdfPhaseIndex(0);
        }
    };

    const handleGenerateTcpdf = async () => {
        if (items.length === 0) {
            setSaveMessage('Le panier est vide');
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        setIsPdfGenerating(true);
        setPdfPhaseIndex(0);
        setPdfCurrentGroup(null);
        if (pdfResult?.url) {
            window.URL.revokeObjectURL(pdfResult.url);
        }
        setPdfResult(null);
        setSaveMessage(null);

        try {
            const csrfToken = (
                document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
            )?.content;

            const response = await fetch('/cart/generate-pdf-tcpdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': csrfToken || '',
                },
                body: JSON.stringify({
                    items: itemsPricing.map((item) => ({
                        id: item.product.id,
                        quantity: item.quantity,
                        unit_price: item.pricing.unitPrice,
                        line_total: item.pricing.lineTotal,
                    })),
                    shipping_total: deliveryTotal,
                }),
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                setSaveMessage(data?.message || 'Erreur lors de la generation TCPDF');
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const contentDisposition = response.headers.get('content-disposition') || '';
            const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
            const extractedFilename = filenameMatch
                ? decodeURIComponent(filenameMatch[1] || filenameMatch[2] || '')
                : `panier-${new Date().toISOString().split('T')[0]}.pdf`;
            const orderMatch = extractedFilename.match(/^(\d{5})-/);

            setPdfResult({
                url,
                filename: extractedFilename,
                orderNumber: orderMatch ? orderMatch[1] : null,
            });

            setSaveMessage('Commande enregistree et PDF genere avec succes');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error('Error generating TCPDF:', error);
            setSaveMessage('Erreur lors de la generation TCPDF');
        } finally {
            setIsSaving(false);
            setIsPdfGenerating(false);
        }
    };

    const closePdfModal = () => {
        if (isPdfGenerating) {
            return;
        }

        if (pdfResult?.url) {
            window.URL.revokeObjectURL(pdfResult.url);
        }

        setPdfResult(null);
        setPdfCurrentGroup(null);
        setPdfPhaseIndex(0);
    };

    const handleDownloadGeneratedPdf = () => {
        if (!pdfResult) {
            return;
        }

        const link = document.createElement('a');
        link.href = pdfResult.url;
        link.download = pdfResult.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleClearCartFromModal = () => {
        clearCart();
        closePdfModal();
        setSaveMessage('Panier vide');
        setTimeout(() => setSaveMessage(null), 3000);
    };

    const [topOffset, setTopOffset] = useState<number>(0);

    useEffect(() => {
        if (!isPdfGenerating) {
            return;
        }

        const timer = window.setInterval(() => {
            setPdfPhaseIndex((current) => (current + 1) % pdfGenerationPhases.length);
        }, 1600);

        return () => {
            window.clearInterval(timer);
        };
    }, [isPdfGenerating]);

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
            <Dialog open={orderConflict !== null} onOpenChange={() => undefined}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Commande en cours</DialogTitle>
                        <DialogDescription>
                            {orderConflict?.orderNumber
                                ? `La commande #${orderConflict.orderNumber} est deja en cours de traitement.`
                                : 'Une commande est deja en cours de traitement.'}
                            {' '}Souhaitez-vous y ajouter les articles du panier, ou creer une nouvelle commande ?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex-col gap-2 sm:flex-row">
                        <Button variant="outline" onClick={() => orderConflict?.resolve('new')}>
                            Nouvelle commande
                        </Button>
                        <Button onClick={() => orderConflict?.resolve('append')}>
                            Ajouter a la commande en cours
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isPdfGenerating || pdfResult !== null} onOpenChange={(open) => !open && closePdfModal()}>
                <DialogContent className="sm:max-w-lg" showCloseButton={false}>
                    <DialogHeader>
                        {isPdfGenerating ? (
                            <>
                                <DialogTitle className="flex items-center gap-3 text-xl">
                                    <Loader2 className="h-5 w-5 animate-spin text-brand-main" />
                                    Generation du PDF en cours
                                </DialogTitle>
                                <DialogDescription className="text-sm leading-6">
                                    Le document peut prendre un peu de temps. Le serveur verifie les produits, telecharge les images manquantes, prepare les conversions, puis genere le PDF final.
                                </DialogDescription>
                            </>
                        ) : (
                            <>
                                <DialogTitle className="text-xl">Commande terminee</DialogTitle>
                                <DialogDescription className="text-sm leading-6">
                                    {pdfResult?.orderNumber
                                        ? `La commande #${pdfResult.orderNumber} est prete. Choisissez l'action a effectuer.`
                                        : 'Le PDF est pret. Choisissez l\'action a effectuer.'}
                                </DialogDescription>
                            </>
                        )}
                    </DialogHeader>

                    {isPdfGenerating ? (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-brand-main/20 bg-brand-main/5 p-4">
                                <div className="text-sm font-medium text-foreground">
                                    {pdfCurrentGroup
                                        ? `Fournisseur ${pdfCurrentGroup.index}/${pdfCurrentGroup.total} : ${pdfCurrentGroup.label}`
                                        : 'Preparation de la generation'}
                                </div>
                                <div className="mt-1 text-sm text-muted-foreground">
                                    Etape en cours : {pdfGenerationPhases[pdfPhaseIndex]}
                                </div>
                            </div>

                            <div className="space-y-2 rounded-xl border p-4">
                                {pdfGenerationPhases.map((phase, index) => {
                                    const isActive = index === pdfPhaseIndex;
                                    const isPassed = index < pdfPhaseIndex;

                                    return (
                                        <div
                                            key={phase}
                                            className={cn(
                                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                                                isActive && 'bg-brand-main/10 text-foreground',
                                                isPassed && 'text-muted-foreground',
                                                !isActive && !isPassed && 'text-muted-foreground/80',
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold',
                                                    isActive && 'border-brand-main text-brand-main',
                                                    isPassed && 'border-green-600 text-green-600',
                                                    !isActive && !isPassed && 'border-muted-foreground/30 text-muted-foreground',
                                                )}
                                            >
                                                {isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index + 1}
                                            </span>
                                            <span>{phase}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Veuillez patienter jusqu'a la fin de la generation.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-xl border border-green-300/60 bg-green-50 p-4 text-sm text-green-800">
                                PDF genere avec succes.
                                {pdfResult ? (
                                    <span className="mt-1 block text-xs text-green-700">Fichier: {pdfResult.filename}</span>
                                ) : null}
                            </div>
                            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button variant="outline" onClick={closePdfModal}>
                                    Fermer
                                </Button>
                                <Button variant="destructive" onClick={handleClearCartFromModal}>
                                    Vider le panier
                                </Button>
                                <Button onClick={handleDownloadGeneratedPdf}>
                                    Telecharger le PDF
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
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
                        <h1 className="text-3xl font-bold">{t('Panier')}</h1>
                    </div>

                    {items.length > 0 && (
                        // <div className='space-x-2'>

                        //     <Button variant="default" onClick={handleSaveCart} className="" size="sm" disabled={isSaving}>
                        //         {t('Save')} <SaveIcon className="h-4 w-4" />
                        //     </Button>
                        //     <Button variant="ghost" onClick={clearCart} className="text-destructive" size="sm" disabled={isSaving}>
                        //         {t('Clear')}<Trash2 className="h-4 w-4" />
                        //     </Button>
                        // </div>
                        <ButtonsActions
                            refresh={handleRefreshCart}
                            save={handleSaveCart}
                            delete={clearCart}
                            refreshing={isRefreshingCart}
                            saving={isSaving}
                        />
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
                        <div key={group.id} className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {t('Produits')} - {group.label} ({group.items.length})
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {group.items.map(({ product, quantity, pricing }) => {
                                        const unitPrice = pricing.unitPrice;
                                        const lineTotal = pricing.lineTotal;

                                        return (
                                            <div
                                                key={product.id}
                                                className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center"
                                            >
                                                <div className="flex items-center gap-4 md:w-1/2">
                                                    <div className="h-20 w-20 rounded relative shrink-0">
                                                        <img
                                                            src={getProductCartImage(product)}
                                                            alt={product.name}
                                                            className="h-full w-full object-cover"
                                                        />
                                                        <Badge
                                                            className={cn(
                                                                "absolute -top-1 -right-1 text-xs rounded-full",
                                                                quantity > 9 ? "size-6 px-1.5" : "size-5 px-2"
                                                            )}
                                                        >
                                                            {quantity}
                                                        </Badge>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-semibold leading-tight line-clamp-2 capitalize">{product.name}</p>
                                                        {toText((product as any).ref) ? (
                                                            <p className="text-xs text-muted-foreground">Ref: {toText((product as any).ref)}</p>
                                                        ) : null}
                                                        <p className="text-xs text-muted-foreground">{t('Prix unitaire')}</p>
                                                        <p className="text-base font-semibold">{formatCurrency(unitPrice)}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-1 flex-wrap items-center justify-between gap-4 md:justify-end">
                                                    <div className="flex items-center gap-3 bg-muted rounded-lg p-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            aria-label={t('Diminuer la quantité')}
                                                            onClick={() => handleQuantityChange(product.id, quantity - 1)}
                                                            disabled={quantity <= 1}
                                                        >
                                                            <Minus className="h-4 w-4" />
                                                        </Button>
                                                        <Input
                                                            type="text"
                                                            min={1}
                                                            value={quantity}
                                                            onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value, 10))}
                                                            className="w-16 h-8 text-center border-0"
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            aria-label={t('Augmenter la quantité')}
                                                            onClick={() => handleQuantityChange(product.id, quantity + 1)}
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className="text-xs text-muted-foreground">{t('Total ligne')}</p>
                                                        <p className="text-lg font-semibold">{formatCurrency(lineTotal)}</p>
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
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>{t('Rolls')}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ProductRoll
                                        items={group.cartItems}
                                        getSupplierPrice={(supplier) => group.shipping.bySupplier[supplier.supplierId] ?? 0}
                                        getRollPrice={(supplier, roll, rollIndex) => {
                                            const prices = getSupplierRollPrices(
                                                supplier,
                                                group.transportContext.attrsBySupplier[supplier.supplierId],
                                                group.transportContext.transportBySupplier[supplier.supplierId],
                                            );

                                            return prices ? prices[rollIndex] ?? null : null;
                                        }}
                                    />
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
                                        : " text-green-600 border border-green-600"
                                        }`}
                                >
                                    {saveMessage}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                {groupedItems.map((group) => (
                                    <div key={group.id} className="rounded-md border px-3 py-2">
                                        <div className="text-xs text-muted-foreground">{group.label}</div>
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
});
