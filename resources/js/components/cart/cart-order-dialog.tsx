import { Loader2 } from 'lucide-react';
import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { useCartOrder } from './cart-order.context';

const pdfGenerationPhases = [
    'Verification des produits et des quantites',
    'Recherche des images locales disponibles',
    'Telechargement des images manquantes si necessaire',
    'Generation des vignettes et conversions',
    'Composition et export du PDF',
];

export function CartOrderDialog() {
    const page = usePage();
    const isCartPage = page.component === 'products/cart' || page.url.startsWith('/cart/checkout');

    const {
        isPdfGenerating,
        pdfPhaseIndex,
        pdfCurrentGroup,
        pdfResult,
        orderConflict,
        closePdfModal,
        handleDownloadGeneratedPdf,
        handleClearCartFromModal,
    } = useCartOrder();

    return (
        <>
            {/* Dialog : conflit de commande existante */}
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

            {/* Dialog : génération / résultat PDF */}
            <Dialog
                open={isPdfGenerating || pdfResult !== null}
                onOpenChange={(open) => !open && closePdfModal()}
            >
                <DialogContent className="sm:max-w-lg" showCloseButton={false}>
                    <DialogHeader>
                        {isPdfGenerating ? (
                            <>
                                <DialogTitle className="flex items-center gap-3 text-xl">
                                    <Loader2 className="h-5 w-5 animate-spin text-brand-main" />
                                    Generation du PDF en cours
                                </DialogTitle>
                                <DialogDescription className="text-sm leading-6">
                                    Le document peut prendre un peu de temps. Le serveur verifie les produits,
                                    telecharge les images manquantes, prepare les conversions, puis genere le PDF final.
                                </DialogDescription>
                            </>
                        ) : (
                            <>
                                <DialogTitle className="text-xl">
                                    {pdfResult?.orderNumber
                                        ? `Commande #${pdfResult.orderNumber} terminee`
                                        : 'PDF pret'}
                                </DialogTitle>
                                <DialogDescription className="text-sm leading-6">
                                    {pdfResult?.orderNumber
                                        ? `La commande #${pdfResult.orderNumber} est prete. Choisissez l'action a effectuer.`
                                        : "Le PDF est pret. Choisissez l'action a effectuer."}
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
                                            <span className={cn(
                                                'inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold',
                                                isActive && 'border-brand-main text-brand-main',
                                                isPassed && 'border-green-600 text-green-600',
                                                !isActive && !isPassed && 'border-muted-foreground/30 text-muted-foreground',
                                            )}>
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
                                {pdfResult && (
                                    <span className="mt-1 block text-xs text-green-700">
                                        Fichier : {pdfResult.filename}
                                    </span>
                                )}
                                {(pdfResult?.itemsTotal !== undefined || pdfResult?.shippingTotal !== undefined) && (
                                    <div className="mt-2 space-y-1 border-t border-green-200 pt-2 text-xs text-green-700">
                                        {pdfResult?.itemsTotal !== undefined && (
                                            <div className="flex justify-between">
                                                <span>Total produits</span>
                                                <span className="font-semibold">{formatCurrency(pdfResult.itemsTotal)}</span>
                                            </div>
                                        )}
                                        {pdfResult?.shippingTotal !== undefined && (
                                            <div className="flex justify-between">
                                                <span>Frais de transport</span>
                                                <span className="font-semibold">{formatCurrency(pdfResult.shippingTotal)}</span>
                                            </div>
                                        )}
                                        {pdfResult?.itemsTotal !== undefined && pdfResult?.shippingTotal !== undefined && (
                                            <div className="flex justify-between font-semibold border-t border-green-200 pt-1">
                                                <span>Total</span>
                                                <span>{formatCurrency(pdfResult.itemsTotal + pdfResult.shippingTotal)}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                {pdfResult?.origin === 'save' && (
                                    <Button onClick={() => router.visit('/cart/checkout')}>
                                        Commander
                                    </Button>
                                )}
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
