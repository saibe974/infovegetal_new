import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
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

// Export names can differ from library names. Compare normalized file content.
const definitionKey = (file: FileTemplate) =>
    JSON.stringify([
        file.filename,
        file.delimiter,
        file.blocks.map((block) => [
            block.name,
            block.type,
            block.enabled,
            block.show_headers,
            block.columns.map((column) => column.name),
            block.rows.map((row) =>
                block.columns.map((column) => row.cells[column.id] ?? ''),
            ),
        ]),
    ]);

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
    autoSelectCurrentTemplate = false,
    currentTemplateId,
    onClearSelection,
    onChange,
    onLoad,
}: {
    template: FileTemplate;
    format: string;
    formats: readonly string[];
    variables: (type: FileBlockType) => string[];
    disabled?: boolean;
    autoSelectCurrentTemplate?: boolean;
    currentTemplateId?: string | null;
    onClearSelection?: () => void;
    onChange: (template: FileTemplate, savedId?: string) => void;
    onLoad: (saved: SavedFileTemplate, savedId: string | null) => void;
}) {
    const { t } = useI18n();
    const accessError = t('Unable to access models.');
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
    const currentId = autoSelectCurrentTemplate
        ? saved.find((model) =>
              currentTemplateId !== undefined
                  ? model.id === currentTemplateId
                  : model.format === format &&
                    definitionKey(model.template) === definitionKey(template),
          )?.id ?? ''
        : '';
    useEffect(() => {
        if (!autoSelectCurrentTemplate || !ready) return;
        setSelectedId(currentId);
        setLoadedId(currentId);
    }, [autoSelectCurrentTemplate, currentId, ready]);
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
                    accessError,
                );
            return payload;
        },
        [csrfToken, accessError],
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
                                'Some older models could not be imported. Their local copies have been preserved.',
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
            if (duplicate) definition.name = `${definition.name} — ${t('copy')}`;
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
            onChange(structuredClone(result.template), result.id);
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
                    aria-label={t('Saved model')}
                    className={cn(
                        'h-9 min-w-48 flex-1 rounded-md border bg-background px-3 text-sm',
                        selectedId === '' && 'text-muted-foreground',
                    )}
                    disabled={disabled || busy || !ready}
                    value={selectedId}
                    onChange={(event) => {
                        const id = event.target.value;
                        const item = saved.find((model) => model.id === id);
                        setSelectedId(id);
                        if (!id) {
                            setLoadedId('');
                            onClearSelection?.();
                        }
                        setAdaptation(null);
                        setError(null);
                        if (
                            item &&
                            formats.includes(item.format) &&
                            templateCompatibility(item.template, variables)
                                .length === 0
                        ) {
                            onLoad(structuredClone(item), item.id);
                            setLoadedId(item.id);
                        }
                    }}
                >
                    <option value="" className="text-muted-foreground">
                        {t('New model')}
                    </option>
                    {saved.map((item) => (
                        <option
                            key={item.id}
                            value={item.id}
                            className="text-foreground"
                        >
                            {item.template.name} · {item.format.toUpperCase()}
                        </option>
                    ))}
                </select>
                <Input
                    aria-label={t('Model name')}
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
                    {t('Save model')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || busy || !ready}
                    onClick={() => void save(true)}
                >
                    <Copy className="size-4" />
                    {t('Duplicate model')}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    aria-label={t('Delete model')}
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
                        'This model needs to be adapted before it can be used here.',
                    )}{' '}
                    {unsupportedFormat &&
                        `${t('Unavailable format:')} ${selected?.format.toUpperCase()}. `}
                    {missing.length > 0 &&
                        `${t('Unavailable variables:')} ${missing.join(', ')}`}
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
                                    name: `${selected.template.name} — ${t('copy')}`,
                                },
                            });
                    }}
                >
                    {t('Adapt a copy')}
                </Button>
            )}
            {adaptation && (
                <div className="space-y-4 rounded-lg border p-4">
                    <p className="text-sm font-medium">
                        {t('Adapt the copy before loading it')}
                    </p>
                    <Input
                        aria-label={t('Copy name')}
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
                            {t('Variables to replace:')}{' '}
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
                                onLoad(structuredClone(adaptation), null);
                                setLoadedId('');
                                setSelectedId('');
                                setAdaptation(null);
                            }}
                        >
                            {t('Use this copy')}
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => setAdaptation(null)}
                        >
                            {t('Cancel')}
                        </Button>
                    </div>
                </div>
            )}
            {!userId && (
                <p className="text-sm text-muted-foreground">
                    {t('Sign in to save your models.')}
                </p>
            )}
            {error && (
                <p role="alert" className="text-sm text-destructive">
                    {error}
                </p>
            )}
        </div>
    );
}
