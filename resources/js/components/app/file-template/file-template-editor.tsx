import { DataTable } from '@/components/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
    closestCenter,
    DndContext,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import {
    BracesIcon,
    ChevronDownIcon,
    ChevronUpIcon,
    GripVerticalIcon,
    PlusIcon,
    Settings2Icon,
    TrashIcon,
    XIcon,
} from 'lucide-react';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    formatVariableToken,
    parseCalculationToken,
    parseVariableToken,
    serializeCalculation,
    uniqueId,
    type CalculationOperand,
    type CalculationOperator,
    type ParsedCalculation,
} from './rules';
import type {
    FileBlock,
    FileBlockType,
    FileEditorContextValue,
    FileRow,
} from './types';
const FileEditorContext = createContext<FileEditorContextValue | null>(null);
export const FileEditorProvider = FileEditorContext.Provider;
const useFileEditor = () => {
    const context = useContext(FileEditorContext);
    if (!context) throw new Error('FileEditorProvider is required');
    return context;
};
const hasVariableIssue = (
    value: string,
    blockType: FileBlockType,
    { variablesForBlock, variableFormatType }: FileEditorContextValue,
) => {
    const allowed = new Set(
        variablesForBlock(blockType).map((variable) => variable.slice(1, -1)),
    );
    const allowedNumeric = new Set(
        [...allowed].filter(
            (variable) => variableFormatType(variable) === 'decimal',
        ),
    );
    return [...value.matchAll(/%([^%]+)%/g)].some((match) => {
        if (match[0].toLowerCase().startsWith('%calc:')) {
            const calculation = parseCalculationToken(match[0]);
            return (
                !calculation ||
                calculation.operands.some(
                    (operand) =>
                        !/^\d+(?:\.\d+)?$/.test(operand.value) &&
                        !allowedNumeric.has(operand.value),
                )
            );
        }

        const parsed = parseVariableToken(match[0]);
        if (!parsed || !allowed.has(parsed.name)) return true;
        if (parsed.format === 'raw') return false;

        const formatType = variableFormatType(parsed.name);
        return formatType === 'date'
            ? !['date:dmy', 'date:ymd'].includes(parsed.format)
            : formatType === 'decimal'
              ? ![
                    'decimal:0',
                    'decimal:1',
                    'decimal:2',
                    'decimal:3',
                    'decimal:4',
                ].includes(parsed.format)
              : true;
    });
};

type RuleSegment = {
    id: string;
    kind: 'text' | 'variable' | 'calculation';
    value: string;
};

const parseRuleSegments = (value: string): RuleSegment[] => {
    const segments: RuleSegment[] = [];
    const variablePattern =
        /%calc:[^%]+%|%[a-z0-9_.-]+(?:\|(?:date|decimal):[a-z0-9]+)?%/gi;
    let cursor = 0;

    for (const match of value.matchAll(variablePattern)) {
        const index = match.index ?? 0;
        if (index > cursor) {
            segments.push({
                id: uniqueId('segment'),
                kind: 'text',
                value: value.slice(cursor, index),
            });
        }
        segments.push({
            id: uniqueId('segment'),
            kind: parseCalculationToken(match[0]) ? 'calculation' : 'variable',
            value: match[0],
        });
        cursor = index + match[0].length;
    }

    if (cursor < value.length) {
        segments.push({
            id: uniqueId('segment'),
            kind: 'text',
            value: value.slice(cursor),
        });
    }

    return segments.length
        ? segments
        : [{ id: uniqueId('segment'), kind: 'text', value: '' }];
};

type RuleEditorProps = {
    value: string;
    variables: string[];
    blockType: FileBlockType;
    onApply: (value: string) => void;
};

type SortableRuleSegmentProps = {
    segment: RuleSegment;
    variables: string[];
    onChange: (segment: RuleSegment) => void;
    onInsert: (position: 'before' | 'after') => void;
    onDelete: () => void;
};

type CalculationEditorProps = {
    value: string;
    variables: string[];
    onChange: (value: string) => void;
};

function CalculationEditor({
    value,
    variables,
    onChange,
}: CalculationEditorProps) {
    const { t } = useI18n();
    const { variableFormatType } = useFileEditor();
    const numericVariables = variables
        .map((variable) => parseVariableToken(variable))
        .filter(
            (variable) =>
                variable && variableFormatType(variable.name) === 'decimal',
        )
        .map((variable) => variable!.name);
    const fallbackOperand = numericVariables[0] ?? '0';
    const calculation = parseCalculationToken(value) ?? {
        operands: [
            {
                id: uniqueId('operand'),
                operator: null,
                value: fallbackOperand,
            },
        ],
        decimals: 'raw',
    };

    const commit = (next: ParsedCalculation) =>
        onChange(serializeCalculation(next));
    const updateOperand = (index: number, patch: Partial<CalculationOperand>) =>
        commit({
            ...calculation,
            operands: calculation.operands.map((operand, operandIndex) =>
                operandIndex === index ? { ...operand, ...patch } : operand,
            ),
        });
    const addOperand = () =>
        commit({
            ...calculation,
            operands: [
                ...calculation.operands,
                {
                    id: uniqueId('operand'),
                    operator: '*',
                    value: fallbackOperand,
                },
            ],
        });
    const removeOperand = (index: number) =>
        commit({
            ...calculation,
            operands: calculation.operands
                .filter((_, operandIndex) => operandIndex !== index)
                .map((operand, operandIndex) => ({
                    ...operand,
                    operator: operandIndex === 0 ? null : operand.operator,
                })),
        });

    return (
        <div className="min-w-0 flex-1 space-y-2 rounded-md bg-muted/40 p-2">
            {calculation.operands.map((operand, index) => {
                const isConstant = /^\d+(?:\.\d+)?$/.test(operand.value);
                return (
                    <div
                        key={index}
                        className="flex min-w-0 items-center gap-2"
                    >
                        {index === 0 ? (
                            <span className="w-16 shrink-0 text-center text-sm text-muted-foreground">
                                =
                            </span>
                        ) : (
                            <Select
                                value={operand.operator ?? '*'}
                                onValueChange={(operator) =>
                                    updateOperand(index, {
                                        operator:
                                            operator as CalculationOperator,
                                    })
                                }
                            >
                                <SelectTrigger className="w-16 shrink-0 font-mono">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {['+', '-', '*', '/'].map((operator) => (
                                        <SelectItem
                                            key={operator}
                                            value={operator}
                                            className="font-mono"
                                        >
                                            {operator}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Select
                            value={isConstant ? 'constant' : 'variable'}
                            onValueChange={(source) =>
                                updateOperand(index, {
                                    value:
                                        source === 'constant'
                                            ? '0'
                                            : fallbackOperand,
                                })
                            }
                        >
                            <SelectTrigger className="w-28 shrink-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="variable">
                                    {t('Variable')}
                                </SelectItem>
                                <SelectItem value="constant">
                                    {t('Nombre')}
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {isConstant ? (
                            <Input
                                type="number"
                                min="0"
                                step="any"
                                value={operand.value}
                                className="min-w-0 flex-1"
                                onChange={(event) =>
                                    updateOperand(index, {
                                        value: event.target.value || '0',
                                    })
                                }
                            />
                        ) : (
                            <Select
                                value={operand.value}
                                onValueChange={(nextValue) =>
                                    updateOperand(index, { value: nextValue })
                                }
                            >
                                <SelectTrigger className="min-w-0 flex-1 font-mono">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                    {numericVariables.map((variable) => (
                                        <SelectItem
                                            key={variable}
                                            value={variable}
                                            className="font-mono"
                                        >
                                            %{variable}%
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={calculation.operands.length === 1}
                            title={t('Supprimer cette donnée')}
                            onClick={() => removeOperand(index)}
                        >
                            <TrashIcon className="h-4 w-4" />
                        </Button>
                    </div>
                );
            })}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-green-600 hover:bg-green-500/10 hover:text-green-700 dark:text-green-400"
                    onClick={addOperand}
                >
                    <PlusIcon className="h-4 w-4" />
                    {t('Ajouter une donnée')}
                </Button>
                <Select
                    value={calculation.decimals}
                    onValueChange={(decimals) =>
                        commit({ ...calculation, decimals })
                    }
                >
                    <SelectTrigger className="w-40">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="raw">{t('Format brut')}</SelectItem>
                        {[0, 1, 2, 3, 4].map((decimals) => (
                            <SelectItem key={decimals} value={String(decimals)}>
                                {decimals === 1
                                    ? t('1 décimale')
                                    : t(`${decimals} décimales`)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

function SortableRuleSegment({
    segment,
    variables,
    onChange,
    onInsert,
    onDelete,
}: SortableRuleSegmentProps) {
    const { t } = useI18n();
    const { variableFormatType } = useFileEditor();
    const {
        attributes,
        listeners,
        setActivatorNodeRef,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: segment.id });
    const parsedVariable = parseVariableToken(segment.value);
    const selectedVariable = parsedVariable?.base ?? segment.value;
    const selectedFormat = parsedVariable?.format ?? 'raw';
    const formatType = parsedVariable
        ? variableFormatType(parsedVariable.name)
        : null;
    const variableOptions = variables.includes(selectedVariable)
        ? variables
        : [selectedVariable, ...variables].filter(Boolean);
    const firstNumericVariable = variables
        .map((variable) => parseVariableToken(variable))
        .find(
            (variable) =>
                variable && variableFormatType(variable.name) === 'decimal',
        );

    const changeKind = (kind: RuleSegment['kind']) =>
        onChange({
            ...segment,
            kind,
            value:
                kind === 'variable'
                    ? (variables[0] ?? '')
                    : kind === 'calculation'
                      ? serializeCalculation({
                            operands: [
                                {
                                    id: uniqueId('operand'),
                                    operator: null,
                                    value: firstNumericVariable?.name ?? '0',
                                },
                            ],
                            decimals: 'raw',
                        })
                      : '',
        });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={cn(
                'flex items-center gap-2 rounded-md border bg-card p-2',
                isDragging && 'z-10 opacity-70 shadow-lg',
            )}
        >
            <Button
                ref={setActivatorNodeRef}
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 cursor-grab touch-none active:cursor-grabbing"
                title={t('Déplacer cet élément')}
                {...attributes}
                {...listeners}
            >
                <GripVerticalIcon className="h-4 w-4" />
            </Button>

            <Select value={segment.kind} onValueChange={changeKind}>
                <SelectTrigger className="w-28 shrink-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="text">{t('Texte')}</SelectItem>
                    <SelectItem value="variable">{t('Variable')}</SelectItem>
                    <SelectItem value="calculation">{t('Calcul')}</SelectItem>
                </SelectContent>
            </Select>

            {segment.kind === 'calculation' ? (
                <CalculationEditor
                    value={segment.value}
                    variables={variables}
                    onChange={(value) => onChange({ ...segment, value })}
                />
            ) : segment.kind === 'variable' ? (
                <>
                    <Select
                        value={selectedVariable}
                        onValueChange={(value) =>
                            onChange({ ...segment, value })
                        }
                    >
                        <SelectTrigger className="min-w-0 flex-1 font-mono">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                            {variableOptions.map((variable) => (
                                <SelectItem
                                    key={variable}
                                    value={variable}
                                    className="font-mono"
                                >
                                    {variable}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {formatType ? (
                        <Select
                            value={selectedFormat}
                            onValueChange={(format) =>
                                onChange({
                                    ...segment,
                                    value: formatVariableToken(
                                        selectedVariable,
                                        format,
                                    ),
                                })
                            }
                        >
                            <SelectTrigger className="w-40 shrink-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="raw">
                                    {t('Format brut')}
                                </SelectItem>
                                {formatType === 'date' ? (
                                    <>
                                        <SelectItem value="date:dmy">
                                            {t('JJ/MM/AAAA')}
                                        </SelectItem>
                                        <SelectItem value="date:ymd">
                                            {t('AAAA-MM-JJ')}
                                        </SelectItem>
                                    </>
                                ) : (
                                    [0, 1, 2, 3, 4].map((decimals) => (
                                        <SelectItem
                                            key={decimals}
                                            value={`decimal:${decimals}`}
                                        >
                                            {decimals === 1
                                                ? t('1 décimale')
                                                : t(`${decimals} décimales`)}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    ) : null}
                </>
            ) : (
                <Input
                    value={segment.value}
                    className="min-w-0 flex-1"
                    placeholder={t('Texte fixe')}
                    onChange={(event) =>
                        onChange({ ...segment, value: event.target.value })
                    }
                />
            )}

            <div className="flex h-9 w-8 shrink-0 flex-col overflow-hidden rounded-md border border-border/60">
                <button
                    type="button"
                    className="flex h-1/2 items-center justify-center border-b border-border/60 text-green-600 transition-colors hover:bg-green-500/10 hover:text-green-700 dark:text-green-400"
                    title={t('Insérer un élément avant')}
                    aria-label={t('Insérer un élément avant')}
                    onClick={() => onInsert('before')}
                >
                    <ChevronUpIcon className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    className="flex h-1/2 items-center justify-center text-green-600 transition-colors hover:bg-green-500/10 hover:text-green-700 dark:text-green-400"
                    title={t('Insérer un élément après')}
                    aria-label={t('Insérer un élément après')}
                    onClick={() => onInsert('after')}
                >
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                </button>
            </div>

            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                title={t('Supprimer cet élément')}
                onClick={onDelete}
            >
                <TrashIcon className="h-4 w-4" />
            </Button>
        </div>
    );
}

export function FileRuleEditor({
    value,
    variables,
    blockType,
    onApply,
}: RuleEditorProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [segments, setSegments] = useState<RuleSegment[]>([]);
    const [previewOpen, setPreviewOpen] = useState(false);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );
    const result = segments.map((segment) => segment.value).join('');
    const { previewValue } = useFileEditor();
    const previewResult = previewValue(result, blockType);

    const handleOpenChange = (nextOpen: boolean) => {
        if (nextOpen) {
            setSegments(parseRuleSegments(value));
            setPreviewOpen(false);
        }
        setOpen(nextOpen);
    };

    const updateSegment = (nextSegment: RuleSegment) =>
        setSegments((current) =>
            current.map((segment) =>
                segment.id === nextSegment.id ? nextSegment : segment,
            ),
        );

    const insertSegment = (segmentId: string, position: 'before' | 'after') =>
        setSegments((current) => {
            const currentIndex = current.findIndex(
                (segment) => segment.id === segmentId,
            );
            const insertAt =
                Math.max(0, currentIndex) + (position === 'after' ? 1 : 0);
            const next = [...current];
            next.splice(insertAt, 0, {
                id: uniqueId('segment'),
                kind: 'text',
                value: '',
            });
            return next;
        });

    const removeSegment = (id: string) =>
        setSegments((current) => {
            const next = current.filter((segment) => segment.id !== id);
            return next.length
                ? next
                : [{ id: uniqueId('segment'), kind: 'text', value: '' }];
        });

    const handleSegmentDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        setSegments((current) => {
            const from = current.findIndex(
                (segment) => segment.id === active.id,
            );
            const to = current.findIndex((segment) => segment.id === over.id);
            return from < 0 || to < 0 ? current : arrayMove(current, from, to);
        });
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    title={t('Éditer la règle de remplissage')}
                    aria-label={t('Éditer la règle de remplissage')}
                >
                    <Settings2Icon className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('Règle de remplissage')}</DialogTitle>
                    <DialogDescription>
                        {t(
                            'Assemblez du texte et des variables dans l’ordre souhaité.',
                        )}
                    </DialogDescription>
                </DialogHeader>

                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleSegmentDragEnd}
                >
                    <SortableContext
                        items={segments.map((segment) => segment.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                            {segments.map((segment) => (
                                <SortableRuleSegment
                                    key={segment.id}
                                    segment={segment}
                                    variables={variables}
                                    onChange={updateSegment}
                                    onInsert={(position) =>
                                        insertSegment(segment.id, position)
                                    }
                                    onDelete={() => removeSegment(segment.id)}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>

                <div className="space-y-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                        onClick={() => setPreviewOpen((current) => !current)}
                    >
                        <ChevronDownIcon
                            className={cn(
                                'h-4 w-4 transition-transform',
                                previewOpen && 'rotate-180',
                            )}
                        />
                        {previewOpen
                            ? t('Masquer l’aperçu')
                            : t('Afficher l’aperçu')}
                    </Button>
                    {previewOpen ? (
                        <div className="space-y-1.5 rounded-md bg-muted px-3 py-2">
                            <p className="text-xs text-muted-foreground">
                                {t('Exemple de résultat')}
                            </p>
                            <div className="min-h-5 font-mono text-sm break-all">
                                {previewResult || (
                                    <span className="text-muted-foreground">
                                        {t('Valeur vide')}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                    >
                        {t('Annuler')}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => {
                            onApply(result);
                            setOpen(false);
                        }}
                    >
                        {t('Appliquer')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

type FilenameRuleFieldProps = {
    value: string;
    disabled: boolean;
    scope?: FileBlockType;
    onChange: (value: string) => void;
};

export function FilenameRuleField({
    value,
    disabled,
    scope = 'items',
    onChange,
}: FilenameRuleFieldProps) {
    const { t } = useI18n();
    const { variablesForBlock } = useFileEditor();
    const variables = variablesForBlock(scope);
    const parsedVariable = parseVariableToken(value);
    const isSingleVariable = parsedVariable?.format === 'raw';
    const isConfigured =
        !isSingleVariable &&
        /%calc:[^%]+%|%[a-z0-9_.-]+(?:\|(?:date|decimal):[a-z0-9]+)?%/i.test(
            value,
        );

    const variablePicker = (active = false) => (
        <DropdownMenu key={active ? 'filename-variable' : 'filename-add'}>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                        'shrink-0',
                        active &&
                            'text-green-600 hover:bg-green-500/10 hover:text-green-700 dark:text-green-400',
                    )}
                    title={t(active ? 'Nom variable' : 'Insérer une variable')}
                >
                    <BracesIcon className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-72 overflow-y-auto">
                {variables.map((variable) => (
                    <DropdownMenuItem
                        key={variable}
                        onSelect={() =>
                            onChange(
                                isSingleVariable
                                    ? variable
                                    : `${value}${variable}`,
                            )
                        }
                    >
                        {variable}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    const ruleEditor = (active = false) => (
        <div
            key={active ? 'filename-rule' : 'filename-rule-action'}
            className={cn(
                'shrink-0',
                active &&
                    '[&_button]:text-violet-600 [&_button]:hover:bg-violet-500/10 [&_button]:hover:text-violet-700 dark:[&_button]:text-violet-400',
            )}
        >
            <FileRuleEditor
                value={value}
                variables={variables}
                blockType={scope}
                onApply={onChange}
            />
        </div>
    );

    return (
        <div className="group/filename flex min-w-0 items-center gap-1.5">
            {!disabled && isSingleVariable ? variablePicker(true) : null}
            {!disabled && isConfigured ? ruleEditor(true) : null}
            <div className="relative min-w-0 flex-1">
                <Input
                    value={value}
                    disabled={disabled}
                    className={cn(value && !disabled && 'pr-8')}
                    placeholder={t('Nom du fichier')}
                    onChange={(event) => onChange(event.target.value)}
                />
                {value && !disabled ? (
                    <button
                        type="button"
                        className="absolute top-1/2 right-1 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        title={t('Vider le nom du fichier')}
                        aria-label={t('Vider le nom du fichier')}
                        onClick={() => onChange('')}
                    >
                        <XIcon className="h-3.5 w-3.5" />
                    </button>
                ) : null}
            </div>
            {!disabled ? (
                <div className="pointer-events-none flex items-center gap-1.5 opacity-0 transition-opacity group-focus-within/filename:pointer-events-auto group-focus-within/filename:opacity-100 group-hover/filename:pointer-events-auto group-hover/filename:opacity-100">
                    {!isSingleVariable ? variablePicker() : null}
                    {!isConfigured ? ruleEditor() : null}
                </div>
            ) : null}
        </div>
    );
}

type BlockEditorProps = {
    block: FileBlock;
    canManage: boolean;
    onChange: (block: FileBlock) => void;
};

export function BlockEditor({ block, canManage, onChange }: BlockEditorProps) {
    const { t } = useI18n();
    const context = useFileEditor();
    const { variablesForBlock, blockLabels } = context;
    const tRef = useRef(t);
    tRef.current = t;
    const focusRowIdRef = useRef<string | null>(null);
    const updateCell = useCallback(
        (rowId: string, columnId: string, value: string) => {
            onChange({
                ...block,
                rows: block.rows.map((row) =>
                    row.id === rowId
                        ? { ...row, cells: { ...row.cells, [columnId]: value } }
                        : row,
                ),
            });
        },
        [block, onChange],
    );

    const removeRow = useCallback(
        (rowId: string) =>
            onChange({
                ...block,
                rows: block.rows.filter((row) => row.id !== rowId),
            }),
        [block, onChange],
    );
    const updateCellRef = useRef(updateCell);
    const removeRowRef = useRef(removeRow);
    updateCellRef.current = updateCell;
    removeRowRef.current = removeRow;

    const renameColumn = (columnId: string, name: string) =>
        onChange({
            ...block,
            columns: block.columns.map((column) =>
                column.id === columnId ? { ...column, name } : column,
            ),
        });

    const removeColumn = (columnId: string) =>
        onChange({
            ...block,
            columns: block.columns.filter((column) => column.id !== columnId),
            rows: block.rows.map((row) => {
                const cells = { ...row.cells };
                delete cells[columnId];
                return { ...row, cells };
            }),
        });

    const insertColumn = (columnIndex: number) => {
        const id = uniqueId('column');
        const columns = [...block.columns];
        columns.splice(columnIndex, 0, {
            id,
            name: `${t('Colonne')} ${block.columns.length + 1}`,
        });
        onChange({
            ...block,
            columns,
            rows: block.rows.map((row) => ({
                ...row,
                cells: { ...row.cells, [id]: '' },
            })),
        });
    };

    const insertRow = (rowId: string | null, position: 'before' | 'after') => {
        const nextRowId = uniqueId('row');
        const nextRow: FileRow = {
            id: nextRowId,
            cells: Object.fromEntries(
                block.columns.map((column) => [column.id, '']),
            ),
        };
        const currentIndex = rowId
            ? block.rows.findIndex((row) => row.id === rowId)
            : -1;
        const insertAt =
            currentIndex < 0
                ? 0
                : currentIndex + (position === 'after' ? 1 : 0);
        const rows = [...block.rows];
        rows.splice(insertAt, 0, nextRow);
        focusRowIdRef.current = nextRowId;
        onChange({ ...block, rows });
    };

    const insertRowRef = useRef(insertRow);
    insertRowRef.current = insertRow;

    const columns = useMemo<ColumnDef<FileRow>[]>(() => {
        const variables = variablesForBlock(block.type);

        return [
            ...block.columns.map((column) => ({
                id: column.id,
                header: column.name,
                cell: ({ row }: CellContext<FileRow, unknown>) => {
                    const value = row.original.cells[column.id] ?? '';
                    const hasIssue = hasVariableIssue(
                        value,
                        block.type,
                        context,
                    );
                    const parsedCellVariable = parseVariableToken(value);
                    const isSingleVariable =
                        parsedCellVariable?.format === 'raw';
                    const isConfigured =
                        !isSingleVariable &&
                        /%calc:[^%]+%|%[a-z0-9_.-]+(?:\|(?:date|decimal):[a-z0-9]+)?%/i.test(
                            value,
                        );
                    const variablePicker = (active = false) => (
                        <DropdownMenu
                            key={active ? 'variable-type' : 'variable-action'}
                        >
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        'shrink-0',
                                        active &&
                                            'text-green-600 hover:bg-green-500/10 hover:text-green-700 dark:text-green-400',
                                    )}
                                    title={tRef.current(
                                        active
                                            ? 'Champ variable'
                                            : 'Insérer une variable',
                                    )}
                                    aria-label={tRef.current(
                                        active
                                            ? 'Champ variable'
                                            : 'Insérer une variable',
                                    )}
                                >
                                    <BracesIcon className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="max-h-72 overflow-y-auto">
                                {variables.map((variable) => (
                                    <DropdownMenuItem
                                        key={variable}
                                        onSelect={() =>
                                            updateCellRef.current(
                                                row.original.id,
                                                column.id,
                                                isSingleVariable
                                                    ? variable
                                                    : `${value}${variable}`,
                                            )
                                        }
                                    >
                                        {variable}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                    const ruleEditor = (active = false) => (
                        <div
                            key={active ? 'configured-type' : 'rule-action'}
                            className={cn(
                                'shrink-0',
                                active &&
                                    '[&_button]:text-violet-600 [&_button]:hover:bg-violet-500/10 [&_button]:hover:text-violet-700 dark:[&_button]:text-violet-400',
                            )}
                        >
                            <FileRuleEditor
                                value={value}
                                variables={variables}
                                blockType={block.type}
                                onApply={(nextValue) =>
                                    updateCellRef.current(
                                        row.original.id,
                                        column.id,
                                        nextValue,
                                    )
                                }
                            />
                        </div>
                    );

                    return (
                        <div className="group/cell flex min-w-44 items-center gap-1.5">
                            {canManage && isSingleVariable
                                ? variablePicker(true)
                                : null}
                            {canManage && isConfigured
                                ? ruleEditor(true)
                                : null}
                            <div
                                key="value-input"
                                className="relative min-w-0 flex-1"
                            >
                                <Input
                                    value={value}
                                    autoFocus={
                                        focusRowIdRef.current ===
                                            row.original.id &&
                                        column.id === block.columns[0]?.id
                                    }
                                    disabled={!canManage}
                                    className={cn(value && canManage && 'pr-8')}
                                    aria-invalid={hasIssue || undefined}
                                    title={
                                        hasIssue
                                            ? tRef.current(
                                                  'Variable inconnue ou indisponible dans ce bloc',
                                              )
                                            : undefined
                                    }
                                    placeholder={tRef.current(
                                        'Texte ou %variable%',
                                    )}
                                    onChange={(event) =>
                                        updateCellRef.current(
                                            row.original.id,
                                            column.id,
                                            event.target.value,
                                        )
                                    }
                                    onFocus={() => {
                                        if (
                                            focusRowIdRef.current ===
                                            row.original.id
                                        ) {
                                            focusRowIdRef.current = null;
                                        }
                                    }}
                                />
                                {value && canManage ? (
                                    <button
                                        type="button"
                                        className="absolute top-1/2 right-1 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                        title={tRef.current('Vider le champ')}
                                        aria-label={tRef.current(
                                            'Vider le champ',
                                        )}
                                        onClick={() =>
                                            updateCellRef.current(
                                                row.original.id,
                                                column.id,
                                                '',
                                            )
                                        }
                                    >
                                        <XIcon className="h-3.5 w-3.5" />
                                    </button>
                                ) : null}
                            </div>
                            {canManage ? (
                                <div
                                    key="secondary-actions"
                                    className="pointer-events-none flex items-center gap-1.5 opacity-0 transition-opacity group-focus-within/cell:pointer-events-auto group-focus-within/cell:opacity-100 group-hover/cell:pointer-events-auto group-hover/cell:opacity-100"
                                >
                                    {!isSingleVariable
                                        ? variablePicker()
                                        : null}
                                    {!isConfigured ? ruleEditor() : null}
                                </div>
                            ) : null}
                        </div>
                    );
                },
            })),
            {
                id: 'actions',
                header: () => null,
                cell: ({ row }: CellContext<FileRow, unknown>) =>
                    canManage ? (
                        <div className="flex items-center gap-0.5 whitespace-nowrap">
                            <div className="flex h-9 w-9 flex-col overflow-hidden rounded-md border border-border/60 bg-transparent">
                                <button
                                    type="button"
                                    className="flex h-1/2 w-full items-center justify-center border-b border-border/60 text-green-600 transition-colors hover:bg-green-500/10 hover:text-green-700 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-green-400"
                                    title={tRef.current(
                                        'Insérer une ligne avant',
                                    )}
                                    aria-label={tRef.current(
                                        'Insérer une ligne avant',
                                    )}
                                    onClick={() =>
                                        insertRowRef.current(
                                            row.original.id,
                                            'before',
                                        )
                                    }
                                >
                                    <ChevronUpIcon className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    className="flex h-1/2 w-full items-center justify-center text-green-600 transition-colors hover:bg-green-500/10 hover:text-green-700 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-green-400"
                                    title={tRef.current(
                                        'Insérer une ligne après',
                                    )}
                                    aria-label={tRef.current(
                                        'Insérer une ligne après',
                                    )}
                                    onClick={() =>
                                        insertRowRef.current(
                                            row.original.id,
                                            'after',
                                        )
                                    }
                                >
                                    <ChevronDownIcon className="h-4 w-4" />
                                </button>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                title={tRef.current('Supprimer la ligne')}
                                aria-label={tRef.current('Supprimer la ligne')}
                                onClick={() =>
                                    removeRowRef.current(row.original.id)
                                }
                            >
                                <TrashIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : null,
            },
        ];
    }, [block.columns, block.type, canManage, context, variablesForBlock]);

    return (
        <section
            className={cn(
                'rounded-lg border border-violet-200 bg-background/90 shadow-sm dark:border-violet-400/25',
                !block.enabled && 'opacity-60',
            )}
        >
            <div className="flex flex-wrap items-center gap-2 border-b border-violet-100 p-3 dark:border-violet-400/20">
                <Input
                    value={block.name}
                    disabled={!canManage}
                    className="min-w-44 flex-1 font-medium"
                    onChange={(event) =>
                        onChange({ ...block, name: event.target.value })
                    }
                />
                <Select
                    value={block.type}
                    disabled={!canManage}
                    onValueChange={(type: FileBlockType) =>
                        onChange({ ...block, type })
                    }
                >
                    <SelectTrigger className="w-52">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(blockLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {t(label)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <label className="flex items-center gap-2 text-sm">
                    <Input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={block.show_headers}
                        disabled={!canManage}
                        onChange={(event) =>
                            onChange({
                                ...block,
                                show_headers: event.target.checked,
                            })
                        }
                    />
                    {t('Afficher les titres')}
                </label>
            </div>

            <div className="space-y-3 p-3">
                <div className="flex items-center gap-2">
                    <Badge variant="outline">
                        {block.type === 'items'
                            ? t('Répété pour chaque produit')
                            : t('Généré une fois')}
                    </Badge>
                </div>
                <div className="overflow-x-auto">
                    <DataTable
                        columns={columns}
                        data={block.rows}
                        emptyMessage={
                            canManage ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        insertRowRef.current(null, 'after')
                                    }
                                >
                                    <PlusIcon className="mr-2 h-4 w-4" />
                                    {t('Ajouter la première ligne')}
                                </Button>
                            ) : (
                                t('Aucune ligne dans ce bloc')
                            )
                        }
                        getRowId={(row) => row.id}
                        stickyEndColumnId="actions"
                        columnInsertLabel={t('Ajouter une colonne ici')}
                        onColumnInsert={canManage ? insertColumn : undefined}
                        headerControls={(columnId) => {
                            const column = block.columns.find(
                                (item) => item.id === columnId,
                            );
                            if (!column || !canManage) return null;
                            return {
                                editable: true,
                                deletable: true,
                                draggable: true,
                                value: column.name,
                                onChange: (name) =>
                                    renameColumn(column.id, name),
                                onDelete: () => removeColumn(column.id),
                            };
                        }}
                        onColumnReorder={(activeColumnId, overColumnId) => {
                            const from = block.columns.findIndex(
                                (column) => column.id === activeColumnId,
                            );
                            const to = block.columns.findIndex(
                                (column) => column.id === overColumnId,
                            );
                            if (from < 0 || to < 0) return;
                            onChange({
                                ...block,
                                columns: arrayMove(block.columns, from, to),
                            });
                        }}
                    />
                </div>
            </div>
        </section>
    );
}

type CompactBlockProps = {
    block: FileBlock;
    canManage: boolean;
    selected: boolean;
    onEdit: () => void;
    onToggle: () => void;
    onDelete: () => void;
};

export function CompactBlock({
    block,
    canManage,
    selected,
    onEdit,
    onToggle,
    onDelete,
}: CompactBlockProps) {
    const { t } = useI18n();
    const { blockLabels } = useFileEditor();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: block.id, disabled: !canManage });

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={cn(
                'flex items-center gap-2 rounded-md border bg-background px-2 py-2 transition-colors',
                selected &&
                    'border-violet-400 bg-violet-50/70 dark:border-violet-400/50 dark:bg-violet-500/10',
                isDragging && 'z-10 opacity-70 shadow-lg',
                !block.enabled && 'opacity-60',
            )}
        >
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="cursor-grab touch-none text-muted-foreground"
                disabled={!canManage}
                title={t('Déplacer le bloc')}
                aria-label={t('Déplacer le bloc')}
                {...attributes}
                {...listeners}
            >
                <GripVerticalIcon className="h-4 w-4" />
            </Button>
            <button
                type="button"
                className="min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={onEdit}
            >
                <span className="block truncate text-sm font-medium">
                    {block.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                    {t(blockLabels[block.type])} · {block.columns.length}{' '}
                    {t('colonnes')} · {block.rows.length} {t('lignes')}
                </span>
            </button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                    'h-8 text-xs',
                    block.enabled
                        ? 'bg-green-500/10 text-green-700 hover:bg-green-500/15 hover:text-green-800 dark:text-green-400'
                        : 'bg-muted text-muted-foreground',
                )}
                disabled={!canManage}
                title={t(
                    block.enabled ? 'Désactiver le bloc' : 'Activer le bloc',
                )}
                onClick={onToggle}
            >
                {t(block.enabled ? 'Actif' : 'Inactif')}
            </Button>
            {canManage ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    title={t('Supprimer le bloc')}
                    aria-label={t('Supprimer le bloc')}
                    onClick={onDelete}
                >
                    <TrashIcon className="h-4 w-4" />
                </Button>
            ) : null}
        </div>
    );
}

export function FileBlocksEditor({
    blocks,
    onChange,
    canManage = true,
    initiallyOpen = false,
}: {
    blocks: FileBlock[];
    onChange: (blocks: FileBlock[]) => void;
    canManage?: boolean;
    initiallyOpen?: boolean;
}) {
    const { t } = useI18n();
    const { blockLabels } = useFileEditor();
    const [newBlockType, setNewBlockType] = useState<FileBlockType>('header');
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
        initiallyOpen ? (blocks[0]?.id ?? null) : null,
    );
    const file = useMemo(() => ({ blocks }), [blocks]);
    const updateFile = useCallback(
        (next: { blocks: FileBlock[] }) => onChange(next.blocks),
        [onChange],
    );
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const updateBlock = useCallback(
        (blockId: string, block: FileBlock) =>
            updateFile({
                ...file,
                blocks: file.blocks.map((item) =>
                    item.id === blockId ? block : item,
                ),
            }),
        [file, updateFile],
    );

    const addBlock = () => {
        const id = uniqueId('block');
        const columnId = uniqueId('column');
        updateFile({
            ...file,
            blocks: [
                ...file.blocks,
                {
                    id,
                    name: t(blockLabels[newBlockType]),
                    type: newBlockType,
                    enabled: true,
                    show_headers: newBlockType === 'items',
                    columns: [
                        {
                            id: columnId,
                            name: `${t('Colonne')} 1`,
                        },
                    ],
                    rows: [
                        {
                            id: uniqueId('row'),
                            cells: { [columnId]: '' },
                        },
                    ],
                },
            ],
        });
        setSelectedBlockId(id);
    };

    const handleDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        const from = file.blocks.findIndex((block) => block.id === active.id);
        const to = file.blocks.findIndex((block) => block.id === over.id);
        if (from < 0 || to < 0) return;
        updateFile({ ...file, blocks: arrayMove(file.blocks, from, to) });
    };

    return (
        <div className="space-y-4">
            {' '}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Sélectionnez un bloc pour modifier ses colonnes et ses lignes.',
                    )}
                </p>
                {canManage ? (
                    <div className="flex items-center gap-2">
                        <Select
                            value={newBlockType}
                            onValueChange={(value: FileBlockType) =>
                                setNewBlockType(value)
                            }
                        >
                            <SelectTrigger className="w-52">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(blockLabels).map(
                                    ([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {t(label)}
                                        </SelectItem>
                                    ),
                                )}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={addBlock}
                        >
                            <PlusIcon className="size-4" />
                            {t('Ajouter un bloc')}
                        </Button>
                    </div>
                ) : null}
            </div>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={file.blocks.map((block) => block.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-2">
                        {file.blocks.map((block) => (
                            <div key={block.id} className="space-y-2">
                                <CompactBlock
                                    block={block}
                                    canManage={canManage}
                                    selected={selectedBlockId === block.id}
                                    onEdit={() =>
                                        setSelectedBlockId(
                                            selectedBlockId === block.id
                                                ? null
                                                : block.id,
                                        )
                                    }
                                    onToggle={() =>
                                        updateBlock(block.id, {
                                            ...block,
                                            enabled: !block.enabled,
                                        })
                                    }
                                    onDelete={() => {
                                        if (selectedBlockId === block.id)
                                            setSelectedBlockId(null);
                                        updateFile({
                                            ...file,
                                            blocks: file.blocks.filter(
                                                (item) => item.id !== block.id,
                                            ),
                                        });
                                    }}
                                />
                                {selectedBlockId === block.id ? (
                                    <BlockEditor
                                        block={block}
                                        canManage={canManage}
                                        onChange={(next) =>
                                            updateBlock(block.id, next)
                                        }
                                    />
                                ) : null}
                            </div>
                        ))}
                    </div>
                </SortableContext>
            </DndContext>
            {file.blocks.length === 0 ? (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                    {t('Ajoutez un premier bloc pour construire le fichier.')}
                </div>
            ) : null}
        </div>
    );
}
