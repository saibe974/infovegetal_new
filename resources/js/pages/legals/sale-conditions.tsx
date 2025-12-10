import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { InfiniteScroll, usePage, router, Form, Head, Link } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import { AppFooter } from '@/components/app-footer';
import { ArrowLeftCircle } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Conditions de vente', href: '/legals/sale-conditions' },
];

export default withAppLayout(breadcrumbs, false, () => {
    const { t } = useI18n();



    return (
        <div className="space-y-4 w-full mx-auto flex flex-col">
            <Head title="Conditions de vente" />

            <div className="flex items-center py-2 gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <Link href="#"
                        onClick={(e) => { e.preventDefault(); window.history.back(); }}
                        className='hover:text-gray-500 transition-colors duration-200'
                    >
                        <ArrowLeftCircle size={35} />
                    </Link>
                    <h2 className='text-3xl'>Conditions de vente</h2>
                </div>
            </div>

            <div className=''>

            </div>


        </div>

    );
})
