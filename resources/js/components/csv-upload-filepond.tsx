import { useState, useRef } from 'react';
import { router } from '@inertiajs/react';
import { DownloadIcon, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

// FilePond imports
import { FilePond } from 'react-filepond';
import 'filepond/dist/filepond.min.css';

type CsvUploadConfig = {
    /** Titre de la boîte de dialogue */
    title: string;
    /** Description affichée dans la boîte de dialogue */
    description: string;
    /** URL pour uploader le fichier */
    uploadUrl: string;
    /** URL de redirection après succès */
    successRedirectUrl?: string;
    /** Libellé du bouton (optionnel, par défaut "Importer") */
    buttonLabel?: string;
    /** Classe CSS personnalisée pour le bouton (optionnel) */
    buttonClassName?: string;
};

type CsvUploadFilePondProps = {
    config: CsvUploadConfig;
};

export function CsvUploadFilePond({ config }: CsvUploadFilePondProps) {
    const [open, setOpen] = useState(false);
    const [files, setFiles] = useState<any[]>([]);
    const [uploadComplete, setUploadComplete] = useState(false);
    const pondRef = useRef<FilePond>(null);

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
        if (meta?.content) return meta.content;
        const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
        return match ? decodeURIComponent(match[1]) : null;
    };

    const handleCancel = () => {
        setFiles([]);
        setUploadComplete(false);
        setOpen(false);
    };

    const handleClose = () => {
        if (config.successRedirectUrl) {
            router.visit(config.successRedirectUrl);
        } else {
            setOpen(false);
            setFiles([]);
            setUploadComplete(false);
        }
    };

    const csrfToken = getCsrfToken() || '';

    const handleServerResponse = (response: any) => {
        const rawResponse = typeof response === 'string'
            ? response
            : response?.responseText ?? '';

        if (!rawResponse) {
            return response;
        }

        try {
            const json = JSON.parse(rawResponse);
            // console.log('Upload response:', json);

            if (json.id || json.file) {
                setUploadComplete(true);
            }

            return json.id ?? json.uploadId ?? json.file ?? rawResponse;
        } catch (error) {
            console.warn('Server response is not valid JSON:', rawResponse, error);
            return rawResponse || response;
        }
    };

    const handleServerError = (response: any) => {
        const rawResponse = typeof response === 'string'
            ? response
            : response?.responseText ?? '';
        console.error('Upload error:', rawResponse || response);
        return rawResponse || response;
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={config.buttonClassName ?? "clickable inline-flex items-center border px-3 py-1 rounded text-sm"}
                >
                    <DownloadIcon />
                    {config.buttonLabel ?? ''}
                </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{config.title}</DialogTitle>
                    <DialogDescription>{config.description}</DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {!uploadComplete ? (
                        <FilePond
                            ref={pondRef}
                            files={files}
                            onupdatefiles={setFiles}
                            allowMultiple={false}
                            maxFiles={1}
                            chunkUploads={true}
                            chunkSize={1000000}
                            chunkRetryDelays={[500, 1000, 3000]}
                            server={{
                                url: config.uploadUrl,
                                process: {
                                    url: '',
                                    method: 'POST',
                                    headers: {
                                        'X-CSRF-TOKEN': csrfToken,
                                    },
                                    onload: handleServerResponse,
                                    onerror: handleServerError,
                                },
                                patch: {
                                    url: '?patch=',
                                    headers: {
                                        'X-CSRF-TOKEN': csrfToken,
                                    },
                                    onload: handleServerResponse,
                                    onerror: handleServerError,
                                },
                                revert: null,
                            }}
                            name="file"
                            labelIdle='Glissez-déposez votre fichier ou <span class="filepond--label-action">Parcourir</span>'
                            // acceptedFileTypes={['text/csv', 'application/vnd.ms-excel', '.csv']}
                            credits={false}
                        />
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-green-600 font-medium">✓ Fichier uploadé avec succès</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {uploadComplete ? (
                        <button
                            type="button"
                            onClick={handleClose}
                            className="inline-flex items-center border px-3 py-1 rounded text-sm bg-primary text-primary-foreground"
                        >
                            Fermer
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="inline-flex items-center border px-3 py-1 rounded text-sm"
                        >
                            Annuler
                        </button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

