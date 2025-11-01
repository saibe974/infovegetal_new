import products from '@/routes/products';
import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Loader2, DownloadIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';


function UploadCsvButton() {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [uploadPct, setUploadPct] = useState<number>(0);
    const [importId, setImportId] = useState<string | null>(null);
    const xhrRef = useRef<XMLHttpRequest | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [done, setDone] = useState(false);
    const isLocked = uploading || processing; // verrous UI pendant traitement

    // Réinitialise l'UI du dialogue pour sélectionner un nouveau fichier
    const resetDialogForNewFile = () => {
        if (uploading || processing) return; // protégé par isLocked mais on garde une sécurité
        setImportId(null);
        setUploadPct(0);
        setShowResult(false);
        setDone(false);
        setFile(null);
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
        setDone(false);
        setUploading(true);
        setProcessing(false);

        // 1) Upload avec XHR pour avoir la progression
        const form = new FormData();
        form.append('file', file);
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        xhr.open('POST', '/products/import/upload');
        // CSRF pour Laravel (meta ou cookie XSRF)
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

        // 2) Lancer le traitement et démarrer le polling de progression
        // console.log("Starting processing for import ID:", uploaded.id);
        setProcessing(true);
        setShowResult(true);
        try {
            const csrf2 = getCsrfToken();
            await fetch('/products/import/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    ...(csrf2 ? { 'X-CSRF-TOKEN': csrf2, 'X-XSRF-TOKEN': csrf2 } : {}),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({ id: uploaded.id }),
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
            setProcessing(false);
            try {
                const csrf = getCsrfToken();
                await fetch('/products/import/cancel', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...(csrf ? { 'X-CSRF-TOKEN': csrf, 'X-XSRF-TOKEN': csrf } : {}),
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                    body: JSON.stringify({ id: importId }),
                });
            } catch { }
        }
        // Reset basique et fermeture
        setImportId(null);
        setFile(null);
        setDone(false);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!isLocked) setOpen(o); }}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="clickable inline-flex items-center border px-3 py-1 rounded text-sm"
                    disabled={uploading}>
                    {uploading ? <Loader2 className="animate-spin mr-2" size={16} /> : <DownloadIcon />}
                </button>
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-xl"
                // Empêche la fermeture pendant traitement (overlay/escape)
                onEscapeKeyDown={(e) => { if (isLocked) e.preventDefault(); }}
                onPointerDownOutside={(e) => { if (isLocked) e.preventDefault(); }}
            >
                <DialogHeader>
                    <DialogTitle>Import CSV</DialogTitle>
                    <DialogDescription>
                        Importez un fichier CSV pour créer/mettre à jour vos produits (~100/s)
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <input
                            ref={fileInputRef}
                            id="csv-file-input"
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDone(false); }}
                            disabled={isLocked}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => { resetDialogForNewFile(); fileInputRef.current?.click(); }}
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
                    {(importId && showResult) ?
                        <ProcessingProgress
                            id={importId}
                            onDone={() => {
                                setProcessing(false);
                                setDone(true);
                            }}
                        /> : null
                    }
                </div>

                <DialogFooter>

                    {done ? (
                        <button
                            type="button"
                            onClick={() => router.visit(products.index().url)}
                            className="inline-flex items-center border px-3 py-1 rounded text-sm bg-primary text-primary-foreground"
                        >
                            Fermer
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={handleImport}
                                className="inline-flex items-center border px-3 py-1 rounded text-sm bg-primary text-primary-foreground disabled:opacity-50"
                                disabled={!file || isLocked}
                            >
                                {(uploading || processing) ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                                Importer
                            </button>

                            {(uploading || processing) ?
                                <Button
                                    variant="destructive-outline"
                                    onClick={handleCancel}
                                    disabled={!uploading && !processing}
                                    className="px-3 py-1 text-sm">
                                    Annuler
                                </Button>
                                : null
                            }

                        </>
                    )}

                </DialogFooter>

            </DialogContent>
        </Dialog >
    );
}

function ProcessingProgress({ id, onDone }: { id: string | null, onDone?: () => void }) {
    const [processed, setProcessed] = useState<number | null>(null);
    const [total, setTotal] = useState<number | null>(null);
    const [errors, setErrors] = useState<number | null>(null);
    const [current, setCurrent] = useState<{ line?: number | null, sku?: string | null, name?: string | null } | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [reportUrl, setReportUrl] = useState<string | null>(null);

    // console.log(processed, total);
    // léger polling local pour enrichir l'affichage
    const pollRef = useRef<number | null>(null);
    const stop = () => { if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; } };
    useEffect(() => {
        if (!id) return;
        stop();
        pollRef.current = window.setInterval(async () => {
            try {
                const res = await fetch(`/products/import/progress/${id}`, { headers: { 'Accept': 'application/json' } });
                if (!res.ok) return;
                const json = await res.json();
                if (typeof json.processed === 'number') setProcessed(json.processed);
                if (typeof json.total === 'number') setTotal(json.total);
                if (typeof json.errors === 'number') setErrors(json.errors);
                if (json.current) setCurrent(json.current);
                if (typeof json.status === 'string') setStatus(json.status);
                if (typeof json.report === 'string') setReportUrl(json.report);
                if (json.status === 'done' || (typeof json.progress === 'number' && json.progress >= 100)) {
                    setStatus('done');
                    stop();
                    try { onDone && onDone(); } catch { }
                }
            } catch (_) { }
        }, 600);
        return stop;
    }, [id]);

    return (
        <div className="space-y-2">
            <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Traitement</span>
                    {processed != null && total != null ? (
                        <span>{total ? Math.floor((processed / total) * 100) : 0}%</span>
                    ) : null}
                </div>
                <div className="h-2 w-full rounded bg-muted">
                    {processed != null && total != null ? (
                        <div className="h-2 rounded bg-primary"
                            style={{ width: `${total ? Math.floor((processed / total) * 100) : 0}%` }} />
                    ) : null}
                </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
                {processed != null && total != null && status !== 'done' ? (
                    <div>Ligne {processed} / {total}
                        {/* {current?.sku ? ` — SKU: ${current.sku}` : ''}{current?.name ? ` — ${current.name}` : ''}*/}
                    </div>
                ) : null}
                {errors ? <div className="text-destructive">Erreurs: {errors}</div> : null}
                {(status === 'done') && (
                    <div className="pt-1 flex items-center justify-between">
                        <div>
                            Mise à jour terminée — {processed ?? 0} lignes traitées{errors ? `, ${errors} erreurs` : ''}.
                        </div>
                        {errors && id ? (
                            <a
                                href={reportUrl ?? `/products/import/report/${id}`}
                                className="underline hover:no-underline"
                                target="_blank"
                                rel="noreferrer"
                            >
                                Télécharger le rapport d'erreurs
                            </a>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

export default UploadCsvButton;

