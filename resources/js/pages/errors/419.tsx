import { Head, Link } from '@inertiajs/react';
import { ClockIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export default function Error419() {
    const { t } = useI18n();

    return (
        <>
            <Head title="419 - Page Expired" />
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="max-w-md w-full text-center space-y-8">
                    <div className="space-y-4">
                        <ClockIcon className="mx-auto h-24 w-24 text-amber-500" />
                        <h1 className="text-6xl font-bold text-foreground">419</h1>
                        <h2 className="text-2xl font-semibold text-foreground">
                            {t('Page Expired')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t('Your session has expired. Please refresh the page and try again.')}
                        </p>
                    </div>
                    <div className="flex gap-4 justify-center">
                        <Button onClick={() => window.location.reload()}>
                            {t('Refresh Page')}
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/">{t('Go Home')}</Link>
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
