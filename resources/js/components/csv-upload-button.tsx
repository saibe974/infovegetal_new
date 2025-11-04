import { useState, useRef } from 'react';
import { router } from '@inertiajs/react';
import { Loader2, DownloadIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ProcessingProgress } from '@/components/processing-progress';

type CsvUploadConfig = {
    /** Type de données à importer (ex: 'products', 'categories', 'tags') */
    type: string;
    /** Titre de la boîte de dialogue */
    title: string;
    /** Description affichée dans la boîte de dialogue */
    description: string;
    /** URL pour uploader le fichier */
    uploadUrl: string;
    /** URL pour déclencher le traitement */
    processUrl: string;
    /** URL pour annuler le traitement */
    cancelUrl: string;
    /** URL pour vérifier la progression */
    progressUrl: (id: string) => string;
    /** URL pour le rapport d'erreurs */
    reportUrl: (id: string) => string;
    /** URL de redirection après succès */
    successRedirectUrl?: string;
    /** Libellé du bouton (optionnel, par défaut "Importer") */
    buttonLabel?: string;
    /** Classe CSS personnalisée pour le bouton (optionnel) */
    buttonClassName?: string;
};

type CsvUploadButtonProps = {
    config: CsvUploadConfig;
};

export function CsvUploadButton({ config }: CsvUploadButtonProps) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [uploadPct, setUploadPct] = useState<number>(0);
    const [processPct, setProcessPct] = useState<number>(0);
    const [importId, setImportId] = useState<string | null>(null);
    const pollRef = useRef<number | null>(null);
    const xhrRef = useRef<XMLHttpRequest | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [done, setDone] = useState(false);
    const isLocked = uploading || processing;

    const clearPoll = () => {
        if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
        if (meta?.content) return meta.content;
        const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
        return match ? decodeURIComponent(match[1]) : null;
    };

    const handleImport = async () => {
        if (!file) return;
        setUploadPct(0);
        setProcessPct(0);
        setDone(false);
        setUploading(true);
        setProcessing(false);

        // 1) Upload avec XHR pour avoir la progression
        const form = new FormData();
        form.append('file', file);
        form.append('type', config.type);

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', config.uploadUrl);

        const csrf = getCsrfToken();
        if (csrf) {
            xhr.setRequestHeader('X-CSRF-TOKEN', csrf);
            xhr.setRequestHeader('X-XSRF-TOKEN', csrf);
        }
        xhr.setRequestHeader('Accept', 'application/json');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

        xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
                setUploadPct(Math.round((evt.loaded / evt.total) * 100));
            }
        };

        const uploadPromise: Promise<{ id: string } | null> = new Promise((resolve) => {
            xhr.onload = () => {
                setUploading(false);
                try {
                    const json = JSON.parse(xhr.responseText);
                    resolve(json);
                } catch {
                    resolve(null);
                }
            };
            xhr.onerror = () => {
                setUploading(false);
                resolve(null);
            };
            xhr.onabort = () => {
                setUploading(false);
                resolve(null);
            };
        });

        xhr.send(form);

        const uploaded = await uploadPromise;
        if (!uploaded || !uploaded.id) return;
        setImportId(uploaded.id);

        // 2) Lancer le traitement
        setProcessing(true);
        setShowResult(true);
        try {
            const csrf2 = getCsrfToken();
            await fetch(config.processUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(csrf2 ? { 'X-CSRF-TOKEN': csrf2, 'X-XSRF-TOKEN': csrf2 } : {}),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ id: uploaded.id, type: config.type }),
            });
        } catch (_) {
            // ignore, polling nous dira si erreur
        }
    };

    const handleCancel = async () => {
        // Annuler l'upload si en cours
        if (uploading && xhrRef.current) {
            try { xhrRef.current.abort(); } catch { }
            xhrRef.current = null;
            setUploading(false);
            setUploadPct(0);
        }

        // Annuler le traitement serveur si en cours
        if (processing && importId) {
            clearPoll();
            setProcessing(false);
            try {
                const csrf = getCsrfToken();
                await fetch(config.cancelUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(csrf ? { 'X-CSRF-TOKEN': csrf, 'X-XSRF-TOKEN': csrf } : {}),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ id: importId, type: config.type }),
                });
            } catch { }
        }

        // Reset basique et fermeture
        setImportId(null);
        setProcessPct(0);
        setFile(null);
        setDone(false);
        setOpen(false);
    };

    const handleClose = () => {
        if (config.successRedirectUrl) {
            router.visit(config.successRedirectUrl);
        } else {
            setOpen(false);
            setFile(null);
            setImportId(null);
            setDone(false);
            setShowResult(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!isLocked) setOpen(o); }}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={config.buttonClassName ?? "clickable inline-flex items-center border px-3 py-1 rounded text-sm"}
                    disabled={uploading}>
                    {uploading ? <Loader2 className="animate-spin mr-2" size={16} /> : <DownloadIcon />}
                </button>
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-xl"
                onEscapeKeyDown={(e) => { if (isLocked) e.preventDefault(); }}
                onPointerDownOutside={(e) => { if (isLocked) e.preventDefault(); }}
            >
                <DialogHeader>
                    <DialogTitle>{config.title}</DialogTitle>
                    <DialogDescription>{config.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <input
                            ref={fileInputRef}
                            id={`csv-file-input-${config.type}`}
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDone(false); }}
                            disabled={isLocked}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="clickable inline-flex items-center border px-3 py-1 rounded text-sm"
                            disabled={isLocked}
                            aria-label="Choisir un fichier CSV"
                        >
                            Choisir un fichier
                        </button>
                        {file && (
                            <span className="text-sm text-muted-foreground truncate max-w-[240px]" title={file.name}>
                                {file.name}
                            </span>
                        )}
                    </div>

                    {/* Progress upload */}
                    {uploading && (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Upload</span>
                                <span>{uploadPct}%</span>
                            </div>
                            <div className="h-2 w-full rounded bg-muted">
                                <div className="h-2 rounded bg-primary" style={{ width: `${uploadPct}%` }} />
                            </div>
                        </div>
                    )}

                    {/* Progress processing */}
                    {(importId && showResult) && (
                        <ProcessingProgress
                            id={importId}
                            progressUrl={config.progressUrl(importId)}
                            reportUrl={config.reportUrl(importId)}
                            percent={processPct}
                            onDone={() => {
                                setProcessing(false);
                                setDone(true);
                            }}
                        />
                    )}
                </div>

                <DialogFooter>
                    {done ? (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="inline-flex items-center border px-3 py-1 rounded text-sm bg-primary text-primary-foreground"
                        >
                            Fermer
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="inline-flex items-center border px-3 py-1 rounded text-sm"
                                disabled={!uploading && !processing}>
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleImport}
                                className="inline-flex items-center border px-3 py-1 rounded text-sm bg-primary text-primary-foreground disabled:opacity-50"
                                disabled={!file || isLocked}
                            >
                                {(uploading || processing) ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                                {config.buttonLabel ?? 'Importer'}
                            </button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
