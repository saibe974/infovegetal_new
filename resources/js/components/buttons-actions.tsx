import { CirclePlus, DownloadIcon, EyeIcon, Loader2Icon, PencilIcon, RefreshCw, RotateCcw, SaveIcon, TrashIcon, UploadIcon } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { ReactNode } from "react";

type Props = {
    import?: ReactNode;
    export?: string | (() => void);
    preview?: () => void;
    refresh?: () => void;
    save?: () => void;
    cancel?: () => void;
    edit?: () => void;
    add?: () => void;
    delete?: () => void;
    saving?: boolean;
    refreshing?: boolean;
    className?: string;
};

export function ButtonsActions({
    import: onImport,
    export: onExport,
    preview: onPreview,
    refresh: onRefresh,
    save: onSave,
    cancel: onCancel,
    edit: onEdit,
    add: onAdd,
    delete: onDelete,
    saving,
    refreshing,
    className,
}: Props) {
    const { t } = useI18n();

    return (
        <div className={`flex items-center gap-2 justify-between ml-auto ${className}`}>
            {onCancel &&
                <Button onClick={onCancel} variant={'destructive-outline'} title={t('Cancel')} disabled={saving} size={'icon'}>
                    <RotateCcw size={10} />
                </Button>
            }

            {onImport &&
                // <Button onClick={onImport} variant={'outline'} title={t('Upload CSV')} disabled={saving} size={'icon'}>
                //     <DownloadIcon />
                // </Button>
                onImport
            }

            {onExport &&
                <Button onClick={typeof onExport === 'function' ? onExport : undefined} variant={'outline'} title={t('Export CSV')} disabled={saving} size={'icon'}>
                    <a href={typeof onExport === 'string' ? onExport : undefined}>
                        <UploadIcon />
                    </a>
                </Button>
            }

            {onDelete &&
                <Button onClick={onDelete} variant={'destructive-outline'} title={t('Delete')} disabled={saving} size={'icon'}>
                    <TrashIcon />
                </Button>
            }

            {onPreview &&
                <Button onClick={onPreview} variant={'outline'} title={t('Preview')} disabled={saving} size={'icon'}>
                    <EyeIcon />
                </Button>
            }

            {onRefresh &&
                <Button onClick={onRefresh} variant={'outline'} title={t('Refresh')} disabled={saving || refreshing} size={'icon'}>
                    {refreshing ? <Loader2Icon className="animate-spin" /> : <RefreshCw />}
                </Button>
            }

            {onEdit &&
                <Button onClick={onEdit} variant={'outline'} title={t('Edit')} disabled={saving} size={'icon'}>
                    <PencilIcon />
                </Button>
            }

            {onSave &&
                <Button onClick={onSave} title={t('Save')} disabled={saving} size={'icon'} className="bg-green-700 hover:bg-green-800 text-white">
                    {saving ?
                        <>
                            <Loader2Icon className="animate-spin" />
                        </>

                        :
                        <>
                            <SaveIcon />
                        </>

                    }
                </Button>
            }

            {onAdd &&
                <Button onClick={onAdd} title={t('Add')} disabled={saving} size={'icon'} variant={'outline'} className="text-green-500 hover:text-green-500 hover:bg-green-500/30 border-green-500">
                    <CirclePlus />
                </Button>
            }
        </div>
    );
}