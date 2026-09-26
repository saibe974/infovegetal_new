import { useEffect, useLayoutEffect, useState } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Mesure la hauteur cumulée des éléments collants situés au-dessus du contenu
 * (sélecteurs passés) pour positionner un élément `sticky` juste en dessous.
 * Réutilise la logique de mesure de `StickyBar` (`.top-sticky`, etc.).
 */
export function useStickyTopOffset(selectors: string, enabled = true) {
    const [offset, setOffset] = useState(0);

    useIsomorphicLayoutEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            return;
        }

        const compute = () => {
            let total = 0;
            document.querySelectorAll(selectors).forEach((el) => {
                total += Math.ceil(el.getBoundingClientRect().height);
            });
            setOffset(total);
        };

        compute();
        window.addEventListener('resize', compute);

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(compute);
            document.querySelectorAll(selectors).forEach((el) => observer?.observe(el));
            // Observe le document pour détecter les montages/démontages des éléments ciblés
            observer.observe(document.documentElement);
        }

        return () => {
            window.removeEventListener('resize', compute);
            observer?.disconnect();
        };
    }, [selectors, enabled]);

    return offset;
}
