import { router, usePage } from '@inertiajs/react';
import { type SharedData } from '@/types';
import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export function ImpersonationBanner() {
    const { auth, users = [] } = usePage<SharedData>().props;
    const { t } = useI18n();

    const isImpersonating = !!auth.impersonate_from;

    if (!isImpersonating) {
        return null;
    }

    const originalAdmin = users.find((u: any) => u.id === auth.impersonate_from);
    const currentUser = auth.user;

    const handleStopImpersonate = () => {
        // Utiliser la route du package laravel-impersonate (GET)
        router.visit('/impersonate/leave', {
            preserveState: false,
        });
    };

    return (
        <div className="w-full bg-amber-500/90 dark:bg-amber-600/90 backdrop-blur-sm border-b border-amber-600 dark:border-amber-700">
            <div className="container mx-auto px-4 py-2">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-amber-950 dark:text-amber-50">
                        <AlertCircle size={20} className="flex-shrink-0" />
                        <div className="text-sm font-medium">
                            {t('Impersonation Mode')}
                            <span className="ml-2 opacity-90">
                                {t('Connected as')} <strong>{currentUser?.name}</strong> ({currentUser?.email})
                            </span>
                            {originalAdmin && (
                                <span className="ml-2 opacity-75 text-xs">
                                    — {t('Original admin')}: {originalAdmin.name}
                                </span>
                            )}
                        </div>
                    </div>
                    <Button
                        onClick={handleStopImpersonate}
                        size="sm"
                        variant="outline"
                        className="flex-shrink-0 bg-white/90 hover:bg-white dark:bg-amber-950/50 dark:hover:bg-amber-950/70 border-amber-700 dark:border-amber-800"
                    >
                        <X size={16} className="mr-1" />
                        {t('Stop impersonation')}
                    </Button>
                </div>
            </div>
        </div>
    );
}
