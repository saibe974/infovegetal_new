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
];

type MediaPageProps = Record<string, never>;

export default withAppLayout<MediaPageProps>(breadcrumbs, true, () => {
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

    const mediaUrl = useMemo(() => `/admin/media?theme=${libraryTheme}`, [libraryTheme]);
    const missingImagesUrl = '/admin/media-manager/images';

    return (
        <div>
            <Head title={t('Media library')} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{t('Media library')}</h1>
                    <p className="text-sm text-muted-foreground">
                        {t('Manage product images and shared media in one place.')}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline" className="gap-2">
                        <a href="/admin/media-manager">{t('Library')}</a>
                    </Button>
                    <Button asChild variant="outline" className="gap-2">
                        <a href={missingImagesUrl}>{t('Missing images')}</a>
                    </Button>
                    <Button asChild variant="outline" className="gap-2">
                        <a href={mediaUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            {t('Open in new tab')}
                        </a>
                    </Button>
                </div>
            </div>

            <div className="flex h-[calc(100svh-10rem)] min-h-0 flex-col gap-3 overflow-hidden">
                <iframe
                    title="Media library"
                    src={mediaUrl}
                    className="block h-full min-h-0 w-full border-0 bg-background"
                    loading="lazy"
                />
            </div>
        </div>
    );
})
