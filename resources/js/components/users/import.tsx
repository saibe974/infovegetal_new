import React, { useEffect, useRef, useState } from 'react';
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
    const [visualProgress, setVisualProgress] = useState(0);
    const [speedPctPerSec, setSpeedPctPerSec] = useState(2.5);
    const hasSeenBackendProgressRef = useRef(false);
    const lastBackendProgressRef = useRef(0);
    const lastBackendTimestampRef = useRef(0);
    const lastTickTimestampRef = useRef(0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onStartImport) {
            onStartImport({ strategy });
        }
    };

    const computeBackendProgress = () => {
        const fromInfo = Number.isFinite(progressInfo?.progress as number)
            ? (progressInfo?.progress as number)
            : null;

        if (typeof fromInfo === 'number') {
            return Math.max(0, Math.min(100, fromInfo));
        }

        const processed = typeof progressInfo?.processed === 'number' ? progressInfo.processed : 0;
        const errors = typeof progressInfo?.errors === 'number' ? progressInfo.errors : 0;
        const total = typeof progressInfo?.total === 'number' ? progressInfo.total : 0;

        if (total > 0) {
            return Math.max(0, Math.min(100, ((processed + errors) / total) * 100));
        }

        return 0;
    };

    const computeInitialSpeedPerSec = () => {
        const total = typeof progressInfo?.total === 'number' ? progressInfo.total : 0;

        // Vitesse en % par seconde (phase arbitraire initiale).
        if (total <= 0) return 2.8;
        if (total <= 1000) return 4.2;
        if (total <= 5000) return 3.1;
        if (total <= 15000) return 2.2;
        return 1.5;
    };

    const hasBackendProgressSignal = () => {
        const p = progressInfo?.progress;
        if (typeof p === 'number' && p > 0) {
            return true;
        }

        const processed = typeof progressInfo?.processed === 'number' ? progressInfo.processed : 0;
        const errors = typeof progressInfo?.errors === 'number' ? progressInfo.errors : 0;
        const total = typeof progressInfo?.total === 'number' ? progressInfo.total : 0;

        return total > 0 && (processed + errors) > 0;
    };

    const backendProgress = computeBackendProgress();
    const hasBackendProgress = hasBackendProgressSignal();

    useEffect(() => {
        if (importStatus === 'idle') {
            setVisualProgress(0);
            setSpeedPctPerSec(computeInitialSpeedPerSec());
            hasSeenBackendProgressRef.current = false;
            lastBackendProgressRef.current = 0;
            lastBackendTimestampRef.current = 0;
            lastTickTimestampRef.current = 0;
            return;
        }

        if (importStatus === 'finished') {
            setVisualProgress(100);
            return;
        }

        if (importStatus !== 'processing' && importStatus !== 'cancelling') {
            return;
        }

        const interval = window.setInterval(() => {
            const now = performance.now();
            if (lastTickTimestampRef.current === 0) {
                lastTickTimestampRef.current = now;
            }

            const deltaSec = Math.max(0.05, (now - lastTickTimestampRef.current) / 1000);
            lastTickTimestampRef.current = now;

            setVisualProgress((current) => {
                // Phase 1: pas encore de vraie progression backend, avance arbitraire.
                if (!hasSeenBackendProgressRef.current && (!hasBackendProgress || backendProgress <= 0)) {
                    return current + speedPctPerSec * deltaSec;
                }

                // A partir du premier vrai signal backend, on bascule en suivi backend.
                hasSeenBackendProgressRef.current = true;

                // Cible = progression backend reelle (retour arriere leger autorise).
                const target = backendProgress;
                const next = current + speedPctPerSec * deltaSec;

                if (next > target) {
                    // Recalage doux vers la cible backend.
                    return current - (current - target) * 0.2;
                }

                return next;
            });
        }, 120);

        return () => window.clearInterval(interval);
    }, [importStatus, progressInfo?.total, backendProgress, hasBackendProgress, speedPctPerSec]);

    useEffect(() => {
        if (importStatus !== 'processing' && importStatus !== 'cancelling') {
            return;
        }

        // Recalibrage de la vitesse uniquement quand progressInfo fournit un nouveau palier.
        if (!hasBackendProgress || backendProgress <= 0) {
            return;
        }

        const now = performance.now();

        if (!hasSeenBackendProgressRef.current) {
            hasSeenBackendProgressRef.current = true;
            lastBackendProgressRef.current = backendProgress;
            lastBackendTimestampRef.current = now;
            return;
        }

        const previousProgress = lastBackendProgressRef.current;
        const previousTime = lastBackendTimestampRef.current;

        if (backendProgress <= previousProgress || previousTime <= 0) {
            return;
        }

        const deltaProgress = backendProgress - previousProgress;
        const deltaSec = Math.max(0.1, (now - previousTime) / 1000);
        const instantSpeed = deltaProgress / deltaSec; // %/sec

        setSpeedPctPerSec((prev) => {
            // Moyenne glissante: stabilise la vitesse sans yoyo.
            const blended = prev * 0.65 + instantSpeed * 0.35;
            return Math.min(8, Math.max(0.25, blended));
        });

        lastBackendProgressRef.current = backendProgress;
        lastBackendTimestampRef.current = now;
    }, [importStatus, backendProgress, hasBackendProgress]);

    // console.log(progressInfo?.progress, visualProgress);

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
                            style={{ width: `${Math.max(0, Math.min(100, visualProgress))}%` }}
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
