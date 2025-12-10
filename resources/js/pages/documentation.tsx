import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { InfiniteScroll, usePage, router, Form, Head } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import { ArrowLeftCircle } from 'lucide-react';
import { Link } from "@inertiajs/react"


const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Documentation', href: '/documentation' },
];

export default withAppLayout(breadcrumbs, false, () => {
    const { t } = useI18n();



    return (
        <div className="space-y-4 w-full">
            <Head title="Documentation" />


            <div className="flex items-center py-2 gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <Link href="#"
                        onClick={(e) => { e.preventDefault(); window.history.back(); }}
                        className='hover:text-gray-500 transition-colors duration-200'
                    >
                        <ArrowLeftCircle size={35} />
                    </Link>
                    <h2 className='text-3xl'>Documentation</h2>
                </div>
            </div>


        </div>

    );
})
