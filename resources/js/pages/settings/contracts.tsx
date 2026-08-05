import { Head, usePage } from '@inertiajs/react';

import HeadingSmall from '@/components/heading-small';
import { Card } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';

export default function Contracts() {
    const pageProps = usePage<SharedData & { editingUser?: User }>().props;
    const { auth, editingUser } = pageProps;
    const isSelf = !editingUser || editingUser.id === auth.user?.id;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Profile settings',
            href: isSelf ? '/settings/profile' : `/admin/users/${editingUser?.id}/edit`,
        },
        {
            title: 'Contract settings',
            href: isSelf ? '/settings/contracts' : `/admin/users/${editingUser?.id}/contracts`,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Contract settings" />

            <SettingsLayout>
                <Card className="flex-1 w-full max-w-[600px] mx-auto p-6 space-y-4">
                    <HeadingSmall
                        title="Contract settings"
                        description="Manage your contract"
                    />
                </Card>
            </SettingsLayout>
        </AppLayout>
    );
}
