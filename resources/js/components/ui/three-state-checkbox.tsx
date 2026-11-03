import { Check, Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ThreeStateChecked = boolean | 'indeterminate';

type ThreeStateCheckboxProps = {
    label: string;
    checked: ThreeStateChecked;
    onCheckedChange: (checked: ThreeStateChecked) => void;
    stateLabels: { checked: string; unchecked: string; indeterminate: string };
    disabled?: boolean;
    className?: string;
};

export function ThreeStateCheckbox({
    label,
    checked,
    onCheckedChange,
    stateLabels,
    disabled = false,
    className,
}: ThreeStateCheckboxProps) {
    const stateLabel = checked === 'indeterminate'
        ? stateLabels.indeterminate
        : checked ? stateLabels.checked : stateLabels.unchecked;
    const Icon = checked === 'indeterminate' ? Minus : checked ? Check : X;

    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked === 'indeterminate' ? 'mixed' : checked}
            aria-label={`${label} : ${stateLabel}`}
            title={`${label} : ${stateLabel}`}
            disabled={disabled}
            onClick={() => onCheckedChange(checked === 'indeterminate' ? true : checked ? false : 'indeterminate')}
            className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-sm text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
        >
            <span>{label}</span>
            <span aria-hidden="true" className="relative inline-flex h-6 w-14 shrink-0 items-center rounded-full border border-input bg-muted/60 p-0.5 shadow-inner">
                <span className={cn(
                    'absolute left-0.5 flex size-4.5 items-center justify-center rounded-full shadow-sm transition-transform duration-200 motion-reduce:transition-none',
                    checked === 'indeterminate'
                        ? 'translate-x-4 bg-background text-muted-foreground'
                        : checked
                            ? 'translate-x-0 bg-brand-main text-white'
                            : 'translate-x-8 bg-foreground/70 text-background',
                )}>
                    <Icon className="size-3" />
                </span>
            </span>
            <span aria-hidden="true" className="text-xs text-muted-foreground">{stateLabel}</span>
        </button>
    );
}
