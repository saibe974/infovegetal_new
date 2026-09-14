import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Maximize, Minimize } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type FullscreenDocument = Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};

export function FullscreenButton({ className }: { className?: string }) {
    const { t } = useI18n();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isSupported, setIsSupported] = useState(false);

    const syncFullscreenState = useCallback(() => {
        const doc = document as FullscreenDocument;
        setIsFullscreen(
            Boolean(document.fullscreenElement ?? doc.webkitFullscreenElement),
        );
    }, []);

    useEffect(() => {
        const root = document.documentElement as FullscreenElement;

        setIsSupported(
            typeof root.requestFullscreen === 'function' ||
                typeof root.webkitRequestFullscreen === 'function',
        );
        syncFullscreenState();

        document.addEventListener('fullscreenchange', syncFullscreenState);
        document.addEventListener('webkitfullscreenchange', syncFullscreenState);

        return () => {
            document.removeEventListener('fullscreenchange', syncFullscreenState);
            document.removeEventListener(
                'webkitfullscreenchange',
                syncFullscreenState,
            );
        };
    }, [syncFullscreenState]);

    const toggleFullscreen = useCallback(async () => {
        const doc = document as FullscreenDocument;
        const root = document.documentElement as FullscreenElement;

        try {
            if (document.fullscreenElement ?? doc.webkitFullscreenElement) {
                if (typeof document.exitFullscreen === 'function') {
                    await document.exitFullscreen();
                } else {
                    await doc.webkitExitFullscreen?.();
                }
                return;
            }

            if (typeof root.requestFullscreen === 'function') {
                await root.requestFullscreen();
            } else {
                await root.webkitRequestFullscreen?.();
            }
        } catch {
            syncFullscreenState();
        }
    }, [syncFullscreenState]);

    if (!isSupported) {
        return null;
    }

    return (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            title={t(isFullscreen ? 'Exit full screen' : 'Full screen')}
            aria-label={t(isFullscreen ? 'Exit full screen' : 'Full screen')}
            className={cn(
                'h-9 w-9 rounded-md bg-primary/10 text-primary transition-all duration-200 hover:scale-105 hover:bg-primary/20 hover:text-primary dark:bg-primary/15 dark:text-foreground dark:shadow-[0_0_12px_-3px] dark:shadow-primary/60 dark:hover:shadow-[0_0_16px_-2px] dark:hover:shadow-primary/60',
                className,
            )}
        >
            {isFullscreen ? (
                <Minimize className="size-5" />
            ) : (
                <Maximize className="size-5" />
            )}
            <span className="sr-only">
                {t(isFullscreen ? 'Exit full screen' : 'Full screen')}
            </span>
        </Button>
    );
}
