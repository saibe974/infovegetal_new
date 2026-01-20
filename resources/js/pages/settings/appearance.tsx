import { Head } from '@inertiajs/react';

import AppearanceTabs from '@/components/appearance-tabs';
import HeadingSmall from '@/components/heading-small';
import { useI18n } from '@/lib/i18n';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { edit as editAppearance } from '@/routes/appearance';
import { usePage } from '@inertiajs/react';
import { Card } from '@/components/ui/card';

export default function Appearance() {
    const { t } = useI18n();
    const pageProps = usePage<SharedData & { editingUser?: User }>().props;
    const { auth, editingUser } = pageProps;
    const userId = editingUser ? editingUser.id : auth.user?.id;
    if (!userId) return null;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Appearance settings'),
            href: editAppearance(userId).url,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Appearance settings')} />

            <SettingsLayout>
                <Card className="p-6">
                    <HeadingSmall
                        title={t('Appearance settings')}
                        description={t("Update your account's appearance settings")}
                    />
                    <AppearanceTabs className='w-fit'/>
                </Card>
            </SettingsLayout>
        </AppLayout>
    );
}
