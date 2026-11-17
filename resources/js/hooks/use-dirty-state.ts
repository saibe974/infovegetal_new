import { useCallback, useState } from 'react';

const snapshot = (value: unknown): string => JSON.stringify(value) ?? '';

/**
 * Suivi « modifications non enregistrées » pour un état local (hors useForm).
 *
 *   const { dirty, markSaved } = useDirtyState(items);
 *   // après une sauvegarde réussie : markSaved();
 *
 * Avec useForm d'Inertia, utiliser directement `form.isDirty`
 * (et `form.setDefaults()` après succès). Voir _docs/save-button.md.
 */
export function useDirtyState<T>(value: T) {
    const [saved, setSaved] = useState(() => snapshot(value));
    const current = snapshot(value);

    const markSaved = useCallback(
        (next?: T) => setSaved(snapshot(next === undefined ? value : next)),
        [value],
    );

    return { dirty: current !== saved, markSaved };
}
