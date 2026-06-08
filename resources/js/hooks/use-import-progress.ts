import { useCallback, useEffect, useRef, useState } from 'react';

export type ImportProgressPayload = {
    status?: string;
    processed?: number;
    total?: number;
    errors?: number;
    progress?: number;
    report?: string | null;
};

export type ImportStatus = 'idle' | 'processing' | 'cancelling' | 'finished' | 'cancelled' | 'error';

export function useImportProgress(
    importStatus: ImportStatus,
    progressInfo: ImportProgressPayload | null,
    fileSize?: number | null
) {
    const [visualProgress, setVisualProgress] = useState(0);
    const [speedPctPerSec, setSpeedPctPerSec] = useState(2.5);
    const hasSeenBackendProgressRef = useRef(false);
    const lastBackendProgressRef = useRef(0);
    const lastBackendTimestampRef = useRef(0);
    const lastTickTimestampRef = useRef(0);

    const computeBackendProgress = () => {
        const fromInfo = Number.isFinite(progressInfo?.progress as number)
            ? (progressInfo?.progress as number)
            : null;
        if (typeof fromInfo === 'number') return Math.max(0, Math.min(100, fromInfo));
        const processed = typeof progressInfo?.processed === 'number' ? progressInfo.processed : 0;
        const errors = typeof progressInfo?.errors === 'number' ? progressInfo.errors : 0;
        const total = typeof progressInfo?.total === 'number' ? progressInfo.total : 0;
        if (total > 0) return Math.max(0, Math.min(100, ((processed + errors) / total) * 100));
        return 0;
    };

    const computeInitialSpeedPerSec = useCallback(() => {
        const bytes = typeof fileSize === 'number' && fileSize > 0 ? fileSize : null;
        if (bytes !== null) {
            const mb = bytes / (1024 * 1024);
            if (mb <= 0.5) return 5.0; // < 500 KB : très rapide
            if (mb <= 2) return 4.0; // < 2 MB
            if (mb <= 10) return 3.0; // < 10 MB
            if (mb <= 30) return 2.0; // < 30 MB
            if (mb <= 100) return 1.2; // < 100 MB
            return 0.8; // fichiers volumineux
        }

        const total = typeof progressInfo?.total === 'number' ? progressInfo.total : 0;
        if (total <= 0) return 2.8;
        if (total <= 1000) return 4.2;
        if (total <= 5000) return 3.1;
        if (total <= 15000) return 2.2;
        return 1.5;
    }, [fileSize, progressInfo?.total]);

    const hasBackendProgressSignal = () => {
        const p = progressInfo?.progress;
        if (typeof p === 'number' && p > 0) return true;
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

        if (importStatus !== 'processing' && importStatus !== 'cancelling') return;

        const interval = window.setInterval(() => {
            const now = performance.now();
            if (lastTickTimestampRef.current === 0) lastTickTimestampRef.current = now;
            const deltaSec = Math.max(0.05, (now - lastTickTimestampRef.current) / 1000);
            lastTickTimestampRef.current = now;

            setVisualProgress((current) => {
                if (!hasSeenBackendProgressRef.current && (!hasBackendProgress || backendProgress <= 0)) {
                    return current + speedPctPerSec * deltaSec;
                }
                hasSeenBackendProgressRef.current = true;
                const target = backendProgress;
                const next = current + speedPctPerSec * deltaSec;
                if (next > target) return current - (current - target) * 0.2;
                return next;
            });
        }, 120);

        return () => window.clearInterval(interval);
    }, [importStatus, progressInfo?.total, backendProgress, hasBackendProgress, speedPctPerSec, computeInitialSpeedPerSec]);

    useEffect(() => {
        if (importStatus !== 'processing' && importStatus !== 'cancelling') return;
        if (!hasBackendProgress || backendProgress <= 0) return;

        const now = performance.now();

        if (!hasSeenBackendProgressRef.current) {
            hasSeenBackendProgressRef.current = true;
            lastBackendProgressRef.current = backendProgress;
            lastBackendTimestampRef.current = now;
            return;
        }

        const previousProgress = lastBackendProgressRef.current;
        const previousTime = lastBackendTimestampRef.current;

        if (backendProgress <= previousProgress || previousTime <= 0) return;

        const deltaProgress = backendProgress - previousProgress;
        const deltaSec = Math.max(0.1, (now - previousTime) / 1000);
        const instantSpeed = deltaProgress / deltaSec;

        setSpeedPctPerSec((prev) => {
            const blended = prev * 0.65 + instantSpeed * 0.35;
            return Math.min(8, Math.max(0.25, blended));
        });

        lastBackendProgressRef.current = backendProgress;
        lastBackendTimestampRef.current = now;
    }, [importStatus, backendProgress, hasBackendProgress]);

    return visualProgress;
}

export default useImportProgress;
