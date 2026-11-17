import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2Icon } from 'lucide-react';
import type { ComponentProps } from 'react';

/** Classes du surlignage « sauvegarde à faire » (réutilisables sur un autre bouton). */
export const unsavedHighlightClass =
    'relative ring-2 ring-amber-400 ring-offset-2 ring-offset-background';

/** Pastille animée affichée sur un bouton quand une sauvegarde est à faire. */
export function UnsavedDot() {
    return (
        <span className="pointer-events-none absolute -top-1 -right-1 flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
        </span>
    );
}

type SaveButtonProps = ComponentProps<typeof Button> & {
    /**
     * Des changements sont en attente. `false` désactive le bouton,
     * `true` le surligne. Laisser `undefined` pour un bouton toujours actif.
     */
    dirty?: boolean;
    /** Requête de sauvegarde en cours : désactive le bouton et affiche un loader. */
    saving?: boolean;
};

/**
 * Bouton de sauvegarde standard : désactivé tant qu'il n'y a rien à
 * enregistrer, surligné quand une sauvegarde est à faire.
 * Voir _docs/save-button.md.
 */
export function SaveButton({
    dirty,
    saving = false,
    disabled,
    className,
    children,
    ...props
}: SaveButtonProps) {
    const pending = dirty === true && !saving;

    return (
        <Button
            data-dirty={pending || undefined}
            disabled={disabled || saving || dirty === false}
            className={cn(className, pending && unsavedHighlightClass)}
            {...props}
        >
            {saving && props.size === 'icon' ? (
                <Loader2Icon className="animate-spin" />
            ) : (
                <>
                    {saving ? <Loader2Icon className="animate-spin" /> : null}
                    {children}
                </>
            )}
            {pending ? <UnsavedDot /> : null}
        </Button>
    );
}
