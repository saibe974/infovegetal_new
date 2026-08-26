import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import type { ViewMode } from '@/components/ui/view-mode-toggle';
import type {
    AccentColor,
    DisplayDensity,
    DisplayPreferences,
    PreferencePage,
} from '@/lib/display-preferences';
import {
    Check,
    LayoutGrid,
    ListCollapse,
    Monitor,
    Moon,
    PanelRight,
    Sun,
    Table2,
    type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

const accents: Array<{ value: AccentColor; label: string }> = [
    { value: 'brand', label: 'Marque' },
    { value: 'green', label: 'Vert' },
    { value: 'blue', label: 'Bleu' },
    { value: 'neutral', label: 'Neutre' },
];

const pageLabels: Record<PreferencePage, string> = {
    products: 'Produits',
    users: 'Utilisateurs',
};

const pageViews: Record<
    PreferencePage,
    Array<{ value: ViewMode; label: string; icon: LucideIcon }>
> = {
    products: [
        { value: 'table', label: 'Tableau', icon: Table2 },
        { value: 'list', label: 'Petites cartes', icon: ListCollapse },
        { value: 'grid', label: 'Grille', icon: LayoutGrid },
    ],
    users: [
        { value: 'accordion', label: 'Accordéon', icon: ListCollapse },
        { value: 'grid', label: 'Cartes', icon: LayoutGrid },
    ],
};

function ChoiceButton({
    active,
    children,
    onClick,
}: {
    active: boolean;
    children: ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            className="appearance-choice"
            aria-pressed={active}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

type GeneralProps = {
    preferences: DisplayPreferences['general'];
    onChange: <K extends keyof DisplayPreferences['general']>(
        key: K,
        value: DisplayPreferences['general'][K],
    ) => void;
};

export function AppearanceGeneralSettings({
    preferences,
    onChange,
}: GeneralProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Apparence générale</CardTitle>
                <CardDescription>
                    Ces réglages s’appliquent à toute l’application.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
                <fieldset className="grid gap-2">
                    <legend className="mb-2 text-sm font-medium">Thème</legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <ChoiceButton
                            active={preferences.theme === 'light'}
                            onClick={() => onChange('theme', 'light')}
                        >
                            <Sun /> Clair
                        </ChoiceButton>
                        <ChoiceButton
                            active={preferences.theme === 'dark'}
                            onClick={() => onChange('theme', 'dark')}
                        >
                            <Moon /> Sombre
                        </ChoiceButton>
                        <ChoiceButton
                            active={preferences.theme === 'system'}
                            onClick={() => onChange('theme', 'system')}
                        >
                            <Monitor /> Système
                        </ChoiceButton>
                    </div>
                </fieldset>

                <fieldset className="grid gap-2">
                    <legend className="mb-2 text-sm font-medium">
                        Couleur d’accent
                    </legend>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {accents.map((accent) => (
                            <button
                                type="button"
                                key={accent.value}
                                className="appearance-accent-option"
                                aria-pressed={
                                    preferences.accent === accent.value
                                }
                                onClick={() => onChange('accent', accent.value)}
                            >
                                <span
                                    className="appearance-swatch"
                                    data-accent={accent.value}
                                />
                                <span className="flex-1">{accent.label}</span>
                                <Check className="appearance-option-check" />
                            </button>
                        ))}
                    </div>
                </fieldset>

                <fieldset className="grid gap-2">
                    <legend className="mb-2 text-sm font-medium">
                        Densité
                    </legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(['comfortable', 'compact'] as DisplayDensity[]).map(
                            (density) => (
                                <ChoiceButton
                                    key={density}
                                    active={preferences.density === density}
                                    onClick={() => onChange('density', density)}
                                >
                                    {density === 'comfortable'
                                        ? 'Confortable'
                                        : 'Compacte'}
                                </ChoiceButton>
                            ),
                        )}
                    </div>
                </fieldset>
            </CardContent>
        </Card>
    );
}

type PagesProps = {
    pages: DisplayPreferences['pages'];
    onChange: (
        page: PreferencePage,
        patch: Partial<DisplayPreferences['pages'][PreferencePage]>,
    ) => void;
};

export function AppearancePageSettings({ pages, onChange }: PagesProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Préférences par page</CardTitle>
                <CardDescription>
                    Activez uniquement les pages que vous souhaitez
                    personnaliser.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
                {(Object.keys(pageLabels) as PreferencePage[]).map((page) => {
                    const setting = pages[page];

                    return (
                        <div key={page} className="rounded-xl border p-4">
                            <div className="flex items-start gap-3">
                                <Checkbox
                                    id={`page-${page}`}
                                    checked={setting.enabled}
                                    onCheckedChange={(checked) =>
                                        onChange(page, {
                                            enabled: checked === true,
                                        })
                                    }
                                />
                                <label
                                    htmlFor={`page-${page}`}
                                    className="flex-1 cursor-pointer"
                                >
                                    <span className="block font-medium">
                                        {pageLabels[page]}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {setting.enabled
                                            ? 'Utiliser les choix ci-dessous'
                                            : 'Utiliser les réglages par défaut'}
                                    </span>
                                </label>
                            </div>

                            {setting.enabled && (
                                <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-[1fr_auto]">
                                    <div>
                                        <div className="mb-2 text-sm font-medium">
                                            Affichage par défaut
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {pageViews[page].map(
                                                ({
                                                    value,
                                                    label,
                                                    icon: Icon,
                                                }) => (
                                                    <ChoiceButton
                                                        key={value}
                                                        active={
                                                            setting.view ===
                                                            value
                                                        }
                                                        onClick={() =>
                                                            onChange(page, {
                                                                view: value,
                                                            })
                                                        }
                                                    >
                                                        <Icon /> {label}
                                                    </ChoiceButton>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                    <label className="flex min-w-48 items-center gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                                        <Checkbox
                                            checked={setting.rightSidebarOpen}
                                            onCheckedChange={(checked) =>
                                                onChange(page, {
                                                    rightSidebarOpen:
                                                        checked === true,
                                                })
                                            }
                                        />
                                        <PanelRight className="size-4" />
                                        Volet ouvert
                                    </label>
                                </div>
                            )}
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
