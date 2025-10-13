import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
    htmlFor?: string;
    label: string;
    error?: string;
    help?: string;
}>;

export function FormField({ children, htmlFor, label, error, help }: Props) {
    const content = (
        <>
            {children}
            {help && (
                <p className="-mt-1 text-sm text-muted-foreground">{help}</p>
            )}
            {error && <p className="-mt-1 text-sm text-destructive">{error}</p>}
        </>
    );
    if (!htmlFor) {
        return (
            <fieldset className="space-y-2">
                <Label asChild className={cn(error && 'text-destructive')}>
                    <legend>{label}</legend>
                </Label>
                {content}
            </fieldset>
        );
    }

    return (
        <div className="space-y-2">
            <Label
                htmlFor={htmlFor}
                className={cn('block', error && 'text-destructive')}
            >
                {label}
            </Label>
            {content}
        </div>
    );
}
