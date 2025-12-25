import { Head, Link } from '@inertiajs/react';
import { ShieldXIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export default function Error403() {
    const { t } = useI18n();

    return (
        <>
            <Head title="403 - Forbidden" />
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="max-w-md w-full text-center space-y-8">
                    <div className="space-y-4">
                        <ShieldXIcon className="mx-auto h-24 w-24 text-destructive" />
                        <h1 className="text-6xl font-bold text-foreground">403</h1>
                        <h2 className="text-2xl font-semibold text-foreground">
                            {t('Access Forbidden')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t("You don't have permission to access this resource.")}
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
