import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { DownloadIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// FilePond imports
import { FilePond } from 'react-filepond';
import 'filepond/dist/filepond.min.css';

type CsvUploadConfig = {
    /** Titre de la boîte de dialogue */
    title: string;
    /** Description affichée dans la boîte de dialogue */
    description: string;
    /** URL pour uploader le fichier */
    uploadUrl: string;
    /** URL de redirection après succès */
    successRedirectUrl?: string;
    /** URL à appeler pour lancer l'import après upload réussi */
    importProcessUrl?: string;
    /** Nom du champ envoyé à importProcessUrl (défaut: id) */
    importPayloadKey?: string;
    /** Générateur de lien de suivi après mise en file de l'import */
    importProgressUrl?: (id: string) => string;
    /** Callback invoqué quand l'import est mis en file */
    onImportQueued?: (id: string) => void;
    /** Callback invoqué si le déclenchement d'import échoue */
    onImportError?: (error: unknown) => void;
    /** Libellé du bouton (optionnel, par défaut "Importer") */
    buttonLabel?: string;
    /** Classe CSS personnalisée pour le bouton (optionnel) */
    buttonClassName?: string;
};

type CsvUploadFilePondProps = {
    config: CsvUploadConfig;
};

type ImportStatus = 'idle' | 'processing' | 'finished' | 'error';

type ImportProgressPayload = {
    status?: string;
    processed?: number;
    total?: number;
    errors?: number;
    progress?: number;
    current?: {
        line?: number;
        sku?: string | null;
        name?: string | null;
    };
    message?: string;
    report?: string | null;
};

export function CsvUploadFilePond({ config }: CsvUploadFilePondProps) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<any[]>([]);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [uploadId, setUploadId] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
    const [importError, setImportError] = useState<string | null>(null);
    const [progressInfo, setProgressInfo] = useState<ImportProgressPayload | null>(null);
    const pondRef = useRef<FilePond>(null);
    const progressPollRef = useRef<number | null>(null);
    const shouldPollRef = useRef<boolean>(false);

    const stopProgressPolling = useCallback(() => {
        shouldPollRef.current = false;
        if (progressPollRef.current !== null) {
            window.clearInterval(progressPollRef.current);
            progressPollRef.current = null;
        }
    }, []);

    const resetState = useCallback(() => {
        stopProgressPolling();
        setFiles([]);
        setUploadComplete(false);
        setUploadId(null);
        setImportStatus('idle');
        setImportError(null);
        setProgressInfo(null);
        shouldPollRef.current = false;
    }, [stopProgressPolling]);

    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            resetState();
        }
    };

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
        if (meta?.content) return meta.content;
        const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
        return match ? decodeURIComponent(match[1]) : null;
    };

    const handleCancel = () => {
        resetState();
        setOpen(false);
    };

    const handleClose = () => {
        const redirectUrl = config.successRedirectUrl;
        resetState();
        setOpen(false);

        if (redirectUrl) {
            router.visit(redirectUrl);
        }
    };

    const csrfToken = getCsrfToken() || '';

    const startImport = useCallback(
        async (id: string) => {
            if (!config.importProcessUrl) {
                return;
            }

            console.log('[Import] Starting import for ID:', id);
            stopProgressPolling();
            setImportError(null);
            setProgressInfo(null);
            shouldPollRef.current = false;

            try {
                const response = await fetch(config.importProcessUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({
                        [config.importPayloadKey ?? 'id']: id,
                    }),
                });

                console.log('[Import] Response status:', response.status);

                if (!response.ok) {
                    throw new Error(`Import failed with status ${response.status}`);
                }

                // Response may be empty or JSON; we ignore the body if parsing fails
                const payload = await response
                    .json()
                    .catch(() => null);

                console.log('[Import] Response payload:', payload);

                if (payload && typeof payload === 'object') {
                    setProgressInfo(payload as ImportProgressPayload);
                    const status = String(payload.status ?? '').toLowerCase();
                    console.log('[Import] Status from response:', status);
                    if (status === 'done') {
                        console.log('[Import] Completed immediately');
                        stopProgressPolling();
                        setImportStatus('finished');
                    } else if (status === 'error') {
                        console.log('[Import] Error in response');
                        stopProgressPolling();
                        setImportStatus('error');
                        setImportError(typeof payload.message === 'string' ? payload.message : 'Import process failed');
                    } else if (status === 'cancelled') {
                        console.log('[Import] Cancelled in response');
                        stopProgressPolling();
                        setImportStatus('error');
                        setImportError('Import annulé');
                    } else {
                        console.log('[Import] Still processing, polling will continue');
                        shouldPollRef.current = true;
                        // Déclencher le useEffect du polling
                        setImportStatus('processing');
                    }
                } else {
                    console.log('[Import] Empty response, assuming finished');
                    stopProgressPolling();
                    setImportStatus('finished');
                }

                config.onImportQueued?.(id);
            } catch (error) {
                console.error('Failed to start import:', error);
                setImportStatus('error');
                setImportError(
                    error instanceof Error ? error.message : 'Import process failed',
                );
                setProgressInfo(null);
                config.onImportError?.(error);
                stopProgressPolling();
            }
        },
        [
            config.importPayloadKey,
            config.importProcessUrl,
            config.onImportError,
            config.onImportQueued,
            csrfToken,
            stopProgressPolling,
        ],
    );

    const handleRetryImport = () => {
        if (uploadId) {
            stopProgressPolling();
            setImportStatus('idle');
            setImportError(null);
            setProgressInfo(null);
            void startImport(uploadId);
        }
    };

    useEffect(() => {
        if (!config.importProcessUrl) {
            return;
        }

        if (!uploadComplete || !uploadId) {
            return;
        }

        if (importStatus !== 'idle') {
            return;
        }

        void startImport(uploadId);
    }, [config.importProcessUrl, importStatus, startImport, uploadComplete, uploadId]);

    useEffect(() => {
        if (!config.importProgressUrl || !uploadId) {
            // console.log('[Polling] Stopped: no URL or ID', { hasUrl: !!config.importProgressUrl, uploadId });
            stopProgressPolling();
            return;
        }

        if (importStatus !== 'processing') {
            // console.log('[Polling] Stopped: status is', importStatus);
            stopProgressPolling();
            return;
        }

        if (!shouldPollRef.current) {
            // console.log('[Polling] Waiting for import response before starting');
            return;
        }

        // console.log('[Polling] Starting for upload ID:', uploadId);

        let cancelled = false;
        const progressUrl = config.importProgressUrl!;

        const fetchProgress = async () => {
            // console.log('fetching progress for', uploadId);
            try {
                const response = await fetch(progressUrl(uploadId), {
                    headers: {
                        Accept: 'application/json',
                    },
                });

                if (!response.ok) {
                    // console.warn('[Progress] HTTP error:', response.status);
                    return;
                }

                const data: ImportProgressPayload = await response.json();
                // console.log('[Progress] Received:', data);

                if (cancelled) {
                    // console.log('[Progress] Cancelled flag set, ignoring');
                    return;
                }

                setProgressInfo(data);
                const status = String(data.status ?? '').toLowerCase();

                if (status === 'done') {
                    // console.log('[Progress] Import done, stopping polling');
                    setImportStatus('finished');
                    stopProgressPolling();
                } else if (status === 'error') {
                    // console.log('[Progress] Import error, stopping polling');
                    setImportStatus('error');
                    setImportError(typeof data.message === 'string' ? data.message : 'Import process failed');
                    stopProgressPolling();
                } else if (status === 'cancelled') {
                    // console.log('[Progress] Import cancelled, stopping polling');
                    setImportStatus('error');
                    setImportError('Import annulé');
                    stopProgressPolling();
                } else {
                    // console.log('[Progress] Status:', status, '- continuing polling');
                }
            } catch (error) {
                if (cancelled) {
                    return;
                }
                console.error('Failed to fetch import progress:', error);
            }
        };

        fetchProgress();
        progressPollRef.current = window.setInterval(fetchProgress, 1000);

        return () => {
            cancelled = true;
            stopProgressPolling();
        };
    }, [config.importProgressUrl, importStatus, stopProgressPolling, uploadId]);

    const handleServerResponse = (response: any) => {
        const rawResponse = typeof response === 'string'
            ? response
            : response?.responseText ?? '';

        if (!rawResponse) {
            return response;
        }

        try {
            const json = JSON.parse(rawResponse);
            // console.log('Upload response:', json);

            const nextId = json.uploadId ?? json.id ?? null;

            if (json.id || json.file) {
                setUploadComplete(true);
                setUploadId(nextId ? String(nextId) : null);
                setImportError(null);
                if (nextId) {
                    setImportStatus('idle');
                }
            }

            return nextId !== null ? String(nextId) : json.file ?? rawResponse;
        } catch (error) {
            console.warn('Server response is not valid JSON:', rawResponse, error);
            return rawResponse || response;
        }
    };

    const handleServerError = (response: any) => {
        const rawResponse = typeof response === 'string'
            ? response
            : response?.responseText ?? '';
        console.error('Upload error:', rawResponse || response);
        setImportStatus('error');
        setImportError('Échec du téléversement.');
        return rawResponse || response;
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={config.buttonClassName ?? "clickable inline-flex items-center border px-3 py-1 rounded text-sm"}
                >
                    <DownloadIcon />
                    {config.buttonLabel ?? ''}
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{config.title}</DialogTitle>
                    <DialogDescription>{config.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {!uploadComplete ? (
                        <FilePond
                            ref={pondRef}
                            files={files}
                            onupdatefiles={setFiles}
                            allowMultiple={false}
                            maxFiles={1}
                            chunkUploads={true}
                            chunkSize={1000000}
                            chunkRetryDelays={[500, 1000, 3000]}
                            server={{
                                url: config.uploadUrl,
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
                            // acceptedFileTypes={['text/csv', 'application/vnd.ms-excel', '.csv']}
                            credits={false}
                        />
                    ) : (
                        <div className="text-center py-8 space-y-3">
                            <p className="text-green-600 font-medium">✓ Fichier uploadé avec succès</p>

                            {config.importProcessUrl && (
                                <>
                                    {importStatus === 'processing' && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">
                                                Import en cours…
                                            </p>
                                            <div className="w-full h-2 rounded bg-muted">
                                                <div
                                                    className="h-2 rounded bg-primary transition-all"
                                                    style={{ width: `${Math.min(progressInfo?.progress ?? 0, 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {(progressInfo?.processed ?? 0)} / {(progressInfo?.total ?? 0)} lignes traitées – {(progressInfo?.errors ?? 0)} erreurs
                                            </p>
                                            {progressInfo?.current && (
                                                <p className="text-xs text-muted-foreground">
                                                    Ligne {progressInfo.current.line ?? progressInfo.processed ?? ''} · SKU {progressInfo.current.sku ?? '—'} · {progressInfo.current.name ?? ''}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {importStatus === 'finished' && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">
                                                Import terminé.
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {(progressInfo?.processed ?? 0)} lignes traitées
                                                {typeof progressInfo?.errors === 'number' ? ` · ${progressInfo.errors} erreurs` : ''}
                                            </p>
                                            {progressInfo?.report && (
                                                <a
                                                    href={progressInfo.report}
                                                    className="text-sm text-primary underline"
                                                >
                                                    Télécharger le rapport d'erreurs
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {importStatus === 'error' && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-destructive">
                                                {importError ?? "Impossible de traiter l'import."}
                                            </p>
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleRetryImport}
                                                    className="inline-flex items-center border px-2 py-1 rounded text-sm"
                                                    disabled={!uploadId}
                                                >
                                                    Réessayer
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {uploadComplete ? (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="inline-flex items-center border px-3 py-1 rounded text-sm bg-primary text-primary-foreground disabled:opacity-70"
                            disabled={Boolean(config.importProcessUrl && importStatus === 'processing')}
                        >
                            Fermer
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="inline-flex items-center border px-3 py-1 rounded text-sm"
                        >
                            Annuler
                        </button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

