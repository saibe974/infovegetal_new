import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { DownloadIcon, Upload } from 'lucide-react';
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

export function CsvUploadFilePond({ config }: CsvUploadFilePondProps) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<any[]>([]);
    const [uploadComplete, setUploadComplete] = useState(false);
    const [uploadId, setUploadId] = useState<string | null>(null);
    const [importStatus, setImportStatus] = useState<'idle' | 'queueing' | 'queued' | 'error'>('idle');
    const [importError, setImportError] = useState<string | null>(null);
    const pondRef = useRef<FilePond>(null);

    const resetState = () => {
        setFiles([]);
        setUploadComplete(false);
        setUploadId(null);
        setImportStatus('idle');
        setImportError(null);
    };

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

            setImportStatus('queueing');
            setImportError(null);

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

                if (!response.ok) {
                    throw new Error(`Import failed with status ${response.status}`);
                }

                // Response may be empty or JSON; we ignore the body if parsing fails
                await response
                    .json()
                    .catch(() => null);

                setImportStatus('queued');
                config.onImportQueued?.(id);
            } catch (error) {
                console.error('Failed to start import:', error);
                setImportStatus('error');
                setImportError(
                    error instanceof Error ? error.message : 'Import process failed',
                );
                config.onImportError?.(error);
            }
        },
        [
            config.importPayloadKey,
            config.importProcessUrl,
            config.onImportError,
            config.onImportQueued,
            csrfToken,
        ],
    );

    const handleRetryImport = () => {
        if (uploadId) {
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
                        <div className="text-center py-8 space-y-2">
                            <p className="text-green-600 font-medium">✓ Fichier uploadé avec succès</p>

                            {config.importProcessUrl && (
                                <>
                                    {(importStatus === 'idle' || importStatus === 'queueing') && (
                                        <p className="text-sm text-muted-foreground">
                                            Initialisation de l'import…
                                        </p>
                                    )}

                                    {importStatus === 'queued' && (
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">
                                                Import lancé. Vous pouvez fermer cette fenêtre.
                                            </p>
                                            {uploadId && config.importProgressUrl && (
                                                <a
                                                    href={config.importProgressUrl(uploadId)}
                                                    className="text-sm text-primary underline"
                                                >
                                                    Suivre la progression
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {importStatus === 'error' && (
                                        <div className="space-y-2">
                                            <p className="text-sm text-destructive">
                                                {importError ?? "Impossible de démarrer l'import."}
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
                            disabled={Boolean(config.importProcessUrl && importStatus === 'queueing')}
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

