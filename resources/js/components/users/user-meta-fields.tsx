import { ButtonsActions } from '@/components/buttons-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PdfFileIcon } from '@/components/ui/pdf-file-icon';
import { useForm } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type UserMetaDraft = {
    id: number;
    key: string;
    title: string;
    value: string;
    value_json: Record<string, string>;
    value_file: File | null;
    type: string;
    sort_order: number;
};

type MetaFormPayload = Omit<UserMetaDraft, 'id'> & { custom_key: string };

type Props = {
    value: UserMetaDraft[];
    onChange: (value: UserMetaDraft[]) => void;
    metaKeyOptions: Array<{ value: string; label: string }>;
    metaKeyConfig: Record<string, { input: string; fields: string[] }>;
};

const emptyJsonValue = () => ({ number: '', road: '', zip: '', town: '' });

function safeJson(value: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function persistedFileUrl(raw: string): string {
    const decoded = safeJson(raw);
    return decoded && typeof decoded.url === 'string' ? decoded.url : raw;
}

function displayValue(item: UserMetaDraft): string {
    if (item.value_file) return item.value_file.name;
    const decoded = safeJson(item.value);
    if (decoded && typeof decoded.file_name === 'string' && decoded.file_name)
        return decoded.file_name;
    if (item.type === 'json' && decoded)
        return Object.values(decoded).filter(Boolean).join(', ') || '—';
    return item.value || '—';
}

function imageUrl(raw: string): string | null {
    const persisted = persistedFileUrl(raw).trim();
    if (!persisted) return null;
    if (/^(https?:|data:|\/)/.test(persisted)) return persisted;
    return `/storage/${persisted}`;
}

function useFilePreview(file: File | null): string | null {
    const [preview, setPreview] = useState<string | null>(null);
    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    return preview;
}

function ValueInput({
    inputKind,
    fields,
    data,
    setData,
}: {
    inputKind: string;
    fields: string[];
    data: MetaFormPayload;
    setData: (
        key: keyof MetaFormPayload,
        value: MetaFormPayload[keyof MetaFormPayload],
    ) => void;
}) {
    const selectedPreview = useFilePreview(data.value_file);
    const persistedPreview = imageUrl(data.value);

    if (inputKind === 'textarea') {
        return (
            <textarea
                className="min-h-24 w-full rounded-md border p-3"
                placeholder="Valeur"
                value={data.value}
                onChange={(e) => setData('value', e.target.value)}
            />
        );
    }
    if (inputKind === 'json') {
        return (
            <div className="grid gap-3 md:grid-cols-2">
                {(fields.length
                    ? fields
                    : ['number', 'road', 'zip', 'town']
                ).map((field) => (
                    <Input
                        key={field}
                        placeholder={field}
                        value={data.value_json[field] ?? ''}
                        onChange={(e) =>
                            setData('value_json', {
                                ...data.value_json,
                                [field]: e.target.value,
                            })
                        }
                    />
                ))}
            </div>
        );
    }
    if (inputKind === 'file/image') {
        return (
            <div className="space-y-3">
                <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                        setData('value_file', e.target.files?.[0] ?? null)
                    }
                />
                {(selectedPreview || persistedPreview) && (
                    <img
                        src={selectedPreview ?? persistedPreview ?? ''}
                        alt="Aperçu image"
                        className="max-h-52 rounded-md border object-contain"
                    />
                )}
            </div>
        );
    }
    if (inputKind === 'file/pdf') {
        return (
            <div className="space-y-2">
                <Input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) =>
                        setData('value_file', e.target.files?.[0] ?? null)
                    }
                />
                {(data.value_file || data.value) && (
                    <p className="text-sm text-muted-foreground">
                        {data.value_file?.name ??
                            displayValue({ ...data, id: 0 })}
                    </p>
                )}
            </div>
        );
    }
    return (
        <Input
            type={
                inputKind === 'mail'
                    ? 'email'
                    : inputKind.includes('tel')
                      ? 'tel'
                      : 'text'
            }
            placeholder="Valeur"
            value={data.value}
            onChange={(e) => setData('value', e.target.value)}
        />
    );
}

function MetaCard({
    item,
    onEdit,
    onDelete,
    onPreview,
}: {
    item: UserMetaDraft;
    onEdit: () => void;
    onDelete: () => void;
    onPreview: (url: string) => void;
}) {
    const isPdf = item.type === 'file/pdf';
    const selectedUrl = useFilePreview(isPdf ? item.value_file : null);
    const pdfUrl = selectedUrl ?? (isPdf ? persistedFileUrl(item.value) : '');
    const displayedValue = displayValue(item);
    return (
        <Card className="gap-2 py-4 shadow-none">
            <CardContent className="flex items-start gap-3 px-4">
                <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                        {item.title}
                    </p>
                    {pdfUrl ? (
                        <button
                            type="button"
                            className="flex max-w-full min-w-0 items-center gap-2 text-left hover:underline"
                            onClick={() => onPreview(pdfUrl)}
                            title={displayedValue}
                        >
                            <span className="shrink-0">
                                <PdfFileIcon />
                            </span>
                            <span className="min-w-0 truncate">
                                {displayedValue}
                            </span>
                        </button>
                    ) : (
                        <p className="break-words whitespace-pre-wrap">
                            {displayValue(item)}
                        </p>
                    )}
                </div>
                <ButtonsActions edit={onEdit} delete={onDelete} />
            </CardContent>
        </Card>
    );
}

export function UserMetaFields({
    value,
    onChange,
    metaKeyOptions,
    metaKeyConfig,
}: Props) {
    const options = useMemo(
        () =>
            metaKeyOptions.filter(
                (option) => !['logo', 'custom'].includes(option.value),
            ),
        [metaKeyOptions],
    );
    const firstOption = options[0];
    const form = useForm<MetaFormPayload>({
        key: firstOption?.value ?? 'custom',
        title: firstOption?.label ?? '',
        custom_key: '',
        value: '',
        value_json: emptyJsonValue(),
        value_file: null,
        type: '',
        sort_order: 0,
    });
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [pdfViewer, setPdfViewer] = useState<{
        title: string;
        url: string;
    } | null>(null);
    const nextId = useRef(Math.min(-1, ...value.map((item) => item.id - 1)));
    const actualKey =
        form.data.key === 'custom'
            ? form.data.custom_key.trim()
            : form.data.key;
    const inputKind = actualKey
        ? (metaKeyConfig[actualKey]?.input ?? 'input')
        : 'input';
    const fields = metaKeyConfig[actualKey]?.fields ?? [];

    const close = () => {
        form.reset();
        form.clearErrors();
        setEditingId(null);
        setOpen(false);
    };
    const create = () => {
        form.reset();
        form.clearErrors();
        setEditingId(null);
        setOpen(true);
    };
    const edit = (item: UserMetaDraft) => {
        const known = options.some((option) => option.value === item.key);
        form.setData({
            key: known ? item.key : 'custom',
            title: item.title,
            custom_key: known ? '' : item.key,
            value: item.value,
            value_json: item.value_json,
            value_file: item.value_file,
            type: item.type,
            sort_order: item.sort_order,
        });
        form.clearErrors();
        setEditingId(item.id);
        setOpen(true);
    };
    const commit = () => {
        if (!actualKey) {
            form.setError('key', 'La clé est obligatoire.');
            return;
        }
        if (form.data.key !== 'custom' && !form.data.title.trim()) {
            form.setError('title', 'Le titre est obligatoire.');
            return;
        }
        const draft: UserMetaDraft = {
            id: editingId ?? nextId.current--,
            key: actualKey,
            title:
                form.data.key === 'custom'
                    ? form.data.custom_key.trim()
                    : form.data.title.trim(),
            value:
                inputKind === 'json'
                    ? JSON.stringify(form.data.value_json)
                    : form.data.value,
            value_json: form.data.value_json,
            value_file: form.data.value_file,
            type: inputKind,
            sort_order:
                editingId === null ? value.length : form.data.sort_order,
        };
        onChange(
            editingId === null
                ? [...value, draft]
                : value.map((item) => (item.id === editingId ? draft : item)),
        );
        close();
    };

    return (
        <>
            <Card>
                <CardHeader className="flex-row items-center justify-between pb-3">
                    <CardTitle className="text-lg">
                        Informations supplémentaires
                    </CardTitle>
                    {!open && <ButtonsActions add={create} />}
                </CardHeader>
                <CardContent className="space-y-3">
                    {value.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {value.map((item) => (
                                <MetaCard
                                    key={item.id}
                                    item={item}
                                    onEdit={() => edit(item)}
                                    onDelete={() =>
                                        onChange(
                                            value.filter(
                                                (candidate) =>
                                                    candidate.id !== item.id,
                                            ),
                                        )
                                    }
                                    onPreview={(url) =>
                                        setPdfViewer({ title: item.title, url })
                                    }
                                />
                            ))}
                        </div>
                    )}
                    {value.length === 0 && !open && (
                        <p className="text-sm text-muted-foreground">
                            Aucune information supplémentaire.
                        </p>
                    )}
                    {open && (
                        <div className="space-y-4 rounded-md border border-green-200 bg-green-50/60 p-4 dark:border-green-900 dark:bg-green-950/20">
                            <div className="grid gap-2">
                                <Label>Type</Label>
                                <select
                                    className="h-10 rounded-md border bg-card px-3"
                                    value={form.data.key}
                                    onChange={(e) => {
                                        const key = e.target.value;
                                        const option = options.find(
                                            (candidate) =>
                                                candidate.value === key,
                                        );
                                        form.setData((data) => ({
                                            ...data,
                                            key,
                                            title:
                                                key === 'custom'
                                                    ? ''
                                                    : (option?.label ?? ''),
                                            value: '',
                                            value_json: emptyJsonValue(),
                                            value_file: null,
                                        }));
                                    }}
                                >
                                    {options.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                    <option value="custom">Custom</option>
                                </select>
                            </div>
                            {form.data.key === 'custom' ? (
                                <div className="grid gap-2">
                                    <Label>Nom du champ</Label>
                                    <Input
                                        value={form.data.custom_key}
                                        onChange={(e) =>
                                            form.setData(
                                                'custom_key',
                                                e.target.value,
                                            )
                                        }
                                    />
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    <Label>Titre</Label>
                                    <Input
                                        value={form.data.title}
                                        onChange={(e) =>
                                            form.setData(
                                                'title',
                                                e.target.value,
                                            )
                                        }
                                    />
                                    {form.errors.title && (
                                        <p className="text-sm text-destructive">
                                            {form.errors.title}
                                        </p>
                                    )}
                                </div>
                            )}
                            {form.errors.key && (
                                <p className="text-sm text-destructive">
                                    {form.errors.key}
                                </p>
                            )}
                            <ValueInput
                                inputKind={inputKind}
                                fields={fields}
                                data={form.data}
                                setData={form.setData}
                            />
                            <div className="flex gap-2">
                                <Button type="button" onClick={commit}>
                                    {editingId === null
                                        ? 'Ajouter'
                                        : 'Modifier'}
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={close}
                                >
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog
                open={pdfViewer !== null}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setPdfViewer(null);
                }}
            >
                <DialogContent className="h-[90vh] grid-rows-[auto_1fr] gap-0 overflow-hidden p-0 sm:max-w-6xl">
                    <DialogHeader className="border-b px-6 py-4 pr-12">
                        <DialogTitle>{pdfViewer?.title}</DialogTitle>
                    </DialogHeader>
                    {pdfViewer && (
                        <iframe
                            src={pdfViewer.url}
                            title={pdfViewer.title}
                            className="h-full min-h-0 w-full border-0"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
