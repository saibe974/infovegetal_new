import { useSidebar } from '@/components/ui/sidebar';
import { useEffect, useRef, useState } from 'react';

// Écrans d'environ 15 pouces et moins (1920×1080 à 125 % = 1536 px, 1440, 1366…)
const SMALL_SCREEN_QUERY = '(max-width: 1600px)';

function useIsSmallScreen() {
    const [small, setSmall] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(SMALL_SCREEN_QUERY);
        const onChange = () => setSmall(mql.matches);
        onChange();
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    return small;
}

/**
 * Sur petit écran, replie le menu de gauche quand `enabled` (ex. filtres
 * épinglés en colonne) et que le panier de droite s'ouvre, faute de place.
 * Le menu est rouvert dès que la situation cesse (panier fermé, filtres
 * désépinglés…), sauf si l'utilisateur l'a lui-même manipulé entre-temps.
 * Le repli n'est pas mémorisé dans le cookie de la sidebar.
 */
export function useCollapseMenuForCart(enabled: boolean) {
    const { isMobile, isOpenId, setSidebarOpen } = useSidebar();
    const open = isOpenId('main');
    const smallScreen = useIsSmallScreen();
    const crowded = enabled && smallScreen && !isMobile && isOpenId('right');

    const collapsedByUs = useRef(false);
    const wasCrowded = useRef(false);

    useEffect(() => {
        if (crowded && !wasCrowded.current && open) {
            collapsedByUs.current = true;
            setSidebarOpen('main', false, { persist: false });
        } else if (!crowded && wasCrowded.current && collapsedByUs.current) {
            collapsedByUs.current = false;
            if (!open) setSidebarOpen('main', true, { persist: false });
        }
        wasCrowded.current = crowded;
        // `open` volontairement exclu : seul le changement de situation déclenche
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [crowded]);

    // L'utilisateur rouvre le menu lui-même : on ne le replie/rouvre plus pour lui
    useEffect(() => {
        if (open && crowded) collapsedByUs.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
}
