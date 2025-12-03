import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { InfiniteScroll, usePage, router, Form, Head } from '@inertiajs/react';
import { SortableTableHead } from '@/components/sortable-table-head';
import { Loader2, DownloadIcon, ArrowLeftCircle } from 'lucide-react';
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
import { Carousel, CarouselContent } from '@/components/ui/carousel';
import Autoplay from "embla-carousel-autoplay"
import { ProductsCarousel } from '@/components/products-carousel';
import { Link } from "@inertiajs/react"
import { FormField } from '@/components/ui/form-field';
import { Input, Textarea } from '@headlessui/react';
import { SelectWithItems } from '@/components/ui/select-with-items';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Contact', href: '/contact' },
];

const RECIPIENT: { value: string; label: string; }[] = [
    { value: "comm", label: "Commercial : Bernard Paillot", },
    { value: "log", label: "Logistique :  Godfried Bernaert" },
    { value: "dev", label: "Conception : devali" },
];


export default withAppLayout(breadcrumbs, () => {
    const { t } = useI18n();



    return (
        <Form className="space-y-4 w-full">
            <Head title="Contact" />


            <div className="flex items-center py-2 gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <Link href="#"
                        onClick={(e) => { e.preventDefault(); window.history.back(); }}>
                        <ArrowLeftCircle size={35}/>
                    </Link>
                </div>
            </div>


            <div className="w-full max-w-lg mx-auto">
                <h2 className='text-3xl py-5 text-center'>Nous Contacter</h2>
                <main className="space-y-4 relative">
                    <FormField
                        label="Nom"
                        htmlFor="name"
                    >
                        <Input
                            id="name"
                            name="name"
                            type='text'
                            placeholder='Votre nom'
                            className='border border-gray-300 rounded-md px-3 py-2 w-full'
                        />
                    </FormField>

                    <FormField
                        label="Email"
                        htmlFor="email"
                    >
                        <Input
                            id="email"
                            name="email"
                            type='email'
                            placeholder='Votre email'
                            className='border border-gray-300 rounded-md px-3 py-2 w-full'
                        />
                    </FormField>

                    <FormField
                        label="Destinataire"
                        htmlFor="recipient"
                    >
                        <SelectWithItems
                            id="recipient"
                            name="recipient"
                            items={RECIPIENT}
                            placeholder='Destinataire'
                            className='border border-gray-300 rounded-md px-3 py-2 w-full h-10'
                        />
                    </FormField>

                    <FormField
                        label="Objet"
                        htmlFor="subject"
                    >
                        <Input
                            id="subject"
                            name="subject"
                            type='text'
                            placeholder='Objet de votre message'
                            className='border border-gray-300 rounded-md px-3 py-2 w-full'
                        />
                    </FormField>

                    <FormField
                        label="Message"
                        htmlFor="message"
                    >
                        <Textarea
                            id="message"
                            name="message"
                            placeholder='Votre message...'
                            className='border border-gray-300 rounded-md px-3 py-2 w-full min-h-30'
                        />
                    </FormField>



                    <Button
                        className='border border-gray-300 rounded-xl px-3 py-2 w-1/2 h-12 absolute right-0 bg-main-purple hover:bg-main-purple-hover dark:bg-main-green dark:hover:bg-main-green-hover cursor-pointer'
                    >
                        Envoyer
                    </Button>

                </main>
            </div>
        </Form>

    );
})
