import {
    FileEditorSection,
    FileFormatField,
    FilePreview,
} from '@/components/app/file-template/export-controls';
import {
    FileBlocksEditor,
    FileEditorProvider,
    FilenameRuleField,
} from '@/components/app/file-template/file-template-editor';
import {
    renderRulePreview,
    uniqueId,
} from '@/components/app/file-template/rules';
import { TemplateLibrary } from '@/components/app/file-template/template-library';
import type {
    FileBlockType,
    FileEditorContextValue,
    FileTemplate,
} from '@/components/app/file-template/types';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/lib/i18n';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ProductsExportQuickFields } from './products-export-quick-fields';

export type ProductExportOptions = {
    columns: {
        key: string;
        label: string;
        type: 'text' | 'decimal' | 'date' | 'image';
    }[];
    defaults: string[];
    template: FileTemplate;
    limits: {
        csv: number;
        xlsx: number;
        xlsx_cells: number;
        xlsx_images: number;
    };
};
type Props = {
    onBack: () => void;
    total: number;
    options: ProductExportOptions;
    catalogUrl: string;
    exportUrl: string;
};
type Format = 'csv' | 'xlsx';
type ExportView = 'quick' | 'expert';
type Preview = {
    total: number;
    sample_count: number;
    line_count: number;
    image_count: number;
    limit: number;
    too_large: boolean;
    filename: string;
    rows: {
        heading: boolean;
        cells: { value: string; image: string | null }[];
    }[];
    values: Record<string, string | number | null>;
};
const selectClass = 'h-9 rounded-md border bg-background px-3 text-sm';

export function ProductsExportPanel({
    onBack,
    total,
    options,
    catalogUrl,
    exportUrl,
}: Props) {
    const { t, locale } = useI18n();
    const { csrf_token: csrfToken } = usePage<SharedData>().props;
    const [format, setFormat] = useState<Format>('csv');
    const [view, setView] = useState<ExportView>('quick');
    const [quickColumns, setQuickColumns] = useState(options.defaults);
    const [expertInitialized, setExpertInitialized] = useState(false);
    const [expertTemplate, setTemplate] = useState<FileTemplate>(() =>
        structuredClone(options.template),
    );
    const [quickSettings, setQuickSettings] = useState(() => ({
        name: options.template.name,
        filename: options.template.filename,
        delimiter: options.template.delimiter,
    }));
    const quickTemplate = useMemo<FileTemplate>(
        () => ({
            ...options.template,
            ...quickSettings,
            blocks: [
                {
                    id: 'products',
                    name: 'Produits',
                    type: 'items',
                    enabled: true,
                    show_headers: true,
                    columns: quickColumns.map((key) => ({
                        id: key,
                        name:
                            options.columns.find((column) => column.key === key)
                                ?.label ?? key,
                    })),
                    rows: [
                        {
                            id: 'product',
                            cells: Object.fromEntries(
                                quickColumns.map((key) => [
                                    key,
                                    `%product.${key}%`,
                                ]),
                            ),
                        },
                    ],
                },
            ],
        }),
        [options.template, options.columns, quickColumns, quickSettings],
    );
    // Keep both drafts: returning to the quick view never flattens expert rules.
    const template = view === 'quick' ? quickTemplate : expertTemplate;
    const emptyQuickSelection = view === 'quick' && quickColumns.length === 0;
    const changeView = (next: string) => {
        if (busy || (next !== 'quick' && next !== 'expert')) return;
        if (next === 'expert' && !expertInitialized) {
            setTemplate(structuredClone(quickTemplate));
            setExpertInitialized(true);
        }
        setView(next);
    };
    const [openSection, setOpenSection] = useState<
        'settings' | 'content' | null
    >('content');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewKey, setPreviewKey] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const previewController = useRef<AbortController | null>(null);
    useEffect(() => () => previewController.current?.abort(), []);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const downloadFrame = useId();
    const number = (value: number) => value.toLocaleString(locale);
    const requestKey = JSON.stringify([view, template, format, catalogUrl]);
    const previewPending = requestKey !== previewKey;
    const currentPreview = preview;
    const totalRows = template.blocks
        .filter((block) => block.enabled)
        .reduce(
            (count, block) =>
                count +
                block.rows.length * (block.type === 'items' ? total : 1),
            0,
        );
    const imageSlots = template.blocks
        .filter((block) => block.enabled)
        .reduce(
            (count, block) =>
                count +
                block.rows.reduce(
                    (sum, row) =>
                        sum +
                        block.columns.filter(
                            (column) =>
                                row.cells[column.id] === '%product.image%',
                        ).length,
                    0,
                ),
            0,
        );
    const limit =
        format === 'csv'
            ? options.limits.csv
            : Math.min(
                  imageSlots ? options.limits.xlsx_images : options.limits.xlsx,
                  Math.max(
                      0,
                      Math.floor(
                          options.limits.xlsx_cells /
                              Math.max(
                                  1,
                                  ...template.blocks
                                      .filter((block) => block.enabled)
                                      .map((block) => block.columns.length),
                              ),
                      ) -
                          template.blocks.filter(
                              (block) => block.enabled && block.show_headers,
                          ).length,
                  ),
              );
    const tooLarge =
        totalRows > limit ||
        (format === 'xlsx' &&
            imageSlots * total > options.limits.xlsx_images) ||
        (!previewPending && currentPreview?.too_large === true);

    const url = useMemo(() => {
        const origin =
            typeof window === 'undefined'
                ? 'http://localhost'
                : window.location.origin;
        const applied = new URL(catalogUrl, origin);
        const target = new URL(exportUrl, origin);
        const filters = new Set([
            'q',
            'active',
            'category',
            'country',
            'pot',
            'height',
            'image',
            'promo',
            'cart',
            'sort',
            'dir',
        ]);
        applied.searchParams.forEach((value, key) => {
            if (filters.has(key.split('[')[0]))
                target.searchParams.append(key, value);
        });
        return target.toString();
    }, [catalogUrl, exportUrl]);

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true });
        headingRef.current?.scrollIntoView({ block: 'start' });
    }, []);
    const refreshPreview = async () => {
        if (emptyQuickSelection) return;
        previewController.current?.abort();
        const controller = new AbortController();
        previewController.current = controller;
        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const response = await fetch(url, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken ?? '',
                },
                body: JSON.stringify({ template, format, preview: true }),
            });
            if (!response.ok) throw new Error(await responseError(response));
            if (
                !response.headers
                    .get('Content-Type')
                    ?.includes('application/json')
            )
                throw new Error('Votre session a expiré. Rechargez la page.');
            const result = (await response.json()) as Preview;
            if (!controller.signal.aborted) {
                setPreview(result);
                setPreviewKey(requestKey);
            }
        } catch (exception) {
            if (!controller.signal.aborted)
                setPreviewError(
                    exception instanceof Error
                        ? exception.message
                        : 'Aperçu indisponible.',
                );
        } finally {
            if (!controller.signal.aborted) setPreviewLoading(false);
        }
    };
    useEffect(() => {
        setError(null);
        setNotice(null);
    }, [requestKey]);

    const editorContext = useMemo<FileEditorContextValue>(
        () => ({
            blockLabels: {
                header: 'Entête',
                items: 'Liste des produits',
                footer: 'Pied de fichier',
            },
            variablesForBlock: (type: FileBlockType) => [
                '%export.date%',
                '%export.count%',
                ...(type === 'items'
                    ? options.columns.map((column) => `%product.${column.key}%`)
                    : []),
            ],
            variableFormatType: (name: string) => {
                if (name === 'export.date') return 'date';
                if (name === 'export.count') return 'decimal';
                const type = options.columns.find(
                    (column) => `product.${column.key}` === name,
                )?.type;
                return type === 'decimal' || type === 'date' ? type : null;
            },
            previewValue: (rule: string) =>
                renderRulePreview(
                    rule,
                    Object.fromEntries(
                        Object.entries(preview?.values ?? {}).map(
                            ([key, value]) => [key, String(value ?? '')],
                        ),
                    ),
                    true,
                ),
        }),
        [options.columns, preview?.values],
    );

    const addField = (key: string) => {
        const field = options.columns.find((column) => column.key === key);
        const blockId = template.blocks.find(
            (block) => block.type === 'items' && block.columns.length < 40,
        )?.id;
        if (!field || !blockId) return;
        const id = uniqueId('column');
        setTemplate({
            ...template,
            blocks: template.blocks.map((block) =>
                block.id !== blockId
                    ? block
                    : {
                          ...block,
                          columns: [
                              ...block.columns,
                              { id, name: field.label },
                          ],
                          rows: block.rows.map((row, index) => ({
                              ...row,
                              cells: {
                                  ...row.cells,
                                  [id]: index === 0 ? `%product.${key}%` : '',
                              },
                          })),
                      },
            ),
        });
    };

    const download = async () => {
        if (busy || tooLarge || total === 0 || emptyQuickSelection) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const headers = {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': csrfToken ?? '',
            };
            const check = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ template, format, check: true }),
            });
            if (!check.ok) throw new Error(await responseError(check));
            if (
                !check.headers.get('Content-Type')?.includes('application/json')
            )
                throw new Error('Votre session a expiré. Rechargez la page.');
            const checked = (await check.json()) as { filename: string };
            if (format === 'csv') {
                // Native POST download: never accumulate the CSV in a JS Blob.
                const form = document.createElement('form');
                form.method = 'POST';
                form.action = url;
                form.target = downloadFrame;
                form.hidden = true;
                for (const [name, value] of Object.entries({
                    _token: csrfToken ?? '',
                    template: JSON.stringify(template),
                    format,
                })) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = name;
                    input.value = value;
                    form.appendChild(input);
                }
                document.body.appendChild(form);
                form.submit();
                form.remove();
            } else {
                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ template, format }),
                });
                if (!response.ok)
                    throw new Error(await responseError(response));
                if (
                    !response.headers
                        .get('Content-Type')
                        ?.includes('spreadsheetml.sheet')
                )
                    throw new Error(
                        'Impossible de préparer l’export. Rechargez la page.',
                    );
                const blobUrl = URL.createObjectURL(await response.blob());
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = checked.filename;
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
            }
            setNotice(
                t(
                    'Téléchargement lancé. Gardez cette vue ouverte pendant la préparation du fichier.',
                ),
            );
        } catch (exception) {
            setError(
                exception instanceof Error
                    ? exception.message
                    : t('Export impossible.'),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <FileEditorProvider value={editorContext}>
            <section
                aria-labelledby="products-export-title"
                className="min-w-0 space-y-6 rounded-xl border bg-background p-4 lg:p-6"
            >
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                        <h1
                            ref={headingRef}
                            id="products-export-title"
                            tabIndex={-1}
                            className="scroll-mt-24 text-xl font-semibold outline-none"
                        >
                            {t('Exporter les produits')}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            <strong className="text-foreground">
                                {number(total)}
                            </strong>{' '}
                            {t('produits filtrés')} · {number(totalRows)}{' '}
                            {t('lignes de données')}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={onBack}
                    >
                        <ArrowLeft className="size-4" />
                        {t('Retour aux produits')}
                    </Button>
                </header>
                <TemplateLibrary
                    template={template}
                    format={format}
                    formats={['csv', 'xlsx']}
                    variables={editorContext.variablesForBlock}
                    disabled={busy}
                    onChange={(value) => {
                        if (view === 'quick')
                            setQuickSettings({
                                name: value.name,
                                filename: value.filename,
                                delimiter: value.delimiter,
                            });
                        else setTemplate(value);
                    }}
                    onLoad={(saved) => {
                        setTemplate(saved.template);
                        setFormat(saved.format as Format);
                        setExpertInitialized(true);
                        setView('expert');
                    }}
                />
                <FileEditorSection
                    title={t('Paramètres du fichier')}
                    open={openSection === 'settings'}
                    onOpenChange={(open) =>
                        setOpenSection(open ? 'settings' : null)
                    }
                >
                    <FileFormatField
                        value={format}
                        formats={['csv', 'xlsx'] as const}
                        disabled={busy}
                        onChange={setFormat}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">
                                {t('Nom du fichier')}
                            </p>
                            <FilenameRuleField
                                value={template.filename}
                                disabled={busy}
                                scope="header"
                                onChange={(filename) => {
                                    if (view === 'quick')
                                        setQuickSettings({
                                            ...quickSettings,
                                            filename,
                                        });
                                    else setTemplate({ ...template, filename });
                                }}
                            />
                        </div>
                        {format === 'csv' && (
                            <label className="flex items-center gap-3 text-sm">
                                {t('Séparateur')}
                                <select
                                    aria-label={t('Séparateur CSV')}
                                    disabled={busy}
                                    className={selectClass}
                                    value={template.delimiter}
                                    onChange={(event) => {
                                        const delimiter = event.target
                                            .value as FileTemplate['delimiter'];
                                        if (view === 'quick')
                                            setQuickSettings({
                                                ...quickSettings,
                                                delimiter,
                                            });
                                        else
                                            setTemplate({
                                                ...template,
                                                delimiter,
                                            });
                                    }}
                                >
                                    <option value=";">;</option>
                                    <option value=",">,</option>
                                    <option value={'\t'}>
                                        {t('Tabulation')}
                                    </option>
                                    <option value="|">|</option>
                                </select>
                            </label>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {t(
                            format === 'xlsx'
                                ? 'Excel : les miniatures disponibles sont intégrées au fichier.'
                                : 'CSV : les images sont exportées sous forme d’URL.',
                        )}
                    </p>
                </FileEditorSection>
                <FileEditorSection
                    title={t('Contenu du fichier')}
                    open={openSection === 'content'}
                    onOpenChange={(open) =>
                        setOpenSection(open ? 'content' : null)
                    }
                >
                    <Tabs
                        value={view}
                        onValueChange={changeView}
                        className="space-y-5"
                    >
                        <TabsList aria-label={t('Vue de l’export')}>
                            <TabsTrigger value="quick" disabled={busy}>
                                {t('Rapide')}
                            </TabsTrigger>
                            <TabsTrigger value="expert" disabled={busy}>
                                {t('Expert')}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="quick">
                            <ProductsExportQuickFields
                                columns={options.columns}
                                selected={quickColumns}
                                onSelectionChange={setQuickColumns}
                                disabled={busy}
                            />
                        </TabsContent>
                        <TabsContent value="expert" className="space-y-4">
                            <select
                                aria-label={t('Ajouter un champ produit')}
                                className={selectClass}
                                value=""
                                onChange={(event) =>
                                    addField(event.target.value)
                                }
                                disabled={
                                    busy ||
                                    !template.blocks.some(
                                        (block) =>
                                            block.type === 'items' &&
                                            block.columns.length < 40,
                                    )
                                }
                            >
                                <option value="">
                                    {t('Ajouter un champ produit…')}
                                </option>
                                {options.columns.map((column) => (
                                    <option key={column.key} value={column.key}>
                                        {t(column.label)}
                                    </option>
                                ))}
                            </select>
                            <FileBlocksEditor
                                blocks={template.blocks}
                                canManage={!busy}
                                initiallyOpen
                                onChange={(blocks) =>
                                    setTemplate({ ...template, blocks })
                                }
                            />
                        </TabsContent>
                    </Tabs>
                </FileEditorSection>
                <FilePreview
                    rows={preview?.rows}
                    stale={previewPending}
                    loading={previewLoading}
                    error={previewError}
                    filename={preview?.filename}
                    disabled={busy || emptyQuickSelection || total === 0}
                    onRefresh={() => void refreshPreview()}
                    caption={
                        preview
                            ? `${preview.sample_count} ${t('produits réels sur')} ${number(preview.total)}. ${t('Aperçu limité à 5 produits.')}`
                            : t('Aperçu limité à 5 produits réels.')
                    }
                />
                <footer className="space-y-3 border-t pt-4">
                    {total === 0 && (
                        <p
                            role="status"
                            className="text-sm text-muted-foreground"
                        >
                            {t('Aucun produit à exporter.')}
                        </p>
                    )}
                    {tooLarge && (
                        <p
                            role="alert"
                            className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400"
                        >
                            {t(
                                'La configuration dépasse les limites. Affinez les filtres, réduisez les lignes ou les images, ou choisissez le CSV.',
                            )}
                        </p>
                    )}
                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
                    {notice && (
                        <p
                            role="status"
                            className="text-sm text-muted-foreground"
                        >
                            {notice}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            {t('Limite :')} {number(limit)}{' '}
                            {t('lignes de données')}
                            {format === 'xlsx' &&
                                ` · ${number(options.limits.xlsx_images)} ${t('miniatures maximum')}`}
                        </p>
                        <Button
                            type="button"
                            disabled={
                                busy ||
                                tooLarge ||
                                total === 0 ||
                                emptyQuickSelection
                            }
                            onClick={download}
                        >
                            {busy ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Download className="size-4" />
                            )}
                            {t(busy ? 'Préparation…' : 'Exporter')}
                        </Button>
                    </div>
                </footer>
                <iframe
                    title={t('Téléchargement CSV')}
                    name={downloadFrame}
                    className="hidden"
                />
            </section>
        </FileEditorProvider>
    );
}

async function responseError(response: Response): Promise<string> {
    const payload = (await response.json().catch(() => null)) as {
        errors?: Record<string, string[]>;
        message?: string;
    } | null;
    return (
        Object.values(payload?.errors ?? {}).flat()[0] ??
        payload?.message ??
        'Impossible de préparer le fichier. Rechargez la page ou réduisez la sélection.'
    );
}
