import { useEffect, useMemo, useState } from 'react';
import { router } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';

type ImportStatus = 'idle' | 'processing' | 'cancelling' | 'finished' | 'cancelled' | 'error';

type AnalysisColumnCandidate = {
    field: string;
    score: number;
    label: string;
};

type AnalysisColumn = {
    index: number;
    source_label: string;
    normalized_key: string;
    samples: string[];
    suggested_target: string | null;
    candidates: AnalysisColumnCandidate[];
};

type AnalysisRow = {
    index: number;
    cells: string[];
};

type AnalysisPayload = {
    format: string;
    source_delimiter: string | null;
    rows: AnalysisRow[];
    detected_header_row_index: number;
    header_candidates: { index: number; score: number }[];
    columns: AnalysisColumn[];
};

type Props = {
    dbProductId: number;
    uploadId: string | null;
    importStatus: ImportStatus;
    importError: string | null;
};

const TARGET_FIELDS = [
    { value: 'ref', label: 'ref' },
    { value: 'ean13', label: 'ean13' },
    { value: 'name', label: 'name' },
    { value: 'price', label: 'price' },
    { value: 'price_floor', label: 'price_floor' },
    { value: 'price_roll', label: 'price_roll' },
    { value: 'stock', label: 'stock' },
    { value: 'category_products_id', label: 'category' },
    { value: 'description', label: 'description' },
    { value: 'img_link', label: 'img_link' },
    { value: 'cond', label: 'cond' },
    { value: 'floor', label: 'floor' },
    { value: 'roll', label: 'roll' },
    { value: 'tva_id', label: 'tva_id' },
    { value: 'height', label: 'height' },
    { value: 'pot', label: 'pot' },
    { value: 'active', label: 'active' },
    { value: 'producer_id', label: 'producer_id' },
    { value: 'db_products_id', label: 'db_products_id' },
];

const REQUIRED_FIELDS = ['ref', 'ean13', 'name', 'price'];

export function ProductImportConfigurator({ dbProductId, uploadId, importError }: Props) {
    const { t } = useI18n();
    const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [selectedHeaderRowIndex, setSelectedHeaderRowIndex] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
        if (meta?.content) return meta.content;

        const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
        return match ? decodeURIComponent(match[1]) : null;
    };

    const csrfToken = getCsrfToken() || '';

    const applyAnalysis = (payload: AnalysisPayload) => {
        setAnalysis(payload);
        setSelectedHeaderRowIndex(payload.detected_header_row_index);
        setMapping(
            payload.columns.reduce<Record<string, string>>((carry, column) => {
                if (column.suggested_target) {
                    carry[column.normalized_key] = column.suggested_target;
                }

                return carry;
            }, {}),
        );
    };

    const analyze = async (headerRowIndex?: number) => {
        if (!uploadId) {
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/db-products/analyze-sample', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    id: uploadId,
                    ...(typeof headerRowIndex === 'number' ? { header_row_index: headerRowIndex } : {}),
                }),
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok || !payload) {
                throw new Error(typeof payload?.message === 'string' ? payload.message : t('Unable to analyze the sample file.'));
            }

            applyAnalysis(payload as AnalysisPayload);
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : t('Unable to analyze the sample file.'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (uploadId) {
            void analyze();
        }
    }, [uploadId]);

    const missingRequiredFields = useMemo(() => {
        const mappedTargets = Object.values(mapping);

        return REQUIRED_FIELDS.filter((field) => !mappedTargets.includes(field));
    }, [mapping]);

    const saveConfiguration = async () => {
        if (!analysis || selectedHeaderRowIndex === null) {
            return;
        }

        setSaving(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch(`/db-products/${dbProductId}/import-config`, {
                method: 'PUT',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    champs: Object.fromEntries(Object.entries(mapping).filter(([, value]) => value !== '')),
                    header_row_index: selectedHeaderRowIndex,
                    source_delimiter: analysis.source_delimiter,
                }),
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(typeof payload?.message === 'string' ? payload.message : t('Unable to save the import configuration.'));
            }

            setSuccess(t('Import configuration saved.'));
            router.reload({ only: ['dbProduct'] });
        } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : t('Unable to save the import configuration.'));
        } finally {
            setSaving(false);
        }
    };

    if (!uploadId) {
        return <p className="text-sm text-muted-foreground">{t('Upload a sample file to start the analysis.')}</p>;
    }

    return (
        <div className="w-full space-y-4 text-left">
            <div className="space-y-1">
                <h3 className="text-sm font-semibold">{t('Supplier format analysis')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('Review the detected header row and map each source column to the matching product field.')}
                </p>
            </div>

            {(loading || !analysis) && (
                <div className="flex items-center gap-2 rounded border p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('Analyzing sample file...')}
                </div>
            )}

            {(error || importError) && (
                <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    {error ?? importError}
                </div>
            )}

            {success && (
                <div className="rounded border border-green-700/30 bg-green-700/5 p-3 text-sm text-green-800">
                    {success}
                </div>
            )}

            {analysis && (
                <>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{t('Format')}: {analysis.format.toUpperCase()}</span>
                        <span>{t('Delimiter')}: {analysis.source_delimiter === '\t' ? 'TAB' : analysis.source_delimiter ?? '-'}</span>
                        <span>{t('Detected header row')}: {selectedHeaderRowIndex !== null ? selectedHeaderRowIndex + 1 : '-'}</span>
                    </div>

                    <div className="max-h-80 overflow-auto rounded border">
                        <table className="min-w-max w-full text-sm">
                            <tbody>
                                {analysis.rows.map((row) => {
                                    const isHeader = row.index === selectedHeaderRowIndex;

                                    return (
                                        <tr
                                            key={row.index}
                                            className={isHeader ? 'bg-primary/10' : 'hover:bg-muted/50'}
                                        >
                                            <td className="w-24 border-b px-2 py-2 align-top text-xs text-muted-foreground">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={isHeader ? 'default' : 'outline'}
                                                    onClick={() => {
                                                        setSelectedHeaderRowIndex(row.index);
                                                        void analyze(row.index);
                                                    }}
                                                    disabled={loading}
                                                >
                                                    {isHeader ? t('Header') : t('Use row')}
                                                </Button>
                                                <div className="mt-1">#{row.index + 1}</div>
                                            </td>
                                            {row.cells.map((cell, index) => (
                                                <td key={`${row.index}-${index}`} className="max-w-48 border-b px-2 py-2 align-top text-xs">
                                                    <div className="truncate" title={cell}>
                                                        {cell || '-'}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-1">
                            <h4 className="text-sm font-semibold">{t('Column mapping')}</h4>
                            <p className="text-xs text-muted-foreground">
                                {t('Map each detected source column to a product field. Required fields: ref, ean13, name, price.')}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {analysis.columns.map((column) => (
                                <div key={column.normalized_key} className="grid gap-2 rounded border p-3 md:grid-cols-[minmax(0,1fr)_260px]">
                                    <div className="space-y-1">
                                        <div className="font-medium">{column.source_label}</div>
                                        <div className="font-mono text-xs text-muted-foreground">{column.normalized_key}</div>
                                        {column.samples.length > 0 && (
                                            <div className="text-xs text-muted-foreground">
                                                {t('Samples')}: {column.samples.join(' | ')}
                                            </div>
                                        )}
                                    </div>
                                    <Select
                                        value={mapping[column.normalized_key] ?? '__none__'}
                                        onValueChange={(value) => {
                                            setMapping((current) => ({
                                                ...current,
                                                [column.normalized_key]: value === '__none__' ? '' : value,
                                            }));
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('Ignore this column')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__none__">{t('Ignore this column')}</SelectItem>
                                            {TARGET_FIELDS.map((field) => (
                                                <SelectItem key={field.value} value={field.value}>
                                                    {field.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>
                    </div>

                    {missingRequiredFields.length > 0 && (
                        <div className="rounded border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700">
                            {t('Missing required mappings')}: {missingRequiredFields.join(', ')}
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => void analyze(selectedHeaderRowIndex ?? undefined)} disabled={loading || saving}>
                            {t('Reanalyze')}
                        </Button>
                        <Button type="button" onClick={saveConfiguration} disabled={saving || loading || missingRequiredFields.length > 0}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('Save mapping')}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}

export default ProductImportConfigurator;