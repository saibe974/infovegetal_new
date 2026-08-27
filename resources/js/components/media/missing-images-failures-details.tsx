import { Button } from '@/components/ui/button';
import { ChevronDown, Loader2, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
    variant: 'compact' | 'full';
    title: string;
    failureCount: number;
    removeAllLabel: string;
    isBulkRemoving: boolean;
    onRemoveAll: () => void;
    previewText?: string;
    children?: ReactNode;
};

export function MissingImagesFailuresDetails({
    variant,
    title,
    failureCount,
    removeAllLabel,
    isBulkRemoving,
    onRemoveAll,
    previewText,
    children,
}: Props) {
    const compact = variant === 'compact';

    return (
        <details
            className={
                compact
                    ? 'group rounded border border-destructive/30 bg-destructive/5 px-2 py-1'
                    : 'group rounded-lg border border-destructive/30 bg-destructive/5'
            }
        >
            <summary
                className={
                    compact
                        ? 'list-none cursor-pointer text-xs font-medium text-destructive [&::-webkit-details-marker]:hidden'
                        : 'list-none cursor-pointer px-3 py-2 font-semibold text-destructive [&::-webkit-details-marker]:hidden'
                }
            >
                <span className="flex items-center justify-between gap-2">
                    <span className={compact ? '' : 'min-w-0 flex-1 truncate'}>
                        {title} ({failureCount})
                    </span>
                    <span className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onRemoveAll();
                            }}
                            disabled={isBulkRemoving}
                            className={
                                compact
                                    ? 'h-7 gap-1 px-2 text-[11px]'
                                    : 'h-8 shrink-0 gap-2 whitespace-nowrap'
                            }
                        >
                            {isBulkRemoving ? (
                                <Loader2 className={compact ? 'h-3.5 w-3.5 animate-spin' : 'h-4 w-4 animate-spin'} />
                            ) : (
                                <Trash2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                            )}
                            {removeAllLabel}
                        </Button>
                        <ChevronDown className={compact ? 'h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-180' : 'h-4 w-4 shrink-0 transition-transform group-open:rotate-180'} />
                    </span>
                </span>
            </summary>

            {compact ? (
                children ? (
                    <div className="mt-2 max-h-[35svh] space-y-3 overflow-y-auto overscroll-contain border-t border-destructive/20 pt-2">
                        {children}
                    </div>
                ) : (
                    <p className="mt-1 truncate text-xs text-destructive/90">
                        {previewText}
                    </p>
                )
            ) : (
                <div className="max-h-[35svh] space-y-3 overflow-y-auto overscroll-contain border-t border-destructive/20 p-3 sm:max-h-[45svh]">
                    {children}
                </div>
            )}
        </details>
    );
}
