import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import type { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Media library',
        href: '/admin/media-manager',
    },
];

export default withAppLayout(breadcrumbs, false, () => {
    const { t } = useI18n();

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Media library')} />

            <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">{t('Media library')}</h1>
                        <p className="text-sm text-muted-foreground">
                            {t('Manage product images and shared media in one place.')}
                        </p>
                    </div>
                    <Button asChild variant="outline" className="gap-2">
                        <a href="/admin/media" target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            {t('Open in new tab')}
                        </a>
                    </Button>
                </div>

                <Card className="border-border/70">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">{t('File manager')}</CardTitle>
                        <CardDescription>
                            {t('Uploads are stored under storage/media and served via the public disk.')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-hidden rounded-lg border bg-background">
                            <iframe
                                title="Media library"
                                src="/admin/media"
                                className="h-[72vh] w-full bg-background"
                                loading="lazy"
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
});
