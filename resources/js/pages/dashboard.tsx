import { CommercialBalance } from '@/components/dashboard/commercial-balance';
import AppLayout from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { CartsList } from '../components/cart/carts-list';

export default function Dashboard() {
    const { t } = useI18n();

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Dashboard'),
            href: dashboard().url,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Dashboard')} />
            <div className="flex h-full min-h-screen flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <CommercialBalance />
                <CartsList />
            </div>
        </AppLayout>
    );
}
