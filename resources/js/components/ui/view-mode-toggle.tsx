import { ChevronDown, LayoutGrid, LayoutList, ListCollapse, Network, Table2, LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from './button';
import { useI18n } from '@/lib/i18n';
import { persistPagePreference, type PreferencePage } from '@/lib/display-preferences';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './dropdown-menu';

export type ViewMode = 'table' | 'list' | 'grid' | 'tree' | 'accordion';

interface ViewModeConfig {
    mode: ViewMode;
    icon: LucideIcon;
    title: string;
}

const defaultViewModes: ViewModeConfig[] = [
    { mode: 'table', icon: Table2, title: 'Afficher en tableau' },
    { mode: 'list', icon: LayoutList, title: 'Afficher en petites cartes' },
    { mode: 'tree', icon: Network, title: 'Afficher en arbre' },
    { mode: 'accordion', icon: ListCollapse, title: 'Afficher en accordéon' },
    { mode: 'grid', icon: LayoutGrid, title: 'Afficher en grille' },
];

interface ViewModeToggleProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    pageKey: string;
    compact?: boolean;
    mobileMenuModes?: ViewMode[];
    modes?: ViewMode[]; // Modes disponibles (par défaut: tous)
}

export function ViewModeToggle({
    viewMode,
    onViewModeChange,
    pageKey,
    compact = false,
    modes = ['table', 'grid'],
    mobileMenuModes = [],
}: ViewModeToggleProps) {
    const { t } = useI18n();

    // Sauvegarder à chaque changement dans un objet "views"
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const views = JSON.parse(localStorage.getItem('views') || '{}');
            views[pageKey] = viewMode;
            localStorage.setItem('views', JSON.stringify(views));
            if (pageKey === 'products' || pageKey === 'users') {
                persistPagePreference(pageKey as PreferencePage, { view: viewMode });
            }
        } catch {
            // ignore (ex: stockage bloqué)
        }
    }, [viewMode, pageKey]);

    // Filtrer les configurations selon les modes demandés
    const availableModes = defaultViewModes.filter(config => modes.includes(config.mode));
    const availableMobileModes = defaultViewModes.filter(config => mobileMenuModes.includes(config.mode));
    const activeMobileMode = availableMobileModes.find(config => config.mode === viewMode) ?? availableMobileModes[0];
    const menuModes = compact ? availableModes : availableMobileModes;
    const activeMenuMode = compact
        ? availableModes.find(config => config.mode === viewMode) ?? availableModes[0]
        : activeMobileMode;

    useEffect(() => {
        if (typeof window === 'undefined' || availableMobileModes.length === 0) return;

        const mobileViewport = window.matchMedia('(max-width: 639px)');
        const ensureAvailableMobileMode = () => {
            if (mobileViewport.matches && !mobileMenuModes.includes(viewMode)) {
                onViewModeChange(availableMobileModes[0].mode);
            }
        };

        ensureAvailableMobileMode();
        mobileViewport.addEventListener('change', ensureAvailableMobileMode);
        return () => mobileViewport.removeEventListener('change', ensureAvailableMobileMode);
    }, [availableMobileModes, mobileMenuModes, onViewModeChange, viewMode]);

    // Ne rien afficher si un seul mode disponible
    if (availableModes.length <= 1) return null;

    return (
        <>
            {activeMenuMode ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            className={compact ? 'gap-1 p-2' : 'gap-1 p-2 sm:hidden'}
                            title={t(activeMenuMode.title)}
                            aria-label={t('Changer le mode d’affichage')}
                        >
                            <activeMenuMode.icon />
                            <ChevronDown className="size-3.5" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {menuModes.map(({ mode, icon: Icon, title }) => (
                            <DropdownMenuItem
                                key={mode}
                                className={[
                                    viewMode === mode ? 'bg-accent' : '',
                                    compact && mobileMenuModes.length > 0 && !mobileMenuModes.includes(mode) ? 'hidden sm:flex' : '',
                                ].filter(Boolean).join(' ')}
                                onSelect={() => onViewModeChange(mode)}
                            >
                                <Icon />
                                {t(title)}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null}

            {!compact && <div className={activeMobileMode ? 'hidden gap-2 sm:flex' : 'flex gap-2'}>
                {availableModes.map(({ mode, icon: Icon, title }) => (
                    <Button
                        key={mode}
                        type="button"
                        aria-pressed={viewMode === mode}
                        onClick={() => onViewModeChange(mode)}
                        variant="outline"
                        className={`
                            p-2 rounded-md transition border ${viewMode === mode
                                ? 'bg-accent'
                                : 'hover:bg-accent hover:text-inherit text-black/40 dark:text-white/40 dark:hover:text-inherit'
                            }
                        `}
                        title={t(title)}
                    >
                        <Icon />
                    </Button>
                ))}
            </div>}
        </>
    );
}
