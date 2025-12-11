import { List, LayoutGrid } from 'lucide-react';
import { useEffect } from 'react';

interface ViewModeToggleProps {
    viewMode: 'table' | 'grid';
    onViewModeChange: (mode: 'table' | 'grid') => void;
    storageKey: string;
}

export function ViewModeToggle({ viewMode, onViewModeChange, storageKey }: ViewModeToggleProps) {
    // Sauvegarder à chaque changement
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(storageKey, viewMode);
        } catch (e) {
            // ignore (ex: stockage bloqué)
        }
    }, [viewMode, storageKey]);

    return (
        <div className="flex gap-2">
            <button
                type="button"
                aria-pressed={viewMode === 'table'}
                onClick={() => onViewModeChange('table')}
                className={`
                    p-2 rounded-md transition border ${viewMode === 'table'
                        ? 'bg-accent'
                        : 'hover:bg-accent hover:text-inherit text-black/40 dark:text-white/40 dark:hover:text-inherit'
                    }
                `}
                title="Afficher en tableau"
            >
                <List />
            </button>

            <button
                type="button"
                aria-pressed={viewMode === 'grid'}
                onClick={() => onViewModeChange('grid')}
                className={`
                    p-2 rounded-md transition border ${viewMode === 'grid'
                        ? 'bg-accent'
                        : 'hover:bg-accent hover:text-inherit text-black/40 dark:text-white/40 dark:hover:text-inherit'
                    }
                `}
                title="Afficher en grille"
            >
                <LayoutGrid />
            </button>
        </div>
    );
}
