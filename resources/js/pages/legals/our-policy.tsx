import { withAppLayout } from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import { ArrowLeftCircle } from 'lucide-react';
import Heading from '@/components/heading';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Notre politique', href: '/legals/our-policy' },
];

export default withAppLayout(breadcrumbs, false, () => {
    const { t } = useI18n();



    return (
        <div className="space-y-4 w-full mx-auto flex flex-col">
            <Head title="Notre politique" />

            <div className="flex items-center py-2 gap-2 justify-between">
                <div className="flex justify-center gap-2">
                    <Link href="#"
                        onClick={(e) => { e.preventDefault(); window.history.back(); }}
                        className='hover:text-gray-500 transition-colors duration-200'
                    >
                        <ArrowLeftCircle size={35} />
                    </Link>
                    <Heading title={t('Notre politique')} />
                </div>
            </div>
            <div className=''>

            </div>




        </div>

    );
})
