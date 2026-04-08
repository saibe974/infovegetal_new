import AppLayout from '@/layouts/app-layout';
import { CartsList } from '../components/cart/carts-list';
import { useI18n } from '@/lib/i18n';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

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
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4 min-h-screen">
                <CartsList />
            </div>
        </AppLayout>
    );
}
