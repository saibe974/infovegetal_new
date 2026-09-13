import {
    FileEditorSection,
    FileFormatField,
    FilePreview,
    type FilePreviewRow,
} from '@/components/app/file-template/export-controls';
import {
    FileBlocksEditor,
    FileEditorProvider,
    FilenameRuleField,
} from '@/components/app/file-template/file-template-editor';
import {
    TemplateLibrary,
    fileDefinition,
} from '@/components/app/file-template/template-library';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type {
    BillingFileBlockType,
    BillingFileEvent,
    BillingFileExtension,
    BillingFileTemplate,
} from '@/types';
import {
    ChevronDownIcon,
    Maximize2Icon,
    Minimize2Icon,
    Share2Icon,
    ZapIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
    blockLabels,
    eventLabels,
    preferredExtension,
    previewItems,
    renderPreviewRows,
    replacePreviewVariables,
    variableFormatType,
    variablesForBlock,
} from './billing-file-context';
type Props = {
    file: BillingFileTemplate;
    canManage: boolean;
    expanded: boolean;
    onChange: (file: BillingFileTemplate) => void;
    onExpandedChange: (expanded: boolean) => void;
};

export default function BillingFileEditor({
    file,
    canManage,
    expanded,
    onChange,
    onExpandedChange,
}: Props) {
    const { t } = useI18n();
    const [openSection, setOpenSection] = useState<
        'settings' | 'content' | null
    >(null);
    const [editingFileName, setEditingFileName] = useState(false);
    const [fileNameDraft, setFileNameDraft] = useState(file.name);
    const primaryEvent = file.events[0] ?? file.event;
    const editorContext = useMemo(
        () => ({
            variablesForBlock: (type: BillingFileBlockType) =>
                variablesForBlock(type, file.event),
            variableFormatType,
            blockLabels,
            previewValue: (value: string, type: BillingFileBlockType) =>
                replacePreviewVariables(
                    value,
                    file.event,
                    type === 'items' ? previewItems[0] : undefined,
                ),
        }),
        [file.event],
    );
    const isOrderPdf = file.id === 'order-pdf';
    const automaticEnabled = isOrderPdf || file.enabled;
    const sharingEnabled = isOrderPdf || file.shared;
    const suggestedExtension = preferredExtension(file.delimiter);
    const extensionMismatch =
        !isOrderPdf && file.extension !== suggestedExtension;
    const filenamePreview = `${replacePreviewVariables(
        file.filename,
        primaryEvent,
        previewItems[0],
    )}.${file.extension}`;
    const [preview, setPreview] = useState<{
        rows: FilePreviewRow[];
        key: string;
        filename: string;
        fileId: string;
    } | null>(null);
    const previewKey = JSON.stringify([
        fileDefinition(file),
        file.extension,
        file.event,
    ]);
    const currentPreview = preview?.fileId === file.id ? preview : null;
    const finishFileNameEditing = (save: boolean) => {
        const name = fileNameDraft.trim();
        if (save && name && name !== file.name) {
            onChange({ ...file, name });
        } else {
            setFileNameDraft(file.name);
        }
        setEditingFileName(false);
    };

    return (
        <FileEditorProvider value={editorContext}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 rounded-md border border-violet-200/80 bg-violet-100/70 px-4 py-3 dark:border-violet-400/30 dark:bg-violet-500/15">
                {editingFileName ? (
                    <Input
                        value={fileNameDraft}
                        autoFocus
                        className="h-8 max-w-sm text-base font-semibold"
                        aria-label={t('Nom du modèle de fichier')}
                        onChange={(event) =>
                            setFileNameDraft(event.target.value)
                        }
                        onBlur={() => finishFileNameEditing(true)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                finishFileNameEditing(true);
                            }
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                finishFileNameEditing(false);
                            }
                        }}
                    />
                ) : (
                    <CardTitle>
                        <button
                            type="button"
                            className="rounded-sm text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            disabled={!canManage}
                            title={t('Modifier le nom')}
                            onClick={() => {
                                setFileNameDraft(file.name);
                                setEditingFileName(true);
                            }}
                        >
                            {file.name}
                        </button>
                    </CardTitle>
                )}
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title={
                        expanded
                            ? t('Réduire l’éditeur')
                            : t('Agrandir l’éditeur')
                    }
                    aria-label={
                        expanded
                            ? t('Réduire l’éditeur')
                            : t('Agrandir l’éditeur')
                    }
                    onClick={() => onExpandedChange(!expanded)}
                >
                    {expanded ? (
                        <Minimize2Icon className="h-4 w-4" />
                    ) : (
                        <Maximize2Icon className="h-4 w-4" />
                    )}
                </Button>
            </CardHeader>
            <CardContent className="space-y-3 px-0">
                {!isOrderPdf && (
                    <TemplateLibrary
                        key={file.id}
                        template={file}
                        format={file.extension}
                        formats={['csv', 'tsv']}
                        variables={editorContext.variablesForBlock}
                        disabled={!canManage}
                        onChange={(template) =>
                            onChange({ ...file, ...fileDefinition(template) })
                        }
                        onLoad={(saved) =>
                            onChange({
                                ...file,
                                ...fileDefinition(saved.template),
                                extension: saved.format as BillingFileExtension,
                            })
                        }
                    />
                )}
                <FileEditorSection
                    title={t('Paramètres du fichier')}
                    summary={filenamePreview}
                    open={openSection === 'settings'}
                    onOpenChange={(open) =>
                        setOpenSection(open ? 'settings' : null)
                    }
                    actions={
                        <>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={!canManage || isOrderPdf}
                                className={cn(
                                    'shrink-0',
                                    automaticEnabled
                                        ? 'bg-green-500/10 text-green-700 hover:bg-green-500/15 hover:text-green-800 dark:text-green-400'
                                        : 'bg-muted text-muted-foreground',
                                )}
                                title={t(
                                    isOrderPdf
                                        ? 'Le PDF est toujours généré automatiquement'
                                        : automaticEnabled
                                          ? 'Génération automatique activée'
                                          : 'Génération automatique désactivée',
                                )}
                                aria-label={t(
                                    automaticEnabled
                                        ? 'Désactiver la génération automatique'
                                        : 'Activer la génération automatique',
                                )}
                                aria-pressed={automaticEnabled}
                                onClick={() =>
                                    onChange({
                                        ...file,
                                        enabled: !file.enabled,
                                    })
                                }
                            >
                                <ZapIcon className="h-4 w-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={!canManage || isOrderPdf}
                                className={cn(
                                    'shrink-0',
                                    sharingEnabled
                                        ? 'bg-blue-500/10 text-blue-700 hover:bg-blue-500/15 hover:text-blue-800 dark:text-blue-400'
                                        : 'bg-muted text-muted-foreground',
                                )}
                                title={t(
                                    isOrderPdf
                                        ? 'Le PDF est toujours partagé avec les destinataires'
                                        : sharingEnabled
                                          ? 'Partage avec les destinataires activé'
                                          : 'Partage avec les destinataires désactivé',
                                )}
                                aria-label={t(
                                    sharingEnabled
                                        ? 'Désactiver le partage'
                                        : 'Activer le partage',
                                )}
                                aria-pressed={sharingEnabled}
                                onClick={() =>
                                    onChange({
                                        ...file,
                                        shared: !file.shared,
                                    })
                                }
                            >
                                <Share2Icon className="h-4 w-4" />
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <FormField label={t('Nom du fichier')}>
                            <FilenameRuleField
                                value={file.filename}
                                disabled={!canManage}
                                onChange={(filename) =>
                                    onChange({ ...file, filename })
                                }
                            />
                        </FormField>
                        <p className="text-xs text-muted-foreground">
                            {t('Aperçu')} :{' '}
                            <span className="font-mono">{filenamePreview}</span>
                        </p>

                        {!isOrderPdf ? (
                            <div className="space-y-4">
                                <FormField label={t('Événements')}>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="w-full justify-between font-normal"
                                                disabled={!canManage}
                                            >
                                                <span className="truncate">
                                                    {file.events
                                                        .map((event) =>
                                                            t(
                                                                eventLabels[
                                                                    event
                                                                ],
                                                            ),
                                                        )
                                                        .join(', ')}
                                                </span>
                                                <ChevronDownIcon className="h-4 w-4 opacity-60" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-[var(--radix-dropdown-menu-trigger-width)]">
                                            {Object.entries(eventLabels).map(
                                                ([event, label]) => {
                                                    const typedEvent =
                                                        event as BillingFileEvent;
                                                    const checked =
                                                        file.events.includes(
                                                            typedEvent,
                                                        );
                                                    return (
                                                        <DropdownMenuCheckboxItem
                                                            key={event}
                                                            checked={checked}
                                                            onSelect={(event) =>
                                                                event.preventDefault()
                                                            }
                                                            onCheckedChange={() => {
                                                                const events =
                                                                    checked
                                                                        ? file.events.filter(
                                                                              (
                                                                                  item,
                                                                              ) =>
                                                                                  item !==
                                                                                  typedEvent,
                                                                          )
                                                                        : [
                                                                              ...file.events,
                                                                              typedEvent,
                                                                          ];
                                                                if (
                                                                    !events.length
                                                                )
                                                                    return;
                                                                onChange({
                                                                    ...file,
                                                                    events,
                                                                    event: events[0],
                                                                });
                                                            }}
                                                        >
                                                            {t(label)}
                                                        </DropdownMenuCheckboxItem>
                                                    );
                                                },
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </FormField>
                                <div className="grid gap-4 md:grid-cols-2">
                                    <FormField label={t('Extension')}>
                                        <FileFormatField
                                            value={file.extension}
                                            formats={['csv', 'tsv'] as const}
                                            disabled={!canManage}
                                            onChange={(extension) => {
                                                const delimiter =
                                                    extension === 'csv'
                                                        ? file.delimiter ===
                                                              ';' ||
                                                          file.delimiter === ','
                                                            ? file.delimiter
                                                            : ';'
                                                        : file.delimiter ===
                                                                '\t' ||
                                                            file.delimiter ===
                                                                '|'
                                                          ? file.delimiter
                                                          : '\t';
                                                onChange({
                                                    ...file,
                                                    extension,
                                                    delimiter,
                                                });
                                            }}
                                        />
                                        {extensionMismatch ? (
                                            <p className="text-xs text-orange-600 dark:text-orange-400">
                                                {t(
                                                    `Extension suggérée : .${suggestedExtension}`,
                                                )}
                                            </p>
                                        ) : null}
                                    </FormField>
                                    <FormField label={t('Séparateur')}>
                                        <Select
                                            value={file.delimiter}
                                            disabled={!canManage}
                                            onValueChange={(
                                                delimiter: BillingFileTemplate['delimiter'],
                                            ) =>
                                                onChange({
                                                    ...file,
                                                    delimiter,
                                                })
                                            }
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {file.extension === 'csv' ? (
                                                    <>
                                                        <SelectItem value=";">
                                                            ; (
                                                            {t('point-virgule')}
                                                            )
                                                        </SelectItem>
                                                        <SelectItem value=",">
                                                            , ({t('virgule')})
                                                        </SelectItem>
                                                    </>
                                                ) : (
                                                    <>
                                                        <SelectItem value="\t">
                                                            {t('Tabulation')}
                                                        </SelectItem>
                                                        <SelectItem value="|">
                                                            |
                                                        </SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </FileEditorSection>
                {!isOrderPdf && (
                    <>
                        <FileEditorSection
                            title={t('Contenu du fichier')}
                            summary={`${file.blocks.length} ${t('blocs')}`}
                            open={openSection === 'content'}
                            onOpenChange={(open) =>
                                setOpenSection(open ? 'content' : null)
                            }
                        >
                            <FileBlocksEditor
                                blocks={file.blocks}
                                canManage={canManage}
                                onChange={(blocks) =>
                                    onChange({ ...file, blocks })
                                }
                            />{' '}
                        </FileEditorSection>
                        <FilePreview
                            rows={currentPreview?.rows}
                            stale={currentPreview?.key !== previewKey}
                            filename={currentPreview?.filename}
                            caption={t(
                                'Aperçu avec des données d’exemple. Les données réelles seront utilisées lors de la génération du fichier.',
                            )}
                            onRefresh={() =>
                                setPreview({
                                    rows: renderPreviewRows(file),
                                    key: previewKey,
                                    filename: filenamePreview,
                                    fileId: file.id,
                                })
                            }
                        />
                    </>
                )}
            </CardContent>
        </FileEditorProvider>
    );
}
