import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Loader2, DownloadIcon } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import SearchSoham from '@/components/ui/searchSoham';
import { Badge } from '@/components/ui/badge';
import { CarouselHome } from '@/components/carousel-home';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Home', href: '/' },
];

type Props = {
    collection: PaginatedCollection<Product>;
    q: string | null;
};

export default withAppLayout(breadcrumbs, () => {


    return (
        <div className='w-full flex items-center flex-col'>
            <div className='flex flex-col h-screen w-full items-center gap-15'>
                <CarouselHome />
                <div className='text-center'>
                    <h3 className='text-2xl font-bold font-sans'>Votre logistique végétale, simplifiée et performante</h3>
                    <h4 className='text-lg font-light'>La plateforme pensée par et pour les professionnels de l’horticulture</h4>
                </div>

            </div>
        </div>
    );
})
