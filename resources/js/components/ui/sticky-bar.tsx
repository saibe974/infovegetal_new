import { ReactNode, useEffect, useState } from 'react';
import BasicSticky from 'react-sticky-el';
import { ViewModeToggle } from './view-mode-toggle';

interface StickySearchBarProps {
    children: ReactNode;
    zIndex?: number;
    borderBottom?: boolean;
}

export function StickyBar({
    children,
    zIndex = 25,
    borderBottom = true,
}: StickySearchBarProps) {
    const [topOffset, setTopOffset] = useState<number>(0);
    const [width, setWidth] = useState<number>(0);
    const [stickyKey, setStickyKey] = useState<number>(0);

    useEffect(() => {
        const selector = '.top-sticky';
        const getHeight = () => {
            const el = document.querySelector(selector) as HTMLElement | null;
            return el ? Math.ceil(el.getBoundingClientRect().height) : 0;
        };

        const getWidth = () => {
            const el = document.querySelector('main') as HTMLElement | null;
            if (!el) return 0;
            const computedStyle = window.getComputedStyle(el);
            const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
            const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
            return Math.ceil(el.clientWidth - paddingLeft - paddingRight - 30);
        }

        const update = () => {
            setTopOffset(getHeight());
            setWidth(getWidth());
            setStickyKey(prev => prev + 1);
        };

        update();
        window.addEventListener('resize', update);

        // Observer l'élément <main> pour détecter les changements de largeur
        let mainRo: ResizeObserver | null = null;
        const mainEl = document.querySelector('main') as HTMLElement | null;
        if (mainEl && typeof ResizeObserver !== 'undefined') {
            mainRo = new ResizeObserver(update);
            mainRo.observe(mainEl);
        }

        return () => {
            window.removeEventListener('resize', update);
            if (mainRo) mainRo.disconnect();
        };
    }, []);

    return (
        <BasicSticky
            key={stickyKey}
            stickyClassName={`z-${zIndex} bg-background`}
            wrapperClassName={`relative z-${zIndex}`}
            stickyStyle={{ top: topOffset, ...(width && { width }) }}
        >
            <div className={`z-${zIndex} flex items-center relative w-full gap-2 ${borderBottom ? 'border-b border-sidebar-border/50' : ''} py-2`}>
                {children}
            </div>
        </BasicSticky>
    );
}
