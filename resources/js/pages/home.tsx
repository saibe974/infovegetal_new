import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { InfiniteScroll, usePage, router } from '@inertiajs/react';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Loader2, DownloadIcon } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import SearchSoham from '@/components/app/search-select';
import { Badge } from '@/components/ui/badge';
import { CarouselHome } from '@/components/home/carousel-home';
import AppLogo from '@/components/app/app-logo';
import { useI18n } from '@/lib/i18n';
import { AppLogoIconMini } from '@/components/app/app-logo-icon';
import { AboutSection } from '@/components/home/about-section';
import ServicesSection from '@/components/home/services-section';
import { ProductsCardsList } from '@/components/products/products-cards-list';
import { Button } from '@/components/ui/button';
import { AppFooter } from '@/components/app/app-footer';
import { Carousel, CarouselContent } from '@/components/ui/carousel';
import Autoplay from "embla-carousel-autoplay"
import { ProductsCarousel } from '@/components/products/products-carousel';
import { Link } from "@inertiajs/react"

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Home', href: '/' },
];

type Props = {
    collection: PaginatedCollection<Product>;
};



export default withAppLayout(breadcrumbs, false, ({ collection, }: Props) => {
    const { t } = useI18n();
    const plugin = useRef(
        Autoplay({ delay: 10000, stopOnInteraction: true })
    )

    // Produits saisonniers et populaires temporaires
    const seasonProducts = collection.data.slice(1, 5);
    const popularProducts = collection.data.slice(6, 10);

    // console.log(seasonProducts)

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

            <div className='flex flex-col gap-15 items-center w-fit max-w-full px-10 md:px-0'>
                <div className='w-full flex flex-col gap-3 md:gap-0 items-center justify-center md:flex-row md:px-0'>
                    <h3 className='text-3xl font-sans text-center'>{t('Nos produits saisonniers')}</h3>

                </div>

                {/* <ProductsCardsList limit={4} products={seasonProducts} /> */}

                <ProductsCarousel products={seasonProducts} />

                <Link href='/products'>
                    <Button className='w-40 underline bg-brand-main hover:bg-brand-main-hover  transition-all duration-75'>
                        {t('Tout afficher')}
                    </Button>
                </Link>
            </div>

            <AboutSection />

            <div className='flex flex-col gap-10 items-center w-fit max-w-full px-10 md:px-0'>
                <h3 className='text-3xl font-sans'>{t('Meilleures ventes')}</h3>
                {/* <ProductsCardsList limit={4} products={popularProducts} /> */}
                <ProductsCarousel products={popularProducts} />
            </div>

            <ServicesSection active={true} />

        </div>
    );
})
