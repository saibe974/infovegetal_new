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

type Props = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    confirmationEnabled: boolean;
    confirmationLabel?: string;
    onConfirmationEnabledChange: (enabled: boolean) => void;
    onCancel: () => void;
    onConfirm: () => void;
};

export function ConfirmationDialog({
    open,
    title,
    description,
    confirmLabel,
    confirmationEnabled,
    confirmationLabel = 'Toujours demander une confirmation',
    onConfirmationEnabledChange,
    onCancel,
    onConfirm,
}: Props) {
    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => !nextOpen && onCancel()}
        >
            <DialogContent className="sm:max-w-md" showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <Checkbox
                        checked={confirmationEnabled}
                        onCheckedChange={(checked) =>
                            onConfirmationEnabledChange(checked === true)
                        }
                    />
                    {confirmationLabel}
                </label>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        Annuler
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
