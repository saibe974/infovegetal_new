import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { InfiniteScroll, usePage, router, Form, Head } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Conditions de vente', href: '/legals/sale-conditions' },
];

export default withAppLayout(breadcrumbs, () => {
    const { t } = useI18n();



    return (
        <div className="space-y-4 w-full">
            <Head title="Conditions de vente" />

            <h2 className='text-4xl'>Conditions de vente</h2>

        </div>

    );
})
