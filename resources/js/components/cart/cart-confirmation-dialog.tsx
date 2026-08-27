import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';

export type CartConfirmationKind = 'removeItem' | 'clearCart';

type Props = {
    kind: CartConfirmationKind | null;
    productName?: string;
    confirmationEnabled: boolean;
    onConfirmationEnabledChange: (enabled: boolean) => void;
    onCancel: () => void;
    onConfirm: () => void;
};

export function CartConfirmationDialog({
    kind,
    productName,
    confirmationEnabled,
    onConfirmationEnabledChange,
    onCancel,
    onConfirm,
}: Props) {
    const { t } = useI18n();
    const isRemoval = kind === 'removeItem';

    return (
        <Dialog
            open={kind !== null}
            onOpenChange={(open) => !open && onCancel()}
        >
            <DialogContent className="sm:max-w-md" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>
                        {t(
                            isRemoval
                                ? 'Retirer ce produit ?'
                                : 'Vider le panier ?',
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {isRemoval
                            ? productName
                                ? t(
                                      'Le produit « :product » sera retiré du panier.',
                                  ).replace(':product', productName)
                                : t('Ce produit sera retiré du panier.')
                            : t(
                                  'Tous les produits et le commentaire du panier seront supprimés.',
                              )}
                    </DialogDescription>
                </DialogHeader>

                <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <Checkbox
                        checked={confirmationEnabled}
                        onCheckedChange={(checked) =>
                            onConfirmationEnabledChange(checked === true)
                        }
                    />
                    {t('Toujours demander une confirmation')}
                </label>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        {t('Annuler')}
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        {t(isRemoval ? 'Retirer' : 'Vider le panier')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
