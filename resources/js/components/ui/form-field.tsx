import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
    htmlFor?: string;
    label: React.ReactNode;
    error?: string;
    help?: string;
    className?: string;
}>;

export function FormField({
    children,
    htmlFor,
    label,
    error,
    help,
    className,
}: Props) {
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
            <fieldset className={cn('space-y-2', className)}>
                <Label asChild className={cn(error && 'text-destructive')}>
                    <legend>{label}</legend>
                </Label>
                {content}
            </fieldset>
        );
    }

    return (
        <div className={cn('space-y-2', className)}>
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
