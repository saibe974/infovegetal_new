import { useMemo, useRef, useState } from 'react';
import { FilePond } from 'react-filepond';
import 'filepond/dist/filepond.min.css';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import ProductImportConfigurator from '@/components/products/import-configurator';

type Props = {
    dbProductId: number;
    headerRowIndex?: number | null;
    sourceDelimiter?: string | null;
};

export function ProductImportConfigPanel({ dbProductId, headerRowIndex, sourceDelimiter }: Props) {
    const { t } = useI18n();
    const pondRef = useRef<any>(null);
    const [files, setFiles] = useState<any[]>([]);
    const [uploadId, setUploadId] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
        if (meta?.content) return meta.content;

        const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
        return match ? decodeURIComponent(match[1]) : null;
    };

    const csrfToken = getCsrfToken() || '';

    const computeChunkSize = (size: number) => {
        const kb = 1024;
        const mb = 1024 * kb;

        if (size <= 5 * mb) return 512 * kb;
        if (size <= 20 * mb) return 1 * mb;
        if (size <= 100 * mb) return 2 * mb;
        return 4 * mb;
    };

    const handleServerResponse = (response: string) => {
        try {
            const json = JSON.parse(response);
            const nextId = json.uploadId ?? json.id ?? null;
            setUploadId(nextId ? String(nextId) : null);
            setUploadError(null);
            return nextId ? String(nextId) : response;
        } catch {
            return response;
        }
    };

    const handleServerError = (response: string) => {
        try {
            const json = JSON.parse(response);
            return json.error ?? json.message ?? response;
        } catch {
            return response;
        }
    };

    const configSummary = useMemo(() => [
        `${t('Header row')}: ${headerRowIndex !== null && headerRowIndex !== undefined ? headerRowIndex + 1 : '-'}`,
        `${t('Delimiter')}: ${sourceDelimiter || '-'}`,
    ], [headerRowIndex, sourceDelimiter, t]);

    return (
        <div className="space-y-4 rounded border p-4">
            <div>
                <h3 className="text-sm font-semibold">{t('Supplier import format')}</h3>
                <p className="text-sm text-muted-foreground">
                    {t('Upload a sample CSV, XLS or XLSX file to detect the header row and configure the column mapping.')}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {configSummary.map((item) => (
                    <span key={item}>{item}</span>
                ))}
            </div>

            <div className="space-y-3">
                <FilePond
                    ref={pondRef}
                    files={files}
                    onupdatefiles={(nextFiles) => {
                        setFiles(nextFiles);
                        const fileSize = nextFiles?.[0]?.file?.size;
                        if (typeof fileSize === 'number' && fileSize > 0) {
                            const chunkSize = computeChunkSize(fileSize);
                            const pond = pondRef.current?.pond ?? pondRef.current?.getFilePond?.();
                            pond?.setOptions?.({ chunkSize });
                        }

                        if (nextFiles.length === 0) {
                            setUploadId(null);
                            setUploadError(null);
                        }
                    }}
                    allowMultiple={false}
                    maxFiles={1}
                    chunkUploads={true}
                    chunkSize={1000000}
                    chunkRetryDelays={[500, 1000, 3000]}
                    server={{
                        url: '/upload',
                        process: {
                            url: '',
                            method: 'POST',
                            headers: {
                                'X-CSRF-TOKEN': csrfToken,
                            },
                            onload: handleServerResponse,
                            onerror: handleServerError,
                        },
                        patch: {
                            url: '?patch=',
                            headers: {
                                'X-CSRF-TOKEN': csrfToken,
                            },
                            onload: handleServerResponse,
                            onerror: handleServerError,
                        },
                        revert: null,
                    }}
                    name="file"
                    labelIdle='Glissez-déposez votre fichier ou <span class="filepond--label-action">Parcourir</span>'
                    acceptedFileTypes={[
                        'text/csv',
                        'application/csv',
                        'application/vnd.ms-excel',
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        '.csv',
                        '.xls',
                        '.xlsx',
                    ]}
                    credits={false}
                />

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => pondRef.current?.browse?.() ?? pondRef.current?.pond?.browse?.()}
                    >
                        {t('Upload sample file')}
                    </Button>
                    {uploadId && <span className="text-xs text-muted-foreground">{t('Sample uploaded. Analysis ready below.')}</span>}
                </div>
            </div>

            {uploadError && (
                <div className="rounded border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    {uploadError}
                </div>
            )}

            <ProductImportConfigurator
                dbProductId={dbProductId}
                uploadId={uploadId}
                importStatus="idle"
                importError={uploadError}
            />
        </div>
    );
}

export default ProductImportConfigPanel;