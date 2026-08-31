import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';

export type ProductExportOptions = {
    columns: { key: string; label: string }[];
    defaults: string[];
    limits: { csv: number; xlsx: number; xlsx_images: number };
};

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    total: number;
    options: ProductExportOptions;
    catalogUrl: string;
    exportUrl: string;
};

export function ProductsExportDialog({ open, onOpenChange, total, options, catalogUrl, exportUrl }: Props) {
    const { t, locale } = useI18n();
    const [format, setFormat] = useState<'csv' | 'xlsx'>('csv');
    const [columns, setColumns] = useState(options.defaults);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [started, setStarted] = useState(false);
    const withImages = columns.includes('image');
    const limit = format === 'csv' ? options.limits.csv : withImages ? options.limits.xlsx_images : options.limits.xlsx;
    const number = (value: number) => value.toLocaleString(locale);
    const tooLarge = total > limit;

    const download = async () => {
        if (busy || columns.length === 0 || total === 0 || tooLarge) return;
        setBusy(true);
        setError(null);
        setStarted(false);

        // Copy the applied URL, including array filters, cart and sort. Pagination
        // and Inertia's infinite-scroll page are deliberately not part of exports.
        const applied = new URL(catalogUrl, window.location.origin);
        const url = new URL(exportUrl, window.location.origin);
        const filterKeys = new Set(['q', 'active', 'category', 'country', 'pot', 'height', 'image', 'promo', 'cart', 'sort', 'dir']);
        applied.searchParams.forEach((value, key) => {
            if (filterKeys.has(key.split('[')[0])) url.searchParams.append(key, value);
        });
        url.searchParams.set('format', format);
        columns.forEach((column) => url.searchParams.append('columns[]', column));

        const readError = async (response: Response) => {
            const payload = await response.json().catch(() => null) as {
                errors?: Record<string, string[]>;
                message?: string;
            } | null;
            return Object.values(payload?.errors ?? {}).flat()[0]
                ?? payload?.message
                ?? t('Impossible de préparer l’export. Réessayez ou réduisez la sélection.');
        };

        try {
            const checkUrl = new URL(url);
            checkUrl.searchParams.set('check', '1');
            const check = await fetch(checkUrl, { headers: { Accept: 'application/json' } });
            if (!check.ok) throw new Error(await readError(check));
            if (!check.headers.get('Content-Type')?.includes('application/json')) {
                throw new Error(t('Votre session a expiré. Rechargez la page avant de relancer l’export.'));
            }

            if (format === 'csv') {
                // Let the browser download the stream directly: no giant JS Blob.
                window.location.assign(url.toString());
            } else {
                const response = await fetch(url, { headers: { Accept: 'application/json' } });
                if (!response.ok) throw new Error(await readError(response));
                if (!response.headers.get('Content-Type')?.includes('spreadsheetml.sheet')) {
                    throw new Error(t('Impossible de préparer l’export. Réessayez ou réduisez la sélection.'));
                }
                const blobUrl = URL.createObjectURL(await response.blob());
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `products_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
            }
            setStarted(true);
        } catch (exception) {
            setError(exception instanceof Error ? exception.message : t('Impossible de préparer l’export. Réessayez ou réduisez la sélection.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => {
            if (busy) return;
            setError(null);
            setStarted(false);
            onOpenChange(next);
        }}>
            <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!busy}>
                <DialogHeader>
                    <DialogTitle>{t('Exporter les produits')}</DialogTitle>
                    <DialogDescription>
                        {number(total)} {t('produits correspondant aux filtres actuels, toutes pages confondues.')}
                    </DialogDescription>
                </DialogHeader>

                <fieldset disabled={busy} className="space-y-3">
                    <legend className="mb-2 text-sm font-medium">{t('Format du fichier')}</legend>
                    <div className="grid grid-cols-3 gap-3">
                        {(['csv', 'xlsx'] as const).map((value) => (
                            <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${format === value ? 'border-primary bg-primary/5' : ''}`}>
                                <input type="radio" name="product-export-format" value={value} checked={format === value} onChange={() => {
                                    setFormat(value);
                                    setError(null);
                                    setStarted(false);
                                }} />
                                {value === 'csv' ? 'CSV' : 'Excel (.xlsx)'}
                            </label>
                        ))}
                        <label className="flex items-center gap-2 rounded-lg border p-3 text-sm opacity-50">
                            <input type="radio" name="product-export-format" disabled />
                            <span>PDF <span className="block text-xs">{t('À venir')}</span></span>
                        </label>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {format === 'csv'
                            ? t('CSV : adapté aux gros volumes. Les images sont exportées sous forme d’URL.')
                            : t('Excel : seules les miniatures déjà créées et disponibles sont intégrées. Sinon, la cellule reste vide. Aucune image n’est générée.')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {t('Limite pour cet export :')} {number(limit)} {t('produits')}.
                    </p>
                </fieldset>

                <fieldset disabled={busy} className="space-y-3">
                    <legend className="mb-2 text-sm font-medium">{t('Données à exporter')}</legend>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setColumns(options.columns.map(({ key }) => key))}>
                            {t('Tout sélectionner')}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setColumns([])}>
                            {t('Tout désélectionner')}
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                        {options.columns.map(({ key, label }) => (
                            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox checked={columns.includes(key)} disabled={busy} onCheckedChange={(checked) => {
                                    setColumns((current) => options.columns
                                        .map((column) => column.key)
                                        .filter((column) => column === key ? checked === true : current.includes(column)));
                                    setError(null);
                                    setStarted(false);
                                }} />
                                {t(label)}
                            </label>
                        ))}
                    </div>
                </fieldset>

                {tooLarge && (
                    <p role="alert" className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                        {t('La sélection dépasse la limite de ce format. Affinez les filtres, retirez les images ou choisissez le CSV.')}
                    </p>
                )}
                {total === 0 && <p role="status" className="text-sm text-muted-foreground">{t('Aucun produit à exporter.')}</p>}
                {columns.length === 0 && <p role="status" className="text-sm text-muted-foreground">{t('Sélectionnez au moins une colonne.')}</p>}
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                {started && <p role="status" className="text-sm text-muted-foreground">{t('Téléchargement lancé. Pour un gros CSV, gardez cette page ouverte pendant sa préparation.')}</p>}

                <DialogFooter>
                    <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>{t('Fermer')}</Button>
                    <Button type="button" disabled={busy || tooLarge || total === 0 || columns.length === 0} onClick={download}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                        {t(busy ? 'Préparation…' : 'Exporter')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
