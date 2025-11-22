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
    /** URL à appeler pour annuler l'import en cours */
    importCancelUrl?: string;
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
    title: string;
    description: string;
    uploadUrl: string;
    successRedirectUrl?: string;
    importProcessUrl?: string;
    importProcessChunkUrl?: string;
    importCancelUrl?: string;
    importPayloadKey?: string;
    importProgressUrl?: (id: string) => string;
    onImportQueued?: (id: string) => void;
    onImportError?: (error: unknown) => void;
    buttonLabel?: string;
    buttonClassName?: string;
};

type ImportStatus = 'idle' | 'processing' | 'cancelling' | 'finished' | 'cancelled' | 'error';

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
    next_offset?: number;
    has_more?: boolean;
};

export function CsvUploadFilePond({
    title,
    description,
    uploadUrl,
    importProcessUrl,
    importProcessChunkUrl,
    importCancelUrl,
    importProgressUrl,
    importPayloadKey,
    successRedirectUrl,
    onImportQueued,
    onImportError,
    buttonLabel,
    buttonClassName,
}: CsvUploadFilePondProps) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<any[]>([]);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [uploadId, setUploadId] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
    const [importError, setImportError] = useState<string | null>(null);
    const [progressInfo, setProgressInfo] = useState<ImportProgressPayload | null>(null);
    const [isCancellingImport, setIsCancellingImport] = useState(false);
    const isRequestingChunkRef = useRef(false);
    const pondRef = useRef<FilePond>(null);
    const progressPollRef = useRef<number | null>(null);
    const shouldPollRef = useRef<boolean>(false);
    const hasImportFlow = Boolean(importProcessUrl);
    const isProcessingLocked = hasImportFlow && uploadComplete && (importStatus === 'idle' || importStatus === 'processing' || importStatus === 'cancelling');
    const [displayProgress, setDisplayProgress] = useState<number>(0);
    const lastRealProgressRef = useRef<number>(0);
    const [displayProcessed, setDisplayProcessed] = useState<number>(0);
    const lastRealProcessedRef = useRef<number>(0);

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
        setIsCancellingImport(false);
        shouldPollRef.current = false;
        setDisplayProgress(0);
        lastRealProgressRef.current = 0;
        setDisplayProcessed(0);
        lastRealProcessedRef.current = 0;
    }, [stopProgressPolling]);

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen && isProcessingLocked) {
            return;
        }
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
        const redirectUrl = successRedirectUrl;
        resetState();
        setOpen(false);

        if (redirectUrl) {
            router.visit(redirectUrl);
        }
    };

    const csrfToken = getCsrfToken() || '';

    const startImport = useCallback(
        async (id: string) => {
            if (!importProcessUrl) {
                return;
            }

            console.log('[Import] Starting import for ID:', id);
            setImportError(null);
            setProgressInfo(null);
            setDisplayProgress(0);
            lastRealProgressRef.current = 0;
            setDisplayProcessed(0);
            lastRealProcessedRef.current = 0;

            // 🔹 Activer le polling tout de suite
            shouldPollRef.current = true;
            setImportStatus('processing');

            try {
                const response = await fetch(importProcessUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({
                        [importPayloadKey ?? 'id']: id,
                    }),
                });

                console.log('[Import] Response :', response);

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
                        setImportStatus('cancelled');
                    } else if (status === 'cancelling') {
                        console.log('[Import] Cancellation requested');
                        shouldPollRef.current = true;
                        setImportStatus('cancelling');
                    } else {
                        console.log('[Import] Still processing, polling will continue');
                        shouldPollRef.current = true;
                        // Déclencher le useEffect du polling
                        setImportStatus('processing');
                    }
                } else {
                    console.log('[Import] Empty response, assuming processing');
                    shouldPollRef.current = true;
                    setImportStatus('processing');
                }

                onImportQueued?.(id);
            } catch (error) {
                console.error('Failed to start import:', error);
                setImportStatus('error');
                setImportError(
                    error instanceof Error ? error.message : 'Import process failed',
                );
                setProgressInfo(null);
                onImportError?.(error);
                stopProgressPolling();
            }
        },
        [
            importPayloadKey,
            importProcessUrl,
            onImportError,
            onImportQueued,
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

    const handleCancelImport = useCallback(async () => {
        if (!importCancelUrl || !uploadId || isCancellingImport) {
            return;
        }

        setIsCancellingImport(true);
        try {
            const response = await fetch(importCancelUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    [importPayloadKey ?? 'id']: uploadId,
                }),
            });

            if (!response.ok) {
                throw new Error(`Cancellation failed with status ${response.status}`);
            }

            const payload = await response.json().catch(() => null);
            shouldPollRef.current = true;
            setImportStatus('cancelling');
            setImportError(null);
            setProgressInfo((prev) => ({
                ...(prev ?? {}),
                status: typeof payload?.status === 'string' ? payload.status : 'cancelling',
            }));
        } catch (error) {
            console.error('Failed to cancel import:', error);
            setImportError("Impossible d'annuler l'import");
        } finally {
            setIsCancellingImport(false);
        }
    }, [importCancelUrl, importPayloadKey, csrfToken, isCancellingImport, uploadId]);

    useEffect(() => {
        if (!importProcessUrl) {
            return;
        }

        if (!uploadComplete || !uploadId) {
            return;
        }

        if (importStatus !== 'idle') {
            return;
        }

        void startImport(uploadId);
    }, [importProcessUrl, importStatus, startImport, uploadComplete, uploadId]);

    useEffect(() => {
        console.log('[Polling][Effect] Triggered', {
            hasProgressUrl: !!importProgressUrl,
            uploadId,
            importStatus,
            shouldPollRef: shouldPollRef.current,
        });

        if (!importProgressUrl || !uploadId) {
            console.log('[Polling] Stopped: no URL or ID', { hasUrl: !!importProgressUrl, uploadId });
            stopProgressPolling();
            return;
        }

        const shouldPoll = importStatus === 'processing' || importStatus === 'cancelling';
        if (!shouldPoll) {
            console.log('[Polling] Stopped: status is', importStatus);
            stopProgressPolling();
            return;
        }

        if (!shouldPollRef.current) {
            console.log('[Polling] Waiting for import response before starting, shouldPollRef=', shouldPollRef.current);
            // return;
        }

        console.log('[Polling] Starting for upload ID:', uploadId);

        let cancelled = false;
        let stagnantCount = 0;
        let lastKey = '';
        const progressUrl = importProgressUrl!;

        const fetchProgress = async () => {
            console.log('[Polling][Fetch] fetching progress for', uploadId);
            try {
                const response = await fetch(progressUrl(uploadId), {
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) return;

                const data: ImportProgressPayload = await response.json();
                if (cancelled) return;

                // console.log('[Import][Progress][RAW]', data);

                const realProgress = typeof data.progress === 'number'
                    ? Math.max(0, Math.min(100, data.progress))
                    : 0;

                const realProcessed = typeof data.processed === 'number'
                    ? Math.max(0, data.processed)
                    : 0;

                // mémorise les valeurs réelles
                lastRealProgressRef.current = realProgress;
                lastRealProcessedRef.current = realProcessed;

                setProgressInfo(data);

                const status = String(data.status ?? '').toLowerCase();

                // Clé simple pour savoir si ça progresse encore
                // const key = `${data.processed ?? 0}:${data.errors ?? 0}`;
                // if (status === 'processing' || status === 'cancelling' || status === '' || status === 'waiting') {
                //     if (key === lastKey) {
                //         stagnantCount++;
                //     } else {
                //         stagnantCount = 0;
                //         lastKey = key;
                //     }

                //     // Si ça ne bouge plus depuis un moment, on arrête proprement
                //     if (stagnantCount > 5) {
                //         setImportStatus('finished');
                //         stopProgressPolling();
                //         return;
                //     }
                // }

                // Si le backend indique qu'il reste des chunks, on en déclenche un nouveau
                if (status === 'processing' && data.has_more && importProcessChunkUrl && !isRequestingChunkRef.current) {
                    try {
                        // console.log(
                        //     '[Import][Chunk] requesting next chunk',
                        //     'current_next_offset=', data.next_offset,
                        //     'uploadId=', uploadId,
                        // );
                        isRequestingChunkRef.current = true;
                        const resp = await fetch(importProcessChunkUrl, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                Accept: 'application/json',
                                'X-CSRF-TOKEN': csrfToken,
                                'X-Requested-With': 'XMLHttpRequest',
                            },
                            body: JSON.stringify({ id: uploadId }),
                        });
                        console.log('[Import][Chunk] response status=', resp.status);
                    } catch (e) {
                        console.error('[Import][Chunk] Failed to request next import chunk:', e);
                    } finally {
                        isRequestingChunkRef.current = false;
                    }
                } else {
                    // console.log(
                    //     '[Import][Chunk] not requesting chunk',
                    //     'status=', status,
                    //     'has_more=', data.has_more,
                    //     'importProcessChunkUrl=', !!importProcessChunkUrl,
                    //     'isRequestingChunk=', isRequestingChunkRef.current,
                    // );
                }

                if (status === 'done') {
                    setImportStatus('finished');
                    stopProgressPolling();
                } else if (status === 'error') {
                    setImportStatus('error');
                    setImportError(typeof data.message === 'string' ? data.message : 'Import process failed');
                    stopProgressPolling();
                } else if (status === 'cancelled') {
                    setImportStatus('cancelled');
                    stopProgressPolling();
                } else if (status === 'cancelling') {
                    setImportStatus('cancelling');
                }
            } catch (error) {
                if (cancelled) return;
                console.error('Failed to fetch import progress:', error);
            }
        };

        fetchProgress();
        progressPollRef.current = window.setInterval(fetchProgress, 1000);

        return () => {
            cancelled = true;
            stopProgressPolling();
        };
    }, [importProgressUrl, importStatus, stopProgressPolling, uploadId]);

    useEffect(() => {
        if (importStatus !== 'processing') {
            // Quand on n’est plus en processing, on colle à la vraie valeur
            setDisplayProgress(lastRealProgressRef.current);
            return;
        }

        const increment = 0.3;  // progression par tick (en %)
        const interval = 150; // ms

        const id = window.setInterval(() => {
            setDisplayProgress((current) => {
                const target = lastRealProgressRef.current;
                if (current >= target) {
                    return current;
                }
                const next = current + increment;
                return next > target ? target : next;
            });
        }, interval);

        return () => window.clearInterval(id);
    }, [importStatus]);

    useEffect(() => {
        if (importStatus !== 'processing') {
            // Quand on n'est plus en processing, on colle aux vraies valeurs
            setDisplayProgress(lastRealProgressRef.current);
            setDisplayProcessed(lastRealProcessedRef.current);
            return;
        }

        const interval = 150; // ms

        const id = window.setInterval(() => {
            // Mettre à jour displayProcessed en fonction du ratio progress/100
            setDisplayProcessed((current) => {
                const processedTarget = lastRealProcessedRef.current;
                const totalLines = progressInfo?.total ?? 0;

                if (totalLines === 0 || current >= processedTarget) {
                    return current;
                }

                // Calculer l'incrément basé sur la vitesse de progression
                const incrementPerTick = Math.max(1, Math.ceil(totalLines / 2000));
                const next = current + incrementPerTick;
                return next > processedTarget ? processedTarget : next;
            });

            // Synchroniser displayProgress avec displayProcessed
            setDisplayProgress((current) => {
                const totalLines = progressInfo?.total ?? 0;
                const processedTarget = lastRealProcessedRef.current;

                if (totalLines === 0) {
                    return current;
                }

                // Calculer la progress basée sur les lignes traitées
                const calculatedProgress = (processedTarget / totalLines) * 100;
                const effectiveTarget = Math.min(calculatedProgress, 100);

                if (current >= effectiveTarget) {
                    return current;
                }
                const increment = 0.3;
                const next = current + increment;
                return next > effectiveTarget ? effectiveTarget : next;
            });
        }, interval);

        return () => window.clearInterval(id);
    }, [importStatus, progressInfo?.total]);

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
                    className={buttonClassName ?? "clickable inline-flex items-center border px-3 py-1 rounded text-sm"}
                >
                    <DownloadIcon />
                    {buttonLabel ?? ''}
                </button>
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-xl"
                onEscapeKeyDown={(event) => {
                    if (isProcessingLocked) {
                        event.preventDefault();
                    }
                }}
                onInteractOutside={(event) => {
                    if (isProcessingLocked) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
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
                                url: uploadUrl,
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

                            {importProcessUrl && (
                                <>
                                    {(importStatus === 'processing' || importStatus === 'cancelling') && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">
                                                {(importStatus === 'cancelling' || progressInfo?.status === 'cancelling')
                                                    ? 'Annulation en cours…'
                                                    : 'Import en cours…'}
                                            </p>
                                            <div className="w-full h-2 rounded bg-muted">
                                                <div
                                                    className="h-2 rounded bg-primary transition-all"
                                                    style={{ width: `${Math.min(displayProgress, 100)}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {(progressInfo?.errors ?? 0)} erreurs
                                            </p>

                                            {importError && (
                                                <p className="text-xs text-destructive">
                                                    {importError}
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

                                    {importStatus === 'cancelled' && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-muted-foreground">
                                                Import annulé.
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Vous pouvez fermer cette fenêtre ou relancer un nouvel import si nécessaire.
                                            </p>
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

                <DialogFooter className="flex items-center justify-between gap-2">
                    {uploadComplete ? (
                        <>
                            {importProcessUrl && importCancelUrl && (importStatus === 'processing' || importStatus === 'cancelling') && (
                                <button
                                    type="button"
                                    onClick={handleCancelImport}
                                    className="inline-flex items-center border px-3 py-1 rounded text-sm"
                                    disabled={isCancellingImport}
                                >
                                    {isCancellingImport ? 'Annulation…' : "Annuler l'import"}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleClose}
                                className="inline-flex items-center border px-3 py-1 rounded text-sm bg-primary text-primary-foreground disabled:opacity-70"
                                disabled={Boolean(importProcessUrl && (importStatus === 'processing' || importStatus === 'cancelling'))}
                            >
                                Fermer
                            </button>
                        </>
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

