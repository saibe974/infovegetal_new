import React, { useCallback, useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { DownloadIcon } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

// FilePond imports
import { FilePond } from 'react-filepond';
import type { FilePondProps } from 'react-filepond';
import 'filepond/dist/filepond.min.css';
import { Button } from './ui/button';

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
    description?: string;
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
    postTreatmentComponent?: React.ComponentType<any>;
    postTreatmentProps?: Record<string, any>;

};

type ImportStatus =
    | 'idle'
    | 'processing'
    | 'cancelling'
    | 'finished'
    | 'cancelled'
    | 'error';

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
    postTreatmentComponent,
    postTreatmentProps,
}: CsvUploadFilePondProps) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<any[]>([]);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [uploadId, setUploadId] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
    const [importError, setImportError] = useState<string | null>(null);
    const [progressInfo, setProgressInfo] =
        useState<ImportProgressPayload | null>(null);
    const [isCancellingImport, setIsCancellingImport] = useState(false);

    const isRequestingChunkRef = useRef(false);
    const pondRef = useRef<any>(null); // any pour accéder à setOptions sans friction TS
    const progressPollRef = useRef<number | null>(null);
    const shouldPollRef = useRef<boolean>(false);

    const hasImportFlow = Boolean(importProcessUrl);
    const isProcessingLocked =
        hasImportFlow &&
        uploadComplete &&
        (importStatus === 'idle' ||
            importStatus === 'processing' ||
            importStatus === 'cancelling');

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
        const meta = document.querySelector(
            'meta[name="csrf-token"]',
        ) as HTMLMetaElement | null;
        if (meta?.content) return meta.content;
        const match = document.cookie.match(
            /(?:^|; )XSRF-TOKEN=([^;]*)/,
        );
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
        async (id: string, settings?: { dbProductsId?: number }) => {
            if (!importProcessUrl) {
                return;
            }

            // console.log('[Import] Starting import for ID:', id);
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
                const body: any = {
                    [importPayloadKey ?? 'id']: id,
                };

                // Ajouter les paramètres supplémentaires si fournis
                if (settings?.dbProductsId) {
                    body.db_products_id = settings.dbProductsId;
                }

                const response = await fetch(importProcessUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify(body),
                });

                // console.log('[Import] Response :', response);

                if (!response.ok) {
                    throw new Error(
                        `Import failed with status ${response.status}`,
                    );
                }

                const payload = await response.json().catch(() => null);

                // console.log('[Import] Response payload:', payload);

                if (payload && typeof payload === 'object') {
                    setProgressInfo(payload as ImportProgressPayload);
                    const status = String(payload.status ?? '').toLowerCase();
                    // console.log('[Import] Status from response:', status);
                    if (status === 'done') {
                        // console.log('[Import] Completed immediately');
                        stopProgressPolling();
                        setImportStatus('finished');
                    } else if (status === 'error') {
                        // console.log('[Import] Error in response');
                        stopProgressPolling();
                        setImportStatus('error');
                        setImportError(
                            typeof payload.message === 'string'
                                ? payload.message
                                : 'Import process failed',
                        );
                    } else if (status === 'cancelled') {
                        // console.log('[Import] Cancelled in response');
                        stopProgressPolling();
                        setImportStatus('cancelled');
                    } else if (status === 'cancelling') {
                        // console.log('[Import] Cancellation requested');
                        shouldPollRef.current = true;
                        setImportStatus('cancelling');
                    } else {
                        // console.log(
                        //     '[Import] Still processing, polling will continue',
                        // );
                        shouldPollRef.current = true;
                        setImportStatus('processing');
                    }
                } else {
                    // console.log(
                    //     '[Import] Empty response, assuming processing',
                    // );
                    shouldPollRef.current = true;
                    setImportStatus('processing');
                }

                onImportQueued?.(id);
            } catch (error) {
                // console.error('Failed to start import:', error);
                setImportStatus('error');
                setImportError(
                    error instanceof Error
                        ? error.message
                        : 'Import process failed',
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
        setFiles([]);
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
                throw new Error(
                    `Cancellation failed with status ${response.status}`,
                );
            }

            const payload = await response.json().catch(() => null);
            shouldPollRef.current = true;
            setImportStatus('cancelling');
            setImportError(null);
            setProgressInfo((prev) => ({
                ...(prev ?? {}),
                status:
                    typeof payload?.status === 'string'
                        ? payload.status
                        : 'cancelling',
            }));
        } catch (error) {
            console.error('Failed to cancel import:', error);
            setImportError("Impossible d'annuler l'import");
        } finally {
            setIsCancellingImport(false);
        }
    }, [
        importCancelUrl,
        importPayloadKey,
        csrfToken,
        isCancellingImport,
        uploadId,
    ]);

    useEffect(() => {
        if (!importProcessUrl) {
            return;
        }

        if (!uploadComplete || !uploadId) {
            return;
        }

        // Ne pas auto-démarrer si on a un composant de post-traitement
        // (il gérera le démarrage via son formulaire)
        if (postTreatmentComponent) {
            return;
        }

        if (importStatus !== 'idle') {
            return;
        }

        void startImport(uploadId);
    }, [
        importProcessUrl,
        importStatus,
        startImport,
        uploadComplete,
        uploadId,
        postTreatmentComponent,
    ]);

    useEffect(() => {
        if (!importProgressUrl || !uploadId) {
            stopProgressPolling();
            return;
        }

        const shouldPoll =
            importStatus === 'processing' || importStatus === 'cancelling';
        if (!shouldPoll) {
            // console.log('[Polling] Stopped: status is', importStatus);
            stopProgressPolling();
            return;
        }

        if (!shouldPollRef.current) {
            // console.log(
            //     '[Polling] Waiting for import response before starting, shouldPollRef=',
            //     shouldPollRef.current,
            // );
            // return;
        }

        // console.log('[Polling] Starting for upload ID:', uploadId);
        let cancelled = false;
        const progressUrl = importProgressUrl!;

        const fetchProgress = async () => {
            if (progressPollRef.current !== null) {
                window.clearInterval(progressPollRef.current);
                progressPollRef.current = null;
            }
            // console.log('[Polling][Fetch] fetching progress for', uploadId);
            try {
                const response = await fetch(progressUrl(uploadId), {
                    headers: { Accept: 'application/json' },
                });
                if (!response.ok) return;

                const data: ImportProgressPayload = await response.json();
                if (cancelled) return;

                const realProgress =
                    typeof data.progress === 'number'
                        ? Math.max(0, Math.min(100, data.progress))
                        : 0;

                const realProcessed =
                    typeof data.processed === 'number'
                        ? Math.max(0, data.processed)
                        : 0;

                lastRealProgressRef.current = realProgress;
                lastRealProcessedRef.current = realProcessed;

                setProgressInfo(data);

                const status = String(data.status ?? '').toLowerCase();

                // Si le backend indique qu'il reste des chunks, on en déclenche un nouveau
                if (
                    status === 'processing' &&
                    data.has_more &&
                    importProcessChunkUrl &&
                    !isRequestingChunkRef.current
                ) {
                    try {
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
                        // console.log(
                        //     '[Import][Chunk] response status=',
                        //     resp.status,
                        // );
                    } catch (e) {
                        console.error(
                            '[Import][Chunk] Failed to request next import chunk:',
                            e,
                        );
                    } finally {
                        isRequestingChunkRef.current = false;
                    }
                }

                if (status === 'done') {
                    setImportStatus('finished');
                    stopProgressPolling();
                } else if (status === 'error') {
                    setImportStatus('error');
                    setImportError(
                        typeof data.message === 'string'
                            ? data.message
                            : 'Import process failed',
                    );
                    stopProgressPolling();
                } else if (status === 'cancelled') {
                    setImportStatus('cancelled');
                    stopProgressPolling();
                } else if (status === 'cancelling') {
                    setImportStatus('cancelling');
                    progressPollRef.current = window.setInterval(
                        fetchProgress,
                        1000,
                    );
                } else {
                    progressPollRef.current = window.setInterval(
                        fetchProgress,
                        1000,
                    );
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
    }, [
        importProgressUrl,
        importStatus,
        stopProgressPolling,
        uploadId,
    ]);

    useEffect(() => {
        if (importStatus !== 'processing') {
            setDisplayProgress(lastRealProgressRef.current);
            setDisplayProcessed(lastRealProcessedRef.current);
            return;
        }

        const interval = 150; // ms

        const id = window.setInterval(() => {
            setDisplayProcessed((current) => {
                const processedTarget = lastRealProcessedRef.current;
                const totalLines = progressInfo?.total ?? 0;

                if (totalLines === 0 || current >= processedTarget) {
                    return current;
                }

                const increment = Math.max(
                    1,
                    Math.ceil((processedTarget - current) / 10),
                );
                const next = current + increment;
                return next > processedTarget ? processedTarget : next;
            });

            setDisplayProgress((current) => {
                const totalLines = progressInfo?.total ?? 0;
                const processedTarget = lastRealProcessedRef.current;

                if (totalLines === 0) {
                    return current;
                }

                const calculatedProgress =
                    (processedTarget / totalLines) * 100;
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
        const rawResponse =
            typeof response === 'string'
                ? response
                : response?.responseText ?? '';

        if (!rawResponse) {
            return response;
        }

        try {
            const json = JSON.parse(rawResponse);

            const nextId = json.uploadId ?? json.id ?? null;

            if (json.id || json.file) {
                setUploadComplete(true);
                setUploadId(nextId ? String(nextId) : null);
                setImportError(null);
                if (nextId) {
                    setImportStatus('idle');
                }
            }

            return nextId !== null
                ? String(nextId)
                : json.file ?? rawResponse;
        } catch (error) {
            console.warn(
                'Server response is not valid JSON:',
                rawResponse,
                error,
            );
            return rawResponse || response;
        }
    };

    const handleServerError = (response: any) => {
        const rawResponse =
            typeof response === 'string'
                ? response
                : response?.responseText ?? '';
        console.error('Upload error:', rawResponse || response);
        setImportStatus('error');
        setImportError('Échec du téléversement.');
        return rawResponse || response;
    };

    // console.log(files)

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    // type="button"
                    // className={
                    //     buttonClassName ??
                    //     'clickable inline-flex items-center border px-3 py-1 rounded text-sm'
                    // }
                    variant={'outline'}
                    title={title}
                >
                    <DownloadIcon />
                    {buttonLabel ?? ''}
                </Button>
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
                    {importStatus !== 'processing' && importStatus !== 'cancelling' && (
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
                    )}
                    {uploadComplete && (
                        <div className="text-center py-4 space-y-3">
                            {importProcessUrl && postTreatmentComponent && (
                                React.createElement(postTreatmentComponent, {
                                    ...postTreatmentProps,
                                    importStatus,
                                    importError,
                                    progressInfo,
                                    displayProgress,
                                    handleRetryImport,
                                    uploadId,
                                    onStartImport: (settings: any) => {
                                        // Déclencher l'import avec les paramètres choisis
                                        if (uploadId) {
                                            void startImport(uploadId, settings);
                                        }
                                    },
                                })
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex items-center justify-between gap-2">
                    {uploadComplete ? (
                        <>
                            {importProcessUrl &&
                                importCancelUrl &&
                                (importStatus === 'processing' ||
                                    importStatus === 'cancelling') && (
                                    <button
                                        type="button"
                                        onClick={handleCancelImport}
                                        className="inline-flex items-center border px-3 py-1 rounded text-sm"
                                        disabled={isCancellingImport}
                                    >
                                        {isCancellingImport
                                            ? 'Annulation…'
                                            : "Annuler l'import"}
                                    </button>
                                )}
                            <button
                                type="button"
                                onClick={handleClose}
                                className="inline-flex items-center border px-3 py-1 rounded text-sm bg-primary text-primary-foreground disabled:opacity-70"
                                disabled={Boolean(
                                    importProcessUrl &&
                                    (importStatus === 'processing' ||
                                        importStatus === 'cancelling'),
                                )}
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
