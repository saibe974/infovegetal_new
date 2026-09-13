import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export function FileFormatField<T extends string>({
    value,
    formats,
    disabledFormats = [],
    disabled,
    hideLegend,
    onChange,
}: {
    value: T;
    formats: readonly T[];
    disabledFormats?: readonly T[];
    disabled?: boolean;
    hideLegend?: boolean;
    onChange: (value: T) => void;
}) {
    const { t } = useI18n();
    return (
        <fieldset disabled={disabled} className="space-y-2">
            {hideLegend ? null : (
                <legend className="mb-2 text-sm font-medium">
                    {t('Format du fichier')}
                </legend>
            )}
            <div className="flex flex-wrap gap-3">
                {formats.map((format) => (
                    <label
                        key={format}
                        className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-sm ${disabledFormats.includes(format) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${value === format ? 'border-primary bg-primary/5' : ''}`}
                    >
                        <Checkbox
                            checked={value === format}
                            disabled={
                                disabled || disabledFormats.includes(format)
                            }
                            onCheckedChange={() => onChange(format)}
                        />
                        <span>
                            {format === 'xlsx'
                                ? 'Excel (.xlsx)'
                                : format.toUpperCase()}
                            {format === 'pdf' && (
                                <span className="text-xs">
                                    {' '}
                                    — {t('À venir')}
                                </span>
                            )}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export function FileEditorSection({
    title,
    summary,
    open,
    onOpenChange,
    actions,
    children,
}: {
    title: string;
    summary?: ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Collapsible
            open={open}
            onOpenChange={onOpenChange}
            className={cn(
                'overflow-hidden rounded-lg border bg-background',
                open && 'bg-muted/40',
            )}
        >
            <div className="flex min-w-0 items-center gap-2 p-2">
                <CollapsibleTrigger asChild>
                    <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-2 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {open ? (
                            <ChevronDown className="size-4 shrink-0" />
                        ) : (
                            <ChevronRight className="size-4 shrink-0" />
                        )}
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold">
                                {title}
                            </span>
                            {summary && (
                                <span className="block truncate text-xs text-muted-foreground">
                                    {summary}
                                </span>
                            )}
                        </span>
                    </button>
                </CollapsibleTrigger>
                {actions}
            </div>
            <CollapsibleContent className="space-y-4 border-t p-4">
                {children}
            </CollapsibleContent>
        </Collapsible>
    );
}

export type FilePreviewRow = {
    heading: boolean;
    cells: { value: string; image: string | null }[];
};
export function FilePreview({
    rows,
    stale,
    loading,
    error,
    caption,
    filename,
}: {
    rows?: FilePreviewRow[];
    stale: boolean;
    loading?: boolean;
    error?: string | null;
    caption: string;
    filename?: string;
}) {
    const { t } = useI18n();
    return (
        <section
            aria-label={t('Aperçu du fichier')}
            className="space-y-3"
            aria-busy={loading}
        >
            {rows && stale && (
                <p
                    role="status"
                    className="text-sm text-amber-700 dark:text-amber-400"
                >
                    {t(
                        'Configuration modifiée depuis la dernière actualisation.',
                    )}
                </p>
            )}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {!rows && (
                <p className="text-sm text-muted-foreground">
                    {t(
                        loading
                            ? 'Actualisation…'
                            : 'Aucun aperçu disponible.',
                    )}
                </p>
            )}
            {filename && (
                <p className="font-mono text-xs break-all">{filename}</p>
            )}
            {rows && (
                <div className="max-h-96 overflow-auto rounded-lg border">
                    <table className="w-full text-sm">
                        <tbody>
                            {rows.map((row, index) => (
                                <tr
                                    key={index}
                                    className={
                                        row.heading
                                            ? 'bg-muted font-semibold'
                                            : 'border-t'
                                    }
                                >
                                    {row.cells.map((cell, cellIndex) => (
                                        <td
                                            key={cellIndex}
                                            className="max-w-80 min-w-32 border-r px-3 py-2 break-words whitespace-pre-wrap"
                                        >
                                            {cell.image ? (
                                                <img
                                                    src={cell.image}
                                                    alt={t(
                                                        'Miniature existante',
                                                    )}
                                                    className="size-16 object-contain"
                                                />
                                            ) : (
                                                cell.value
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <p className="text-xs text-muted-foreground">{caption}</p>
        </section>
    );
}
