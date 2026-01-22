import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type ImportProgressPayload = {
    status?: string;
    processed?: number;
    total?: number;
    errors?: number;
    progress?: number;
    report?: string | null;
};

type Props = {
    importStatus: 'idle' | 'processing' | 'cancelling' | 'finished' | 'cancelled' | 'error';
    importError: string | null;
    progressInfo: ImportProgressPayload | null;
    displayProgress: number;
    handleRetryImport: () => void;
    uploadId: string | null;
    onStartImport?: (settings?: { strategy?: string }) => void;
};

export function UsersImportTreatment({
    importStatus,
    importError,
    progressInfo,
    displayProgress,
    handleRetryImport,
    uploadId,
    onStartImport,
}: Props) {
    const [strategy, setStrategy] = useState<'basique' | 'old_DB'>('basique');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onStartImport) {
            onStartImport({ strategy });
        }
    };
    const effectiveProgress = (() => {
        const fromProp = Number.isFinite(displayProgress) ? displayProgress : 0;
        const fromInfo = Number.isFinite(progressInfo?.progress as number) ? (progressInfo?.progress as number) : 0;
        // Si la prop est 0 mais l'API remonte une progression, on l'utilise en repli
        const base = fromProp > 0 ? fromProp : fromInfo;
        // Si status fini/annulé, forcer 100 ou 0 cohérent
        if (importStatus === 'finished') return 100;
        if (importStatus === 'cancelled') return Math.min(base, 100);
        return Math.min(base, 100);
    })();

    // useEffect(() => {
    //     console.log('[UsersImportTreatment] status=', importStatus, 'uploadId=', uploadId);
    // }, [importStatus, uploadId]);

    // useEffect(() => {
    //     console.log('[UsersImportTreatment] progress update:', {
    //         displayProgress,
    //         backendProgress: progressInfo?.progress ?? null,
    //         effectiveProgress,
    //         processed: progressInfo?.processed ?? null,
    //         total: progressInfo?.total ?? null,
    //         errors: progressInfo?.errors ?? null,
    //         status: progressInfo?.status ?? null,
    //     });
    // }, [displayProgress, progressInfo?.progress, progressInfo?.processed, progressInfo?.total, progressInfo?.errors, effectiveProgress]);


    return (
        <>
            {importStatus === 'idle' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        L'import va créer ou mettre à jour les utilisateurs en fonction de leur email.
                    </p>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">Mode d'import</label>
                        <select
                            className="w-full rounded border px-2 py-1 text-sm"
                            value={strategy}
                            onChange={(e) => setStrategy(e.target.value as 'basique' | 'old_DB')}
                        >
                            <option value="basique">basique</option>
                            <option value="old_DB">old_DB</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                            Choisissez "old_DB" pour appliquer le traitement spécial hérité de l’ancienne base.
                        </p>
                    </div>
                    <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center border px-4 py-2 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={!uploadId}
                    >
                        Démarrer l'import
                    </button>
                </form>
            )}

            {(importStatus === 'processing' || importStatus === 'cancelling') && (
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                        {importStatus === 'cancelling' || progressInfo?.status === 'cancelling'
                            ? 'Annulation en cours…'
                            : <>Import en cours <Loader2 className="inline-block ml-2 animate-spin" size={16} /></>}
                    </p>
                    <div className="w-full h-2 rounded bg-muted">
                        <div
                            className="h-2 rounded bg-primary transition-all"
                            style={{ width: `${effectiveProgress}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {progressInfo?.processed ?? 0} traités · {progressInfo?.errors ?? 0} erreurs
                    </p>
                    {importError && (
                        <p className="text-xs text-destructive">{importError}</p>
                    )}
                </div>
            )}

            {importStatus === 'finished' && (
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Import terminé.</p>
                    <p className="text-xs text-muted-foreground">
                        {progressInfo?.processed ?? 0} utilisateurs traités
                        {typeof progressInfo?.errors === 'number'
                            ? ` · ${progressInfo.errors} erreurs`
                            : ''}
                    </p>
                    {progressInfo?.report && (
                        <a href={progressInfo.report} className="text-sm text-primary underline">
                            Télécharger le rapport d'erreurs
                        </a>
                    )}
                </div>
            )}

            {importStatus === 'cancelled' && (
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Import annulé.</p>
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
    );
}

export default UsersImportTreatment;
