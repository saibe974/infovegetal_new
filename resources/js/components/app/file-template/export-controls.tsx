import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useI18n } from '@/lib/i18n';
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function FileFormatField<T extends string>({
    value,
    formats,
    disabled,
    onChange,
}: {
    value: T;
    formats: readonly T[];
    disabled?: boolean;
    onChange: (value: T) => void;
}) {
    const { t } = useI18n();
    return (
        <fieldset disabled={disabled} className="space-y-2">
            <legend className="mb-2 text-sm font-medium">
                {t('Format du fichier')}
            </legend>
            <div className="flex flex-wrap gap-3">
                {formats.map((format) => (
                    <label
                        key={format}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${value === format ? 'border-primary bg-primary/5' : ''}`}
                    >
                        <Checkbox
                            checked={value === format}
                            disabled={disabled}
                            onCheckedChange={() => onChange(format)}
                        />
                        {format === 'xlsx'
                            ? 'Excel (.xlsx)'
                            : format.toUpperCase()}
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
            className="overflow-hidden rounded-lg border bg-background"
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
    disabled,
    onRefresh,
}: {
    rows?: FilePreviewRow[];
    stale: boolean;
    loading?: boolean;
    error?: string | null;
    caption: string;
    filename?: string;
    disabled?: boolean;
    onRefresh: () => void;
}) {
    const { t } = useI18n();
    return (
        <section
            aria-label={t('Aperçu du fichier')}
            className="space-y-3 border-t pt-4"
            aria-busy={loading}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{t('Aperçu du fichier')}</h2>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || loading}
                    onClick={onRefresh}
                >
                    {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <RefreshCw className="size-4" />
                    )}
                    {t(loading ? 'Actualisation…' : 'Actualiser l’aperçu')}
                </Button>
            </div>
            {rows && stale && (
                <p
                    role="status"
                    className="text-sm text-amber-700 dark:text-amber-400"
                >
                    {t('Configuration modifiée — aperçu à actualiser')}
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
                        'Cliquez sur Actualiser l’aperçu pour afficher le fichier.',
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
