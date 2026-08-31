import {
    FileBlocksEditor,
    FileEditorProvider,
    FilenameRuleField,
} from '@/components/app/file-template/file-template-editor';
import {
    renderRulePreview,
    uniqueId,
} from '@/components/app/file-template/rules';
import type {
    FileBlockType,
    FileEditorContextValue,
    FileTemplate,
} from '@/components/app/file-template/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/lib/i18n';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Copy,
    Download,
    Loader2,
    RotateCcw,
    Save,
    Trash2,
} from 'lucide-react';
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
type SavedTemplate = { id: string; template: FileTemplate; format: Format };
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

// Models store definitions only, never catalogue records or preview data.
const isSavedTemplate = (value: unknown): value is SavedTemplate => {
    if (!value || typeof value !== 'object') return false;
    const saved = value as SavedTemplate;
    return (
        typeof saved.id === 'string' &&
        ['csv', 'xlsx'].includes(saved.format) &&
        typeof saved.template?.name === 'string' &&
        typeof saved.template.filename === 'string' &&
        [';', ',', '\t', '|'].includes(saved.template.delimiter) &&
        Array.isArray(saved.template.blocks) &&
        saved.template.blocks.length <= 5 &&
        saved.template.blocks.every(
            (block) =>
                typeof block.id === 'string' &&
                typeof block.name === 'string' &&
                ['header', 'items', 'footer'].includes(block.type) &&
                Array.isArray(block.columns) &&
                block.columns.length <= 40 &&
                block.columns.every(
                    (column) =>
                        typeof column.id === 'string' &&
                        typeof column.name === 'string',
                ) &&
                Array.isArray(block.rows) &&
                block.rows.length <= 5 &&
                block.rows.every(
                    (row) =>
                        typeof row.id === 'string' &&
                        row.cells &&
                        typeof row.cells === 'object' &&
                        Object.values(row.cells).every(
                            (cell) => typeof cell === 'string',
                        ),
                ),
        )
    );
};

export function ProductsExportPanel({
    onBack,
    total,
    options,
    catalogUrl,
    exportUrl,
}: Props) {
    const { t, locale } = useI18n();
    const { auth, csrf_token: csrfToken } = usePage<SharedData>().props;
    const storageKey = `product-export-templates:v1:${auth?.user?.id ?? 'guest'}`;
    const [format, setFormat] = useState<Format>('csv');
    const [view, setView] = useState<ExportView>('quick');
    const [quickColumns, setQuickColumns] = useState(options.defaults);
    const [expertInitialized, setExpertInitialized] = useState(false);
    const [expertTemplate, setTemplate] = useState<FileTemplate>(() =>
        structuredClone(options.template),
    );
    const quickTemplate = useMemo<FileTemplate>(
        () => ({
            ...options.template,
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
        [options.template, options.columns, quickColumns],
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
    const [saved, setSaved] = useState<SavedTemplate[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewKey, setPreviewKey] = useState('');
    const headingRef = useRef<HTMLHeadingElement>(null);
    const downloadFrame = useId();
    const number = (value: number) => value.toLocaleString(locale);
    const requestKey = JSON.stringify([view, template, format, catalogUrl]);
    const previewPending = requestKey !== previewKey;
    const currentPreview = previewPending ? null : preview;
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
        currentPreview?.too_large === true;

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
    useEffect(() => {
        try {
            const stored: unknown = JSON.parse(
                localStorage.getItem(storageKey) ?? '[]',
            );
            setSaved(
                Array.isArray(stored)
                    ? stored.filter(isSavedTemplate).slice(0, 20)
                    : [],
            );
        } catch {
            setSaved([]);
        }
    }, [storageKey]);

    useEffect(() => {
        if (emptyQuickSelection) {
            setPreview(null);
            setPreviewError(null);
            setPreviewKey(requestKey);
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
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
                if (!response.ok)
                    throw new Error(await responseError(response));
                if (
                    !response.headers
                        .get('Content-Type')
                        ?.includes('application/json')
                )
                    throw new Error(
                        'Votre session a expiré. Rechargez la page.',
                    );
                const result = (await response.json()) as Preview;
                if (controller.signal.aborted) return;
                setPreview(result);
                setPreviewError(null);
                setPreviewKey(requestKey);
            } catch (exception) {
                if (controller.signal.aborted) return;
                setPreview(null);
                setPreviewError(
                    exception instanceof Error
                        ? exception.message
                        : 'Aperçu indisponible.',
                );
                setPreviewKey(requestKey);
            }
        }, 400);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [url, template, format, csrfToken, requestKey, emptyQuickSelection]);
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

    const saveModel = (duplicate = false) => {
        const id = !duplicate && selectedId ? selectedId : uniqueId('template');
        const nextTemplate = structuredClone(template);
        if (duplicate) nextTemplate.name = `${nextTemplate.name} — copie`;
        const next = [
            ...saved.filter((item) => item.id !== id),
            { id, template: nextTemplate, format },
        ];
        if (next.length > 20) {
            setError(
                t(
                    'Vous pouvez conserver au maximum 20 modèles dans ce navigateur.',
                ),
            );
            return;
        }
        try {
            localStorage.setItem(storageKey, JSON.stringify(next));
            setSaved(next);
            setSelectedId(id);
            if (duplicate) setTemplate(nextTemplate);
            setError(null);
            setNotice(t('Modèle enregistré dans ce navigateur.'));
        } catch {
            setError(t('Le navigateur ne permet pas d’enregistrer ce modèle.'));
        }
    };
    const deleteModel = () => {
        try {
            const next = saved.filter((item) => item.id !== selectedId);
            localStorage.setItem(storageKey, JSON.stringify(next));
            setSaved(next);
            setSelectedId('');
            setNotice(
                t(
                    'Modèle supprimé. La configuration reste disponible dans l’éditeur.',
                ),
            );
        } catch {
            setError(t('Impossible de supprimer le modèle enregistré.'));
        }
    };
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
        if (
            busy ||
            tooLarge ||
            total === 0 ||
            previewPending ||
            !preview ||
            previewError
        )
            return;
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
                link.download = preview.filename;
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
                            format={format}
                            onFormatChange={setFormat}
                            columns={options.columns}
                            selected={quickColumns}
                            onSelectionChange={setQuickColumns}
                            disabled={busy}
                        />
                    </TabsContent>
                    <TabsContent value="expert" className="space-y-5">
                        <fieldset disabled={busy} className="space-y-5">
                            <legend className="sr-only">
                                {t('Configuration du fichier')}
                            </legend>
                            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3">
                                <select
                                    aria-label={t('Modèle enregistré')}
                                    className={`${selectClass} min-w-48 flex-1`}
                                    value={selectedId}
                                    onChange={(event) => {
                                        const item = saved.find(
                                            (model) =>
                                                model.id === event.target.value,
                                        );
                                        if (item) {
                                            setTemplate(
                                                structuredClone(item.template),
                                            );
                                            setFormat(item.format);
                                        }
                                        setSelectedId(event.target.value);
                                    }}
                                >
                                    <option value="">
                                        {t('Configuration actuelle')}
                                    </option>
                                    {saved.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.template.name}
                                        </option>
                                    ))}
                                </select>
                                <Input
                                    aria-label={t('Nom du modèle')}
                                    className="min-w-48 flex-1"
                                    value={template.name}
                                    onChange={(event) =>
                                        setTemplate({
                                            ...template,
                                            name: event.target.value,
                                        })
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                        busy ||
                                        previewPending ||
                                        !preview ||
                                        !!previewError
                                    }
                                    onClick={() => saveModel()}
                                >
                                    <Save className="size-4" />
                                    {t('Enregistrer')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                        busy ||
                                        previewPending ||
                                        !preview ||
                                        !!previewError
                                    }
                                    onClick={() => saveModel(true)}
                                >
                                    <Copy className="size-4" />
                                    {t('Dupliquer')}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={busy || !selectedId}
                                    onClick={deleteModel}
                                    aria-label={t(
                                        'Supprimer le modèle enregistré',
                                    )}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={busy}
                                    onClick={() => {
                                        setTemplate(
                                            structuredClone(options.template),
                                        );
                                        setSelectedId('');
                                    }}
                                    title={t('Revenir au modèle simple')}
                                >
                                    <RotateCcw className="size-4" />
                                </Button>
                                <p className="w-full text-xs text-muted-foreground">
                                    {t(
                                        'Modèles personnels enregistrés dans ce navigateur. Les filtres et les données ne sont pas sauvegardés.',
                                    )}
                                </p>
                            </div>
                            <div className="grid gap-5 lg:grid-cols-2">
                                <div className="space-y-3">
                                    <p className="text-sm font-medium">
                                        {t('Format du fichier')}
                                    </p>
                                    <div className="flex flex-wrap gap-4">
                                        {(['csv', 'xlsx'] as const).map(
                                            (value) => (
                                                <label
                                                    key={value}
                                                    className="flex items-center gap-2 text-sm"
                                                >
                                                    <input
                                                        type="radio"
                                                        name="export-format"
                                                        checked={
                                                            format === value
                                                        }
                                                        onChange={() =>
                                                            setFormat(value)
                                                        }
                                                    />
                                                    {value === 'csv'
                                                        ? 'CSV'
                                                        : 'Excel (.xlsx)'}
                                                </label>
                                            ),
                                        )}
                                        <label className="flex items-center gap-2 text-sm opacity-50">
                                            <input type="radio" disabled />
                                            PDF — {t('À venir')}
                                        </label>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {format === 'xlsx'
                                            ? t(
                                                  'Images : miniatures existantes uniquement. Aucune image n’est créée ni remplacée par l’original.',
                                              )
                                            : t(
                                                  'Images sous forme d’URL. CSV envoyé progressivement, sans job.',
                                              )}
                                    </p>
                                    {format === 'csv' && (
                                        <label className="flex items-center gap-3 text-sm">
                                            {t('Séparateur')}
                                            <select
                                                aria-label={t('Séparateur CSV')}
                                                className={selectClass}
                                                value={template.delimiter}
                                                onChange={(event) =>
                                                    setTemplate({
                                                        ...template,
                                                        delimiter: event.target
                                                            .value as FileTemplate['delimiter'],
                                                    })
                                                }
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
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">
                                        {t('Nom du fichier')}
                                    </p>
                                    <FilenameRuleField
                                        value={template.filename}
                                        disabled={busy}
                                        scope="header"
                                        onChange={(filename) =>
                                            setTemplate({
                                                ...template,
                                                filename,
                                            })
                                        }
                                    />
                                    {currentPreview && (
                                        <p className="text-xs break-all text-muted-foreground">
                                            {currentPreview.filename}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4 border-t pt-5">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h2 className="font-semibold">
                                        {t('Contenu du fichier')}
                                    </h2>
                                    <select
                                        aria-label={t(
                                            'Ajouter un champ produit',
                                        )}
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
                                            <option
                                                key={column.key}
                                                value={column.key}
                                            >
                                                {t(column.label)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {t(
                                        'Renommez et déplacez les colonnes. Le bloc produits se répète pour chaque produit filtré. Les blocs d’entête et de pied sont facultatifs.',
                                    )}
                                </p>
                                <FileBlocksEditor
                                    key={selectedId || 'draft'}
                                    blocks={template.blocks}
                                    canManage={!busy}
                                    initiallyOpen
                                    onChange={(blocks) =>
                                        setTemplate({ ...template, blocks })
                                    }
                                />
                            </div>
                        </fieldset>
                        <section
                            aria-label={t('Aperçu du fichier')}
                            className="space-y-3 border-t pt-5"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h2 className="font-semibold">
                                    {t('Aperçu du fichier')}
                                </h2>
                                <span
                                    role="status"
                                    className="flex items-center gap-2 text-sm text-muted-foreground"
                                >
                                    {previewPending ? (
                                        <>
                                            <Loader2 className="size-4 animate-spin" />
                                            {t('Actualisation…')}
                                        </>
                                    ) : (
                                        currentPreview &&
                                        `${currentPreview.sample_count} ${t('produits réels sur')} ${number(currentPreview.total)}`
                                    )}
                                </span>
                            </div>
                            {!previewPending && previewError && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {previewError}
                                </p>
                            )}
                            {currentPreview && (
                                <div className="max-h-96 overflow-auto rounded-lg border">
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {currentPreview.rows.map(
                                                (row, rowIndex) => (
                                                    <tr
                                                        key={rowIndex}
                                                        className={
                                                            row.heading
                                                                ? 'bg-muted font-semibold'
                                                                : 'border-t'
                                                        }
                                                    >
                                                        {row.cells.map(
                                                            (cell, index) => (
                                                                <td
                                                                    key={index}
                                                                    className="max-w-80 min-w-32 border-r px-3 py-2 break-words whitespace-pre-wrap"
                                                                >
                                                                    {cell.image ? (
                                                                        <img
                                                                            src={
                                                                                cell.image
                                                                            }
                                                                            alt={t(
                                                                                'Miniature existante',
                                                                            )}
                                                                            className="size-16 object-contain"
                                                                        />
                                                                    ) : (
                                                                        cell.value
                                                                    )}
                                                                </td>
                                                            ),
                                                        )}
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    'Aperçu limité à 5 produits. Les calculs impossibles (valeur absente ou division par zéro) donnent une cellule vide. Maximum : 5 blocs, 40 colonnes et 5 lignes par bloc.',
                                )}
                            </p>
                        </section>
                    </TabsContent>
                </Tabs>
                <footer className="space-y-3 border-t pt-4">
                    {total === 0 && (
                        <p
                            role="status"
                            className="text-sm text-muted-foreground"
                        >
                            {t('Aucun produit à exporter.')}
                        </p>
                    )}
                    {view === 'quick' &&
                        !emptyQuickSelection &&
                        previewPending && (
                            <p
                                role="status"
                                className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                                <Loader2 className="size-4 animate-spin" />
                                {t('Vérification de l’export…')}
                            </p>
                        )}
                    {view === 'quick' && !previewPending && previewError && (
                        <p role="alert" className="text-sm text-destructive">
                            {previewError}
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
                                previewPending ||
                                !preview ||
                                !!previewError
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
