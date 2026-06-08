import { withAppLayout } from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { ArrowLeftCircle } from 'lucide-react';
import { Link } from "@inertiajs/react"
import Heading from '@/components/heading';


const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Documentation', href: '/documentation' },
];

export default withAppLayout(breadcrumbs, false, () => {
    return (
        <div className="space-y-4 w-full">
            <Head title="Documentation" />


            <div className="flex items-center py-2 gap-2 justify-between">
                <div className="flex justify-center gap-2">
                    <Link href="#"
                        onClick={(e) => { e.preventDefault(); window.history.back(); }}
                        className='hover:text-gray-500 transition-colors duration-200'
                    >
                        <ArrowLeftCircle size={35} />
                    </Link>
                    <Heading title={'Documentation'} />
                </div>
            </div>


        </div>

    );
})
