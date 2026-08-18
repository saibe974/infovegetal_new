import { useEffect, useRef, useState } from 'react';

const TOP_REVEAL_OFFSET = 16;
const HIDE_DISTANCE = 12;
const SHOW_DISTANCE = 8;

export function useScrollHeaderVisibility() {
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);
    const direction = useRef<-1 | 0 | 1>(0);
    const distance = useRef(0);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        lastScrollY.current = Math.max(window.scrollY, 0);

        const update = () => {
            frame.current = null;

            const scrollY = Math.max(window.scrollY, 0);
            const delta = scrollY - lastScrollY.current;
            lastScrollY.current = scrollY;

            if (scrollY <= TOP_REVEAL_OFFSET) {
                direction.current = 0;
                distance.current = 0;
                setIsVisible(true);
                return;
            }

            if (delta === 0) return;

            const nextDirection = delta > 0 ? 1 : -1;
            if (direction.current !== nextDirection) {
                direction.current = nextDirection;
                distance.current = 0;
            }

            distance.current += Math.abs(delta);

            if (
                (nextDirection === 1 && distance.current >= HIDE_DISTANCE) ||
                (nextDirection === -1 && distance.current >= SHOW_DISTANCE)
            ) {
                setIsVisible(nextDirection === -1);
                distance.current = 0;
            }
        };

        const handleScroll = () => {
            if (frame.current === null) {
                frame.current = window.requestAnimationFrame(update);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            if (frame.current !== null) {
                window.cancelAnimationFrame(frame.current);
            }
        };
    }, []);

    return isVisible;
}
