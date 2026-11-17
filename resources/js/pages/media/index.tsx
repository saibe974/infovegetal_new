import { withAppLayout } from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs = (): BreadcrumbItem[] => [
    {
        title: 'Media library',
        href: typeof window !== 'undefined' && window.location.pathname === '/media' ? '/media' : '/admin/media-manager',
    },
];

export default withAppLayout(breadcrumbs, true, () => {
    const [libraryTheme, setLibraryTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        const root = document.documentElement;

        const syncTheme = () => {
            setLibraryTheme(root.classList.contains('dark') ? 'dark' : 'light');
        };

        syncTheme();

        const observer = new MutationObserver(syncTheme);
        observer.observe(root, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    const mediaUrl = useMemo(() => `/elfinder?theme=${libraryTheme}`, [libraryTheme]);

    return (
        // Full height minus the 4rem header and the layout padding (p-2 / lg:p-4).
        <div className="h-[calc(100svh-5rem)] min-h-0 overflow-hidden lg:h-[calc(100svh-6rem)]">
            <iframe
                title="Media library"
                src={mediaUrl}
                className="block h-full min-h-0 w-full border-0 bg-background"
            />
        </div>
    );
});
