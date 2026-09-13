import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { Head, Link, router } from '@inertiajs/react';

type OrderFile = {
    id: number;
    name: string;
    size: number;
    date: string;
    order_id: number;
    download_url: string;
    preview_url: string | null;
};

export default function Files({ files, years, filters }: {
    files: { data: OrderFile[]; prev_page_url: string | null; next_page_url: string | null; current_page: number; last_page: number };
    years: string[];
    filters: { year?: string; month?: string };
}) {
    const filter = (key: 'year' | 'month', value: string) => {
        router.get('/settings/files', { ...filters, [key]: value || undefined }, { preserveState: true, preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Mes fichiers', href: '/settings/files' }]}>
            <Head title="Mes fichiers" />
            <SettingsLayout>
                <section className="mt-6 space-y-4 rounded-xl border p-4">
                    <h2 className="text-xl font-semibold">Mes fichiers de commandes</h2>
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2">Année
                            <select className="rounded-md border bg-background p-2" value={filters.year ?? ''} onChange={(event) => filter('year', event.target.value)}>
                                <option value="">Toutes</option>
                                {years.map((year) => <option key={year} value={year}>{year}</option>)}
                            </select>
                        </label>
                        <label className="flex items-center gap-2">Mois
                            <select className="rounded-md border bg-background p-2" value={filters.month ?? ''} onChange={(event) => filter('month', event.target.value)}>
                                <option value="">Tous</option>
                                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{String(month).padStart(2, '0')}</option>)}
                            </select>
                        </label>
                    </div>
                    {files.data.length === 0 ? <p className="py-6 text-muted-foreground">Aucun fichier pour cette période.</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead><tr className="border-b"><th className="p-3">Date</th><th className="p-3">Commande</th><th className="p-3">Fichier</th><th className="p-3">Actions</th></tr></thead>
                                <tbody>{files.data.map((file) => (
                                    <tr className="border-b" key={file.id}>
                                        <td className="whitespace-nowrap p-3">{file.date.split('-').reverse().join('/')}</td>
                                        <td className="p-3">{String(file.order_id).padStart(5, '0')}</td>
                                        <td className="p-3"><span className="break-all">{file.name}</span><span className="block text-xs text-muted-foreground">{Math.max(1, Math.ceil(file.size / 1024))} Ko</span></td>
                                        <td className="p-3"><div className="flex gap-4">
                                            {file.preview_url && <a className="underline" href={file.preview_url} target="_blank" rel="noreferrer" aria-label={`Aperçu de ${file.name}`}>Aperçu</a>}
                                            <a className="underline" href={file.download_url} aria-label={`Télécharger ${file.name}`}>Télécharger</a>
                                        </div></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                    )}
                    <nav className="flex items-center gap-4" aria-label="Pagination des fichiers">
                        {files.prev_page_url && <Link className="underline" href={files.prev_page_url}>Précédent</Link>}
                        <span>Page {files.current_page} / {files.last_page}</span>
                        {files.next_page_url && <Link className="underline" href={files.next_page_url}>Suivant</Link>}
                    </nav>
                </section>
            </SettingsLayout>
        </AppLayout>
    );
}
