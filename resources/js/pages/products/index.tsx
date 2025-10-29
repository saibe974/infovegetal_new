import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Form, Link, InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, UploadIcon, DownloadIcon, EditIcon, TrashIcon } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
// import { useForm } from '@inertiajs/react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandLoading,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import SearchSoham from '@/components/ui/searchSoham';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Products',
        href: products.index().url,
    },
];

type Props = {
    collection: PaginatedCollection<Product>;
    q: string | null;
};

export default withAppLayout(breadcrumbs, ({ collection, q }: Props) => {
    // console.log(collection)
    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const handleSearch = (s: string) => {
        setSearch(s);
        // @ts-ignore
        clearTimeout(timerRef.current);
        router.cancelAll();
        if (s.length < 2) {
            return;
        }
        setFetching(true);
        timerRef.current = setTimeout(() => {
            router.reload({
                only: ['searchPropositions'],
                data: { q: s },
                onSuccess: () => setFetching(false),
                // preserveState: true,
            })
        }, 300)
    }

    // @ts-ignore
    const onSelect = (mysearch: string, options?: { force?: boolean }) => {
        const trimmed = (mysearch ?? '').trim();
        // If explicit clear requested, remove q from URL instead of setting q=""
        if (options?.force && trimmed.length === 0) {
            const url = new URL(window.location.href);
            url.searchParams.delete('q');
            router.visit(url.toString(), { replace: true });
            setSearch('');
            return;
        }

        // Otherwise ignore empty submissions
        if (trimmed.length === 0) {
            return;
        }

        setSearch('');
        router.reload({
            data: { q: trimmed },
        })

        console.log("selected:", trimmed);
    };

    // console.log(productsSearch);

    return (
        <div>
            {/* @ts-ignore */}
            <BasicSticky stickyClassName='z-50 bg-background' className="relative z-100">
                <div className="flex items-center py-2 relative w-full">

                    <div className="w-200 left-0 top-1 z-100 mr-2" >
                        <SearchSoham
                            value={search}
                            onChange={handleSearch}
                            onSubmit={onSelect}
                            propositions={searchPropositions}
                            loading={fetching}
                            count={collection.meta.total}
                            query={q ?? ''}
                        />
                    </div>


                    <div className="ml-auto flex items-center gap-2">
                        <UploadCsvButton />
                        <DownloadCsvButton />
                    </div>
                </div>
            </BasicSticky>

            <InfiniteScroll data="collection">
                <Table >
                    <TableHeader>
                        <TableRow>
                            <SortableTableHead field="id">ID</SortableTableHead>
                            <TableHead></TableHead>
                            <SortableTableHead field="name">Name</SortableTableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead className='text-end'>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {collection.data.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.id}</TableCell>
                                <TableCell>
                                    {item.img_link &&
                                        <img src={item.img_link} className="w-20 object-cover" />
                                    }
                                </TableCell>
                                <TableCell>
                                    <Link href={products.edit(item.id)} className="hover:underline">
                                        {item.name}
                                    </Link>
                                </TableCell>

                                <TableCell>{item.category ? item.category.name : ''}</TableCell>
                                <TableCell>{item.description}</TableCell>
                                <TableCell>{item.price}</TableCell>
                                <TableCell>
                                    <div className="flex gap-2 justify-end">
                                        <Button asChild size="icon" variant="outline">
                                            <Link href={products.edit(item.id)}>
                                                <EditIcon size={16} />
                                            </Link>
                                        </Button>
                                        <Button asChild size="icon" variant="destructive-outline">
                                            <Link href={products.destroy(item.id)}
                                                onBefore={() => confirm('Are you sure?')}>
                                                <TrashIcon size={16} />
                                            </Link>
                                        </Button>
                                    </div>

                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>

                </Table>
            </InfiniteScroll>
        </div>

    )
})

function DownloadCsvButton() {
    return (
        <a href="/products/export" className="inline-flex items-center border px-3 py-1 rounded text-sm hover:bg-gray-100">
            <UploadIcon />
        </a>
    );
}



function UploadCsvButton() {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [uploadPct, setUploadPct] = useState<number>(0);
    const [processPct, setProcessPct] = useState<number>(0);
    const [importId, setImportId] = useState<string | null>(null);
    const pollRef = useRef<number | null>(null);
    const xhrRef = useRef<XMLHttpRequest | null>(null);

    const clearPoll = () => {
        if (pollRef.current) {
            window.clearInterval(pollRef.current);
            pollRef.current = null;
        }
    };

    const startPolling = (id: string) => {
        clearPoll();
        pollRef.current = window.setInterval(async () => {
            try {
                const res = await fetch(`/products/import/progress/${id}`, { headers: { 'Accept': 'application/json' } });
                // console.log("Polling import progress for ID:", id, res);
                if (!res.ok) return;
                const json = await res.json();
                // Calcule localement le pourcentage à partir de processed/total quand disponible
                let pct = 0;
                if (typeof json.processed === 'number' && typeof json.total === 'number' && json.total > 0) {
                    pct = Math.floor((json.processed / json.total) * 100);
                } else if (typeof json.progress === 'number') {
                    pct = json.progress;
                }
                if (pct > 100) pct = 100;
                setProcessPct(pct);
                // On peut afficher la ligne/sku/name courants
                // @ts-ignore
                if (json.current) {
                    // pas de setState dédié, mais on affichera via json récupéré si besoin
                }
                if (json.status === 'done' || pct >= 100) {
                    clearPoll();
                    setProcessing(false);
                }
                if (json.status === 'error') {
                    clearPoll();
                    setProcessing(false);
                }
            } catch (_) {
                // ignore transient polling errors
            }
        }, 500);
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
            clearPoll();
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
        setProcessPct(0);
        setFile(null);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button type="button" className="inline-flex items-center border px-3 py-1 rounded text-sm hover:bg-gray-100" disabled={uploading}>
                    {uploading ? <Loader2 className="animate-spin mr-2" size={16} /> : <DownloadIcon />}
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Import CSV</DialogTitle>
                    <DialogDescription>
                        Importez un fichier CSV pour créer/mettre à jour vos produits. Le fichier doit contenir une ligne d’en-tête avec au minimum: <code className="font-mono">sku</code>, <code className="font-mono">name</code>.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                        Colonnes supportées:
                        <ul className="list-disc ml-5 mt-1">
                            <li><b>sku</b> (requis) — identifiant unique du produit</li>
                            <li><b>name</b> (requis) — nom du produit</li>
                            <li><b>description</b> (optionnel)</li>
                            <li><b>price</b> (optionnel, nombre)</li>
                            <li><b>active</b> (optionnel, 0/1)</li>
                        </ul>
                    </div>

                    <div className="rounded-md border p-3 bg-muted/30">
                        <div className="text-xs text-muted-foreground">Exemple d’en-tête</div>
                        <pre className="mt-1 overflow-x-auto text-sm"><code>sku;name;description;price;active</code></pre>
                    </div>

                    <div className="flex items-center gap-3">
                        <input
                            id="csv-file-input"
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        />
                        {file && (
                            <span className="text-sm text-muted-foreground truncate max-w-[240px]" title={file.name}>{file.name}</span>
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
                    {processing && (
                        <ProcessingProgress
                            id={importId}
                            percent={processPct}
                            onDone={() => {
                                setProcessing(false);
                            }}
                        />
                    )}
                </div>

                <DialogFooter>
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="inline-flex items-center border px-3 py-1 rounded text-sm"
                        disabled={uploading || processing ? false : false}>
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={handleImport}
                        className="inline-flex items-center border px-3 py-1 rounded text-sm bg-primary text-primary-foreground disabled:opacity-50"
                        disabled={!file || uploading || processing}
                    >
                        {(uploading || processing) ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                        Importer
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ProcessingProgress({ id, percent, onDone }: { id: string | null, percent: number, onDone?: () => void }) {
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
                {processed != null && total != null ? (
                    <div>Ligne {processed} / {total}{current?.sku ? ` — SKU: ${current.sku}` : ''}{current?.name ? ` — ${current.name}` : ''}</div>
                ) : null}
                {errors ? <div className="text-destructive">Erreurs: {errors}</div> : null}
                {(status === 'done') && (
                    <div className="pt-1 flex items-center justify-between">
                        <div>
                            Terminé — {processed ?? 0} lignes traitées{errors ? `, ${errors} erreurs` : ''}
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

