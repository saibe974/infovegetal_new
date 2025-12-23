import React, { useState, useEffect } from 'react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

type ImportProgressPayload = {
    status?: string;
    processed?: number;
    total?: number;
    errors?: number;
    progress?: number;
    report?: string | null;
};

type DbProduct = {
    id: number;
    name: string;
    description: string | null;
};

type Props = {
    importStatus: 'idle' | 'processing' | 'cancelling' | 'finished' | 'cancelled' | 'error';
    importError: string | null;
    progressInfo: ImportProgressPayload | null;
    displayProgress: number;
    handleRetryImport: () => void;
    uploadId: string | null;
    onStartImport?: (settings: { dbProductsId: number }) => void;
    dbProductsId?: number;
};

export function ProductsImportTreatment({
    importStatus,
    importError,
    progressInfo,
    displayProgress,
    handleRetryImport,
    uploadId,
    onStartImport,
    dbProductsId,
}: Props) {
    const [dbProducts, setDbProducts] = useState<DbProduct[]>([]);
    const [selectedDbProductId, setSelectedDbProductId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);


    // Si dbProductsId est fourni, lancer directement le traitement
    useEffect(() => {
        if (dbProductsId && importStatus === 'idle' && onStartImport) {
            onStartImport({ dbProductsId });
        }
    }, [dbProductsId, importStatus, onStartImport]);

    useEffect(() => {
        // Charger la liste des bases produits disponibles
        fetch('/api/db-products')
            .then((res) => res.json())
            .then((data) => {
                setDbProducts(data);
                if (data.length > 0) {
                    setSelectedDbProductId(data[0].id);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error('Failed to load db_products:', err);
                setLoading(false);
            });
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedDbProductId && onStartImport) {
            onStartImport({ dbProductsId: selectedDbProductId });
        }
    };

    return (
        <>
            {importStatus === 'idle' && (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium">
                            Source des produits
                        </label>
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Chargement...</p>
                        ) : dbProducts.length === 0 ? (
                            <p className="text-sm text-destructive">
                                Aucune base de produits disponible
                            </p>
                        ) : (
                            <Select
                                value={selectedDbProductId?.toString() ?? ''}
                                onValueChange={(val) =>
                                    setSelectedDbProductId(val ? Number(val) : null)
                                }
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Choisir une base produits" />
                                </SelectTrigger>
                                <SelectContent>
                                    {dbProducts.map((dbp) => (
                                        <SelectItem key={dbp.id} value={dbp.id.toString()}>
                                            {dbp.name}
                                            {dbp.description ? ` - ${dbp.description}` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center border px-4 py-2 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={loading || !selectedDbProductId}
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
                            style={{ width: `${Math.min(displayProgress, 100)}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {progressInfo?.errors ?? 0} erreurs
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
                        {progressInfo?.processed ?? 0} lignes traitées
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

export default ProductsImportTreatment;
