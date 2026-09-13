import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { ImageIcon, Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type UserExportImage = {
    id: number;
    name: string;
    thumb_url: string;
    document_url: string;
};

export function UserExportImagePicker({
    value,
    onChange,
}: {
    value: number | null;
    onChange: (id: number) => void;
}) {
    const { t } = useI18n();
    const { csrf_token: csrfToken } = usePage<SharedData>().props;
    const inputRef = useRef<HTMLInputElement>(null);
    const [images, setImages] = useState<UserExportImage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const readResponse = async (response: Response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok)
            throw new Error(
                (Object.values(payload?.errors ?? {}).flat()[0] as string) ||
                    payload?.message ||
                    t('Impossible de charger les images.'),
            );
        return payload;
    };
    useEffect(() => {
        let cancelled = false;
        void fetch('/file-export-images', {
            headers: { Accept: 'application/json' },
        })
            .then(readResponse)
            .then((items: UserExportImage[]) => {
                if (!cancelled) setImages(items);
            })
            .catch((exception: Error) => {
                if (!cancelled) setError(exception.message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // The personal library is loaded once when this picker opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const upload = async (file?: File) => {
        if (!file) return;
        setLoading(true);
        setError(null);
        try {
            const body = new FormData();
            body.append('image', file);
            const response = await fetch('/file-export-images', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken ?? '',
                },
                body,
            });
            const image = (await readResponse(response)) as UserExportImage;
            setImages((items) => [...items, image]);
            onChange(image.id);
        } catch (exception) {
            setError((exception as Error).message);
        } finally {
            setLoading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-3">
            <Input
                ref={inputRef}
                className="hidden"
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={(event) => void upload(event.target.files?.[0])}
            />
            <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => inputRef.current?.click()}
            >
                {loading ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <Upload className="size-4" />
                )}
                {t('Téléverser une image')}
            </Button>
            <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
                {images.map((image) => (
                    <button
                        key={image.id}
                        type="button"
                        aria-pressed={value === image.id}
                        className={`space-y-2 rounded-lg border p-2 text-left ${value === image.id ? 'border-primary ring-2 ring-primary/20' : ''}`}
                        onClick={() => onChange(image.id)}
                    >
                        <img
                            src={image.thumb_url}
                            alt=""
                            className="h-24 w-full rounded object-contain"
                        />
                        <span className="block truncate text-xs">
                            {image.name}
                        </span>
                    </button>
                ))}
            </div>
            {!loading && images.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ImageIcon className="size-4" />
                    {t('Aucune image enregistrée.')}
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
