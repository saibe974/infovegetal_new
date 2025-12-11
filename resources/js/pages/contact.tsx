import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import { ReactNode, useRef, useState } from 'react';
import { type BreadcrumbItem, Product, PaginatedCollection } from '@/types';
import { InfiniteScroll, usePage, router, Form, Head } from '@inertiajs/react';
import { Loader2, DownloadIcon, ArrowLeftCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Link } from "@inertiajs/react"
import { FormField } from '@/components/ui/form-field';
import { Input, Textarea } from '@headlessui/react';
import { SelectWithItems } from '@/components/ui/select-with-items';
import Heading from '@/components/heading';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Contact', href: '/contact' },
];

const RECIPIENT: { value: string; label: string; }[] = [
    { value: "comm", label: "Commercial : Bernard Paillot", },
    { value: "log", label: "Logistique :  Godfried Bernaert" },
    { value: "dev", label: "Conception : devali" },
];


export default withAppLayout(breadcrumbs, false, () => {
    const { t } = useI18n();



    return (
        <div className='flex flex-col gap-30'>
            <Form className="space-y-4 w-full">
                <Head title="Contact" />


                <div className="flex items-center py-2 gap-2 justify-between">
                    <div className="flex items-center gap-2">
                        <Link href="#"
                            onClick={(e) => { e.preventDefault(); window.history.back(); }}
                            className='hover:text-gray-500 transition-colors duration-200'
                        >
                            <ArrowLeftCircle size={35} />
                        </Link>
                    </div>
                </div>


                <div className="w-full max-w-lg mx-auto">
                    <Heading title={'Nous Contacter'} />
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

        </div>

    );
})
