import { type CSSProperties, ReactNode, useEffect, useRef, useState } from 'react';
import BasicSticky from 'react-sticky-el';

interface StickyBarProps {
    children: ReactNode;
    zIndex?: number;
    borderBottom?: boolean;
    stickyClassName?: string;
    className?: string;
    topOffsetElement?: string;
    onFixedToggle?: (isFixed: boolean) => void;
    disabled?: boolean;
    boundaryElement?: string;
}

export function StickyBar({
    children,
    zIndex = 25,
    borderBottom = true,
    stickyClassName = '',
    className = '',
    topOffsetElement = '.top-sticky',
    onFixedToggle,
    disabled = false,
    boundaryElement,
}: StickyBarProps) {
    const [topOffset, setTopOffset] = useState<number>(0);
    const [width, setWidth] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const getHeight = () => {
            const els = document.querySelectorAll(topOffsetElement) as NodeListOf<HTMLElement>;
            let total = 0;
            els.forEach((el) => {
                total += Math.ceil(el.getBoundingClientRect().height);
            });
            return total;
        };

        const getWidth = () => {
            const el = containerRef.current;
            if (!el) return 0;
            return Math.max(0, Math.floor(el.getBoundingClientRect().width));
        }

        const update = () => {
            setTopOffset(getHeight());
            setWidth(getWidth());
        };

        update();
        window.addEventListener('resize', update);

        let containerRo: ResizeObserver | null = null;
        if (containerRef.current && typeof ResizeObserver !== 'undefined') {
            containerRo = new ResizeObserver(update);
            containerRo.observe(containerRef.current);
        }

        // Les éléments servant d'offset peuvent changer de hauteur (par exemple
        // lorsque le header principal se masque au scroll).
        let offsetRo: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            offsetRo = new ResizeObserver(update);
            document.querySelectorAll(topOffsetElement).forEach((el) => {
                offsetRo?.observe(el);
            });
        }

        return () => {
            window.removeEventListener('resize', update);
            if (containerRo) containerRo.disconnect();
            if (offsetRo) offsetRo.disconnect();
        };
    }, [topOffsetElement]);

    // console.log(topOffset)

    return (
        <div ref={containerRef} style={{ '--sticky-top-offset': `${topOffset}px` } as CSSProperties}>
            <BasicSticky
                disabled={disabled}
                boundaryElement={boundaryElement}
                topOffset={-topOffset}
                stickyClassName={`z-${zIndex} bg-background ${stickyClassName}`}
                wrapperClassName={`relative z-${zIndex} ${className}`}
                stickyStyle={{ top: topOffset, zIndex, ...(width && { width }) }}
                onFixedToggle={onFixedToggle}
            >
                <div className={`z-${zIndex} relative flex w-full flex-wrap items-center justify-between gap-2 ${borderBottom ? 'border-b border-sidebar-border/50' : ''} bg-background py-2`}>
                    {children}
                </div>
            </BasicSticky>
        </div>
    );
}
