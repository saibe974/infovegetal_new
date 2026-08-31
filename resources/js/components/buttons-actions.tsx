import { useI18n } from '@/lib/i18n';
import {
    CirclePlus,
    EyeIcon,
    Loader2Icon,
    PencilIcon,
    RefreshCw,
    RotateCcw,
    SaveIcon,
    TrashIcon,
    UploadIcon,
    UserRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './ui/button';

type Props = {
    import?: ReactNode;
    export?: string | (() => void);
    exportLabel?: string;
    preview?: () => void;
    refresh?: () => void;
    save?: () => void;
    cancel?: () => void;
    reset?: () => void;
    edit?: () => void;
    add?: () => void;
    delete?: () => void;
    impersonate?: () => void;
    saving?: boolean;
    refreshing?: boolean;
    saveDisabled?: boolean;
    className?: string;
};

export function ButtonsActions({
    import: onImport,
    export: onExport,
    exportLabel,
    preview: onPreview,
    refresh: onRefresh,
    save: onSave,
    cancel: onCancel,
    reset: onReset,
    edit: onEdit,
    add: onAdd,
    delete: onDelete,
    impersonate: onImpersonate,
    saving,
    refreshing,
    saveDisabled = false,
    className,
}: Props) {
    const { t } = useI18n();

    return (
        <div
            className={`ml-auto flex items-center justify-between gap-2 ${className ?? ''}`}
        >
            {onCancel && (
                <Button
                    type="button"
                    onClick={onCancel}
                    variant={'destructive-outline'}
                    title={t('Cancel')}
                    disabled={saving}
                    size={'icon'}
                >
                    <RotateCcw size={10} />
                </Button>
            )}

            {onReset && (
                <Button
                    type="button"
                    onClick={onReset}
                    variant={'destructive-outline'}
                    title={t('Reset to defaults')}
                    disabled={saving}
                    size={'icon'}
                >
                    <RotateCcw />
                </Button>
            )}

            {onImport && onImport}

            {onExport && (
                <Button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (typeof onExport === 'function') onExport();
                    }}
                    variant={'outline'}
                    title={exportLabel ?? t('Export CSV')}
                    aria-label={exportLabel ?? t('Export CSV')}
                    disabled={saving}
                    size={'icon'}
                >
                    <a
                        href={
                            typeof onExport === 'string' ? onExport : undefined
                        }
                    >
                        <UploadIcon />
                    </a>
                </Button>
            )}

            {onPreview && (
                <Button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onPreview();
                    }}
                    variant={'outline'}
                    title={t('Preview')}
                    disabled={saving}
                    size={'icon'}
                >
                    <EyeIcon />
                </Button>
            )}

            {onRefresh && (
                <Button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRefresh();
                    }}
                    variant={'outline'}
                    title={t('Refresh')}
                    disabled={saving || refreshing}
                    size={'icon'}
                >
                    {refreshing ? (
                        <Loader2Icon className="animate-spin" />
                    ) : (
                        <RefreshCw />
                    )}
                </Button>
            )}

            {onEdit && (
                <Button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                    variant={'outline'}
                    title={t('Edit')}
                    disabled={saving}
                    size={'icon'}
                >
                    <PencilIcon />
                </Button>
            )}

            {onSave && (
                <Button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSave();
                    }}
                    title={t('Save')}
                    disabled={saving || saveDisabled}
                    size={'icon'}
                    className="bg-green-700 text-white hover:bg-green-800"
                >
                    {saving ? (
                        <>
                            <Loader2Icon className="animate-spin" />
                        </>
                    ) : (
                        <>
                            <SaveIcon />
                        </>
                    )}
                </Button>
            )}

            {onAdd && (
                <Button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAdd();
                    }}
                    title={t('Add')}
                    disabled={saving}
                    size={'icon'}
                    variant={'outline'}
                    className="border-green-500 text-green-500 hover:bg-green-500/30 hover:text-green-500"
                >
                    <CirclePlus />
                </Button>
            )}

            {onDelete && (
                <Button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    variant={'destructive-outline'}
                    title={t('Delete')}
                    disabled={saving}
                    size={'icon'}
                >
                    <TrashIcon />
                </Button>
            )}

            {onImpersonate && (
                <Button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onImpersonate();
                    }}
                    variant={'outline'}
                    title={t('Impersonate')}
                    disabled={saving}
                    size={'icon'}
                >
                    <UserRound />
                </Button>
            )}
        </div>
    );
}
