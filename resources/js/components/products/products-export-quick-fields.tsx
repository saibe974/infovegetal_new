import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/lib/i18n';

type Props = {
    format: 'csv' | 'xlsx';
    onFormatChange: (format: 'csv' | 'xlsx') => void;
    columns: { key: string; label: string }[];
    selected: string[];
    onSelectionChange: (columns: string[]) => void;
    disabled: boolean;
};

export function ProductsExportQuickFields({
    format,
    onFormatChange,
    columns,
    selected,
    onSelectionChange,
    disabled,
}: Props) {
    const { t } = useI18n();

    return (
        <div className="space-y-6">
            <fieldset disabled={disabled} className="space-y-3">
                <legend className="mb-2 text-sm font-medium">
                    {t('Format du fichier')}
                </legend>
                <div className="grid gap-3 sm:grid-cols-3">
                    {(['csv', 'xlsx'] as const).map((value) => (
                        <label
                            key={value}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${format === value ? 'border-primary bg-primary/5' : ''}`}
                        >
                            <input
                                type="radio"
                                name="quick-export-format"
                                checked={format === value}
                                onChange={() => onFormatChange(value)}
                            />
                            {value === 'csv' ? 'CSV' : 'Excel (.xlsx)'}
                        </label>
                    ))}
                    <label className="flex items-center gap-2 rounded-lg border p-3 text-sm opacity-50">
                        <input
                            type="radio"
                            name="quick-export-format"
                            disabled
                        />
                        <span>
                            PDF{' '}
                            <span className="text-xs">— {t('À venir')}</span>
                        </span>
                    </label>
                </div>
                <p className="text-sm text-muted-foreground">
                    {format === 'csv'
                        ? t(
                              'CSV : adapté aux gros volumes. Les images sont exportées sous forme d’URL.',
                          )
                        : t(
                              'Excel : seules les miniatures déjà créées et disponibles sont intégrées. Sinon, la cellule reste vide. Aucune image n’est générée.',
                          )}
                </p>
            </fieldset>
            <fieldset disabled={disabled} className="space-y-3">
                <legend className="mb-2 text-sm font-medium">
                    {t('Données à exporter')}
                </legend>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() =>
                            onSelectionChange(columns.map(({ key }) => key))
                        }
                    >
                        {t('Tout sélectionner')}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        onClick={() => onSelectionChange([])}
                    >
                        {t('Tout désélectionner')}
                    </Button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                    {columns.map(({ key, label }) => (
                        <label
                            key={key}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                            <Checkbox
                                checked={selected.includes(key)}
                                disabled={disabled}
                                onCheckedChange={(checked) =>
                                    onSelectionChange(
                                        columns
                                            .map((column) => column.key)
                                            .filter((column) =>
                                                column === key
                                                    ? checked === true
                                                    : selected.includes(column),
                                            ),
                                    )
                                }
                            />
                            {t(label)}
                        </label>
                    ))}
                </div>
                {selected.length === 0 && (
                    <p role="status" className="text-sm text-muted-foreground">
                        {t('Sélectionnez au moins une colonne.')}
                    </p>
                )}
            </fieldset>
        </div>
    );
}
