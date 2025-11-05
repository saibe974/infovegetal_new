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
import AppLogo from '@/components/app-logo';
import { useI18n } from '@/lib/i18n';
import { AppLogoIconMini } from '@/components/app-logo-icon';
import { AboutSection } from '@/components/about-section';
import ServicesSection from '@/components/services-section';
import { ProductsCardsList } from '@/components/products-cards-list';
import { Button } from '@/components/ui/button';
import { AppFooter } from '@/components/app.footer';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Home', href: '/' },
];

type Props = {
    collection: PaginatedCollection<Product>;
};



export default withAppLayout(breadcrumbs, ({ collection, }: Props) => {
    const { t } = useI18n();

    // Produits saisonniers et populaires temporaires
    const seasonProducts = collection.data.slice(1, 5);
    const popularProducts = collection.data.slice(6, 10);

    console.log(seasonProducts)

    return (
        <div className='w-full flex items-center flex-col gap-40'>
            <div className='flex flex-col w-full items-center gap-15'>
                <CarouselHome />
                <div className='text-center'>
                    <h3 className='text-2xl font-bold font-sans'>
                        {t('Votre logistique végétale, simplifiée et performante')}
                    </h3>
                    <h4 className='text-lg font-light'>
                        {t('La plateforme pensée par et pour les professionnels de l’horticulture')}
                    </h4>
                </div>
            </div>

            <div className='flex flex-col gap-10'>
                <div className='w-full flex justify-between'>
                    <h3 className='text-3xl font-sans'>{t('Nos produits saisonniers')}</h3>
                    <Button className='underline bg-main-purple hover:bg-main-purple-hover dark:bg-main-green dark:hover:bg-main-green-hover transition-all duration-75'>
                        {t('Tout afficher')}
                    </Button>
                </div>

                <ProductsCardsList products={seasonProducts} />
            </div>

            <AboutSection />

            <div className='flex flex-col gap-10'>
                <h3 className='text-3xl font-sans'>{t('Meilleures ventes')}</h3>
                <ProductsCardsList products={popularProducts} />
            </div>
            <ServicesSection active={true} />

            <AppFooter />
        </div>
    );
})
