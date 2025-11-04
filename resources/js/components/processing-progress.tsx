import { useState, useRef, useEffect } from 'react';

type ProcessingProgressProps = {
    id: string | null;
    progressUrl: string;
    reportUrl: string;
    percent: number;
    onDone?: () => void;
};

export function ProcessingProgress({ id, progressUrl, reportUrl, percent, onDone }: ProcessingProgressProps) {
    const [processed, setProcessed] = useState<number | null>(null);
    const [total, setTotal] = useState<number | null>(null);
    const [errors, setErrors] = useState<number | null>(null);
    const [current, setCurrent] = useState<{ line?: number | null, sku?: string | null, name?: string | null } | null>(null);
    const [status, setStatus] = useState<string | null>(null);
    const [reportUrlState, setReportUrlState] = useState<string | null>(null);

    const pollRef = useRef<number | null>(null);
    const stop = () => {
        if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    useEffect(() => {
        if (!id) return;
        stop();
        pollRef.current = window.setInterval(async () => {
            try {
                const res = await fetch(progressUrl, { headers: { 'Accept': 'application/json' } });
                if (!res.ok) return;
                const json = await res.json();
                if (typeof json.processed === 'number') setProcessed(json.processed);
                if (typeof json.total === 'number') setTotal(json.total);
                if (typeof json.errors === 'number') setErrors(json.errors);
                if (json.current) setCurrent(json.current);
                if (typeof json.status === 'string') setStatus(json.status);
                if (typeof json.report === 'string') setReportUrlState(json.report);
                if (json.status === 'done' || (typeof json.progress === 'number' && json.progress >= 100)) {
                    setStatus('done');
                    stop();
                    try { onDone && onDone(); } catch { }
                }
            } catch (_) { }
        }, 600);
        return stop;
    }, [id, progressUrl, onDone]);

    return (
        <div className="space-y-2">
            <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Traitement</span>
                    {processed != null && total != null ? (
                        <span>{total ? Math.floor((processed / total) * 100) : percent}%</span>
                    ) : null}
                </div>
                <div className="h-2 w-full rounded bg-muted">
                    {processed != null && total != null ? (
                        <div className="h-2 rounded bg-primary"
                            style={{ width: `${total ? Math.floor((processed / total) * 100) : percent}%` }} />
                    ) : null}
                </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
                {processed != null && total != null && status !== 'done' ? (
                    <div>Ligne {processed} / {total}{current?.sku ? ` — SKU: ${current.sku}` : ''}{current?.name ? ` — ${current.name}` : ''}</div>
                ) : null}
                {errors ? <div className="text-destructive">Erreurs: {errors}</div> : null}
                {(status === 'done') && (
                    <div className="pt-1 flex items-center justify-between">
                        <div>
                            Mise à jour terminée — {processed ?? 0} lignes traitées{errors ? `, ${errors} erreurs` : ''}.
                        </div>
                        {errors && id ? (
                            <a
                                href={reportUrlState ?? reportUrl}
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
