import { CirclePlus, DownloadIcon, Loader2Icon, RotateCcw, SaveIcon, TrashIcon, UploadIcon } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { on } from "events";
import { ReactNode } from "react";

type Props = {
    import?: ReactNode;
    export?: string | (() => void);
    save?: () => void;
    cancel?: () => void;
    add?: () => void;
    delete?: () => void;
    saving?: boolean;
    className?: string;
};

export function ButtonsActions({
    import: onImport,
    export: onExport,
    save: onSave,
    cancel: onCancel,
    add: onAdd,
    delete: onDelete,
    saving,
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