import { Head, Link } from '@inertiajs/react';
import { WrenchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export default function Error503() {
    const { t } = useI18n();

    return (
        <>
            <Head title="503 - Service Unavailable" />
            <div className="min-h-screen flex items-center justify-center bg-background px-4">
                <div className="max-w-md w-full text-center space-y-8">
                    <div className="space-y-4">
                        <WrenchIcon className="mx-auto h-24 w-24 text-amber-500" />
                        <h1 className="text-6xl font-bold text-foreground">503</h1>
                        <h2 className="text-2xl font-semibold text-foreground">
                            {t('Service Unavailable')}
                        </h2>
                        <p className="text-muted-foreground">
                            {t("We're performing maintenance. Please check back soon.")}
                        </p>
                    </div>
                    <div className="flex gap-4 justify-center">
                        <Button onClick={() => window.location.reload()}>
                            {t('Try Again')}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
}
