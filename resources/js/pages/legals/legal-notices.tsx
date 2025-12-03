import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { InfiniteScroll, usePage, router, Form, Head } from '@inertiajs/react';
import { useI18n } from '@/lib/i18n';
import { AppFooter } from '@/components/app.footer';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Mentions légales', href: '/legals/legal-notices' },
];

export default withAppLayout(breadcrumbs, () => {
    const { t } = useI18n();



    return (
        <div className="w-full mx-auto">
            <Head title="Mentions légales" />
            <div className='w-fit mx-auto h-180 flex flex-col justify-center items-center gap-15'>
                <h2 className='text-4xl'>Mentions légales</h2>
                <p className='text-lg text-wrap p-3'>
                    Siège social : ID'VEGETAL, 50 chemin de l'Ermitage - 39230 PASSENANS <br />
                    Tél. : 06.85.31.86.53<br />
                    Fax : 03.84.44.61.99<br />
                    N° SIRET : 809916042 00025<br />
                    Nom du responsable de la publication : ID'VEGETAL<br />
                    Nom du responsable de la rédaction : ID'VEGETAL<br />
                    <br /><br />
                    Site internet hébergé chez infomaniak :<br />
                    Infomaniak Network SA<br />
                    Avenue de la Praille, 26 - 1227 Carouge - Suisse<br />
                    N° IDE & TVA : CHE-103.167.648<br />
                    Tel : +41 22 820 35 44<br />
                    Fax : +41 22 820 35 46<br />
                    support@infomaniak.ch
                </p>
            </div>




        </div>

    );
})
