import { Head, Link } from '@inertiajs/react';
import { SearchXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export default function Error404() {
    const { t } = useI18n();

    return (
        <>
            <Head title="404 - Not Found" />
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="max-w-md w-full text-center space-y-8">
                    <div className="space-y-4">
                        <SearchXIcon className="mx-auto h-24 w-24 text-muted-foreground" />
                        <h1 className="text-6xl font-bold text-foreground">404</h1>
                        <h2 className="text-2xl font-semibold text-foreground">
                            {t('Page Not Found')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t("The page you're looking for doesn't exist or has been moved.")}
                        </p>
                    </div>
                    <div className="flex gap-4 justify-center">
                        <Button asChild>
                            <Link href="/">{t('Go Home')}</Link>
                        </Button>
                        <Button variant="outline" onClick={() => window.history.back()}>
                            {t('Go Back')}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
