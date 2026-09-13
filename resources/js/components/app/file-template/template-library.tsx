import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { Copy, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { FileFormatField } from './export-controls';
import { FileBlocksEditor, FilenameRuleField } from './file-template-editor';
import {
    parseCalculationToken,
    parseUserImageRule,
    parseVariableToken,
    uniqueId,
} from './rules';
import type { FileBlockType, FileTemplate } from './types';

export type SavedFileTemplate = {
    id: string;
    template: FileTemplate;
    format: 'csv' | 'tsv' | 'xlsx';
};
// Persist only definitions: never billing recipients, events, filters, or preview data.
export const fileDefinition = (file: FileTemplate): FileTemplate => ({
    name: file.name,
    filename: file.filename,
    delimiter: file.delimiter,
    blocks: structuredClone(file.blocks),
});

export function templateCompatibility(
    template: FileTemplate,
    variables: (type: FileBlockType) => string[],
): string[] {
    const missing = new Set<string>();
    const inspect = (rule: string, type: FileBlockType) => {
        const allowed = new Set(variables(type));
        for (const token of rule.match(/%[^%]+%/g) ?? []) {
            if (parseUserImageRule(token) !== null) continue;
            const variable = parseVariableToken(token);
            const calculation = parseCalculationToken(token);
            const names = variable
                ? [variable.base]
                : calculation
                    ? calculation.operands
                        .filter(({ value }) => !/^\d+(?:\.\d+)?$/.test(value))
                        .map(({ value }) => `%${value}%`)
                    : [token];
            names.forEach((name) => {
                if (!allowed.has(name)) missing.add(name);
            });
        }
    };
    inspect(template.filename, 'header');
    template.blocks.forEach((block) =>
        block.rows.forEach((row) =>
            Object.values(row.cells).forEach((rule) =>
                inspect(rule, block.type),
            ),
        ),
    );
    return [...missing];
}

export function TemplateLibrary({
    template,
    format,
    formats,
    variables,
    disabled,
    onChange,
    onLoad,
}: {
    template: FileTemplate;
    format: string;
    formats: readonly string[];
    variables: (type: FileBlockType) => string[];
    disabled?: boolean;
    onChange: (template: FileTemplate) => void;
    onLoad: (saved: SavedFileTemplate) => void;
}) {
    const { t } = useI18n();
    const { auth, csrf_token: csrfToken } = usePage<SharedData>().props;
    const [saved, setSaved] = useState<SavedFileTemplate[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [loadedId, setLoadedId] = useState('');
    const [adaptation, setAdaptation] = useState<SavedFileTemplate | null>(
        null,
    );
    const [busy, setBusy] = useState(false);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const selected = saved.find((item) => item.id === selectedId);
    const missing = selected
        ? templateCompatibility(selected.template, variables)
        : [];
    const unsupportedFormat = selected && !formats.includes(selected.format);
    const adaptationMissing = adaptation
        ? templateCompatibility(adaptation.template, variables)
        : [];
    const userId = auth?.user?.id;
    const request = useCallback(
        async (path = '', method = 'GET', body?: SavedFileTemplate) => {
            const response = await fetch(`/file-export-templates${path}`, {
                method,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken ?? '',
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            if (response.status === 204) return null;
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload)
                throw new Error(
                    (Object.values(
                        payload?.errors ?? {},
                    ).flat()[0] as string) ||
                    payload?.message ||
                    'Impossible d’accéder aux configurations.',
                );
            return payload;
        },
        [csrfToken],
    );
    useEffect(() => {
        let cancelled = false;
        setReady(false);
        setSelectedId('');
        setLoadedId('');
        setSaved([]);
        if (!userId) return;
        void (async () => {
            try {
                const models: SavedFileTemplate[] = await request();
                // Stable legacy IDs make retries safe; keep the local backup untouched.
                const key = `product-export-templates:v1:${userId}`;
                let legacy: unknown = [];
                try {
                    legacy = JSON.parse(localStorage.getItem(key) ?? '[]');
                } catch {
                    /* Storage may be unavailable. */
                }
                const migrationKey = `${key}:server-migrated`;
                let migrated: string[] = [];
                try {
                    const stored = JSON.parse(
                        localStorage.getItem(migrationKey) ?? '[]',
                    );
                    if (Array.isArray(stored)) migrated = stored;
                } catch {
                    /* Retry safely using server IDs. */
                }
                let migrationFailed = false;
                if (Array.isArray(legacy))
                    for (const item of legacy.slice(0, 20)) {
                        if (!item?.id || migrated.includes(item.id)) continue;
                        try {
                            if (!models.some((model) => model.id === item.id)) {
                                const imported = await request('', 'POST', {
                                    id: item.id,
                                    format: item.format,
                                    template: fileDefinition(item.template),
                                });
                                models.push(imported);
                            }
                            migrated.push(item.id);
                            try {
                                localStorage.setItem(
                                    migrationKey,
                                    JSON.stringify(migrated),
                                );
                            } catch {
                                /* Keep the backup. */
                            }
                        } catch {
                            migrationFailed = true;
                        }
                    }
                if (!cancelled) {
                    setSaved(models);
                    setReady(true);
                    if (migrationFailed)
                        setError(
                            t(
                                'Certains anciens modèles n’ont pas pu être repris. Leur copie locale est conservée.',
                            ),
                        );
                }
            } catch (exception) {
                if (!cancelled) setError((exception as Error).message);
            }
        })();
        return () => {
            cancelled = true;
        };
        // Reload the personal library only when the authenticated session changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, csrfToken]);

    // A model saved in the other interface/tab becomes available on return.
    useEffect(() => {
        if (!ready || busy || !userId) return;
        let cancelled = false;
        const refresh = async () => {
            try {
                const models: SavedFileTemplate[] = await request();
                if (!cancelled) {
                    setSaved(models);
                    setLoadedId((id) =>
                        models.some((model) => model.id === id) ? id : '',
                    );
                    setSelectedId((id) =>
                        models.some((model) => model.id === id) ? id : '',
                    );
                }
            } catch (exception) {
                if (!cancelled) setError((exception as Error).message);
            }
        };
        window.addEventListener('focus', refresh);
        return () => {
            cancelled = true;
            window.removeEventListener('focus', refresh);
        };
    }, [ready, busy, userId, request]);

    const save = async (duplicate: boolean) => {
        setBusy(true);
        setError(null);
        try {
            const definition = fileDefinition(template);
            if (duplicate) definition.name = `${definition.name} — copie`;
            const item: SavedFileTemplate = {
                id: !duplicate && loadedId ? loadedId : uniqueId('template'),
                template: definition,
                format: format as SavedFileTemplate['format'],
            };
            const result: SavedFileTemplate = await request('', 'POST', item);
            setSaved((models) => [
                ...models.filter((model) => model.id !== result.id),
                result,
            ]);
            setSelectedId(result.id);
            setLoadedId(result.id);
            onChange(structuredClone(result.template));
        } catch (exception) {
            setError((exception as Error).message);
        } finally {
            setBusy(false);
        }
    };
    const remove = async () => {
        setBusy(true);
        setError(null);
        try {
            await request(`/${encodeURIComponent(selectedId)}`, 'DELETE');
            setSaved((models) =>
                models.filter((model) => model.id !== selectedId),
            );
            setSelectedId('');
            if (loadedId === selectedId) setLoadedId('');
        } catch (exception) {
            setError((exception as Error).message);
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="space-y-3 rounded-lg bg-muted/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
                <select
                    aria-label={t('Configuration enregistrée')}
                    className="h-9 min-w-48 flex-1 rounded-md border bg-background px-3 text-sm"
                    disabled={disabled || busy || !ready}
                    value={selectedId}
                    onChange={(event) => {
                        setSelectedId(event.target.value);
                        if (!event.target.value) setLoadedId('');
                        setAdaptation(null);
                        setError(null);
                    }}
                >
                    <option value="">{t('Nouvelle configuration')}</option>
                    {saved.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.template.name} · {item.format.toUpperCase()}
                        </option>
                    ))}
                </select>
                <Button
                    type="button"
                    variant="outline"
                    disabled={
                        disabled ||
                        busy ||
                        !selected ||
                        missing.length > 0 ||
                        !!unsupportedFormat
                    }
                    onClick={() => {
                        if (selected) {
                            onLoad(structuredClone(selected));
                            setLoadedId(selected.id);
                            setAdaptation(null);
                        }
                    }}
                >
                    {t('Charger')}
                </Button>
                <Input
                    aria-label={t('Nom du modèle')}
                    className="min-w-48 flex-1"
                    value={template.name}
                    disabled={disabled || busy}
                    maxLength={120}
                    onChange={(event) =>
                        onChange({ ...template, name: event.target.value })
                    }
                />
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || busy || !ready}
                    onClick={() => void save(false)}
                >
                    <Save className="size-4" />
                    {t('Enregistrer')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || busy || !ready}
                    onClick={() => void save(true)}
                >
                    <Copy className="size-4" />
                    {t('Dupliquer')}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    aria-label={t('Supprimer la configuration')}
                    disabled={disabled || busy || !selected}
                    onClick={() => void remove()}
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>
            {(missing.length > 0 || unsupportedFormat) && (
                <p
                    role="status"
                    className="text-sm text-amber-700 dark:text-amber-400"
                >
                    {t(
                        'Cette configuration nécessite une adaptation avant utilisation ici.',
                    )}{' '}
                    {unsupportedFormat &&
                        `${t('Format indisponible :')} ${selected?.format.toUpperCase()}. `}
                    {missing.length > 0 &&
                        `${t('Variables indisponibles :')} ${missing.join(', ')}`}
                </p>
            )}
            {(missing.length > 0 || unsupportedFormat) && !adaptation && (
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || busy}
                    onClick={() => {
                        if (selected)
                            setAdaptation({
                                ...structuredClone(selected),
                                id: uniqueId('template'),
                                template: {
                                    ...structuredClone(selected.template),
                                    name: `${selected.template.name} — copie`,
                                },
                            });
                    }}
                >
                    {t('Adapter une copie')}
                </Button>
            )}
            {adaptation && (
                <div className="space-y-4 rounded-lg border p-4">
                    <p className="text-sm font-medium">
                        {t('Adapter la copie avant de la charger')}
                    </p>
                    <Input
                        aria-label={t('Nom de la copie')}
                        value={adaptation.template.name}
                        disabled={disabled || busy}
                        onChange={(event) =>
                            setAdaptation({
                                ...adaptation,
                                template: {
                                    ...adaptation.template,
                                    name: event.target.value,
                                },
                            })
                        }
                    />
                    <FileFormatField
                        value={adaptation.format}
                        formats={formats as SavedFileTemplate['format'][]}
                        disabled={disabled || busy}
                        onChange={(value) =>
                            setAdaptation({ ...adaptation, format: value })
                        }
                    />
                    <FilenameRuleField
                        value={adaptation.template.filename}
                        scope="header"
                        disabled={disabled || busy}
                        onChange={(filename) =>
                            setAdaptation({
                                ...adaptation,
                                template: { ...adaptation.template, filename },
                            })
                        }
                    />
                    <FileBlocksEditor
                        blocks={adaptation.template.blocks}
                        canManage={!disabled && !busy}
                        initiallyOpen
                        onChange={(blocks) =>
                            setAdaptation({
                                ...adaptation,
                                template: { ...adaptation.template, blocks },
                            })
                        }
                    />
                    {adaptationMissing.length > 0 && (
                        <p
                            role="status"
                            className="text-sm text-amber-700 dark:text-amber-400"
                        >
                            {t('Variables à remplacer :')}{' '}
                            {adaptationMissing.join(', ')}
                        </p>
                    )}
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            disabled={
                                disabled ||
                                busy ||
                                adaptationMissing.length > 0 ||
                                !formats.includes(adaptation.format)
                            }
                            onClick={() => {
                                onLoad(structuredClone(adaptation));
                                setLoadedId('');
                                setSelectedId('');
                                setAdaptation(null);
                            }}
                        >
                            {t('Utiliser cette copie')}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setAdaptation(null)}
                        >
                            {t('Annuler')}
                        </Button>
                    </div>
                </div>
            )}
            {!userId && (
                <p className="text-sm text-muted-foreground">
                    {t('Connectez-vous pour enregistrer vos configurations.')}
                </p>
            )}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
            {/* <p className="text-xs text-muted-foreground">
                {t(
                    'Bibliothèque personnelle commune à Products et Billing. Les filtres, données, événements et options de partage ne sont pas enregistrés.',
                )}
            </p> */}
        </div>
    );
}
