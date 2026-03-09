import { withAppLayout } from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import type { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Media library',
        href: '/admin/media-manager',
    },
    {
        title: 'Missing images',
        href: '/admin/media-manager/images',
    },
];

type MissingImagesPageProps = Record<string, never>;

export default withAppLayout<MissingImagesPageProps>(breadcrumbs, true, ({ }) => {
    const { t } = useI18n();
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

    const frameUrl = useMemo(
        () => `/admin/media-manager/images/frame?theme=${libraryTheme}`,
        [libraryTheme],
    );

    return (
        <div>
            <Head title={t('Missing images')} />

            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{t('Missing images')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t('Browse products that still do not have local images.')}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" className="gap-2">
                        <a href="/admin/media-manager">{t('Library')}</a>
                    </Button>
                    <Button asChild variant="outline" className="gap-2">
                        <a href="/admin/media-manager/images">{t('Missing images')}</a>
                    </Button>
                    <Button asChild variant="outline" className="gap-2">
                        <a href={frameUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            {t('Open in new tab')}
                        </a>
                    </Button>
                </div>
            </div>

            <div className="flex h-[calc(100svh-10rem)] min-h-0 flex-col gap-3 overflow-hidden">
                <iframe
                    title="Missing images"
                    src={frameUrl}
                    className="block h-full min-h-0 w-full border-0 bg-background"
                    loading="lazy"
                />
            </div>
        </div>
    );
});
