import { List, LayoutGrid, Network, LucideIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from './button';
import { useI18n } from '@/lib/i18n';

export type ViewMode = 'table' | 'grid' | 'tree';

interface ViewModeConfig {
    mode: ViewMode;
    icon: LucideIcon;
    title: string;
}

const defaultViewModes: ViewModeConfig[] = [
    { mode: 'table', icon: List, title: 'Afficher en tableau' },
    { mode: 'grid', icon: LayoutGrid, title: 'Afficher en grille' },
    { mode: 'tree', icon: Network, title: 'Afficher en arbre' },
];

interface ViewModeToggleProps {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    pageKey: string;
    modes?: ViewMode[]; // Modes disponibles (par défaut: tous)
}

export function ViewModeToggle({
    viewMode,
    onViewModeChange,
    pageKey,
    modes = ['table', 'grid']
}: ViewModeToggleProps) {
    const { t } = useI18n();

    // Sauvegarder à chaque changement dans un objet "views"
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const views = JSON.parse(localStorage.getItem('views') || '{}');
            views[pageKey] = viewMode;
            localStorage.setItem('views', JSON.stringify(views));
        } catch (e) {
            // ignore (ex: stockage bloqué)
        }
    }, [viewMode, pageKey]);

    // Filtrer les configurations selon les modes demandés
    const availableModes = defaultViewModes.filter(config => modes.includes(config.mode));

    // Ne rien afficher si un seul mode disponible
    if (availableModes.length <= 1) return null;

    return (
        <div className="flex gap-2">
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
        </div>
    );
}
