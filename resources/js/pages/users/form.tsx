import { Button } from '@/components/ui/button';
import Heading from '@/components/heading';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import type { BreadcrumbItem, ProductDetailed, User } from '@/types';
import { Form, Head, Link } from '@inertiajs/react';
import { ArrowLeftCircle, LinkIcon, SaveIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import SearchSoham from '@/components/app/search-select';
import { useState } from 'react';
import users from '@/routes/users';

type Props = {
    user: User;
};

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users',
        href: users.index().url,
    },
    {
        title: 'Créer',
        href: '#',
    },
];


export default withAppLayout<Props>(breadcrumbs, false, ({ user }) => {
    const isNew = !user || !user.id;
    // Utiliser Wayfinder pour générer action/method corrects
    const action = isNew
        ? users.store.form()
        : users.update.form({ user: user.id });
    return (
        <Form {...action} className="space-y-4">
            <Head title={isNew ? 'Créer un utilisateur' : `Editer l'utilisateur #${user.id}`} />
            <div className="flex items-center py-2 gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <Link href="#"
                        onClick={(e) => { e.preventDefault(); window.history.back(); }}
                        className='hover:text-gray-500 transition-colors duration-200'
                    >
                        <ArrowLeftCircle size={35} />
                    </Link>
                    <h2>
                        {isNew ? 'Créer un utilisateur' : 'Editer un utilisateur'}
                    </h2>
                </div>
            </div>
            <div className="grid items-start gap-8 md:grid-cols-[1fr_350px]">
                <main className="space-y-4">
                    <FormField label="Nom" htmlFor="name">
                        <Input
                            id="name"
                            name="name"
                            defaultValue={user?.name ?? ''}
                            required
                        />
                    </FormField>
                    <FormField label="Email" htmlFor="email">
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            defaultValue={user?.email ?? ''}
                            required
                        />
                    </FormField>
                    {isNew && (
                        <FormField label="Mot de passe" htmlFor="password">
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                            />
                        </FormField>
                    )}
                    <Button type="submit" className="mt-4">
                        <SaveIcon className="mr-2" />
                        {isNew ? 'Créer' : 'Enregistrer'}
                    </Button>
                </main>
            </div>
        </Form>
    );
});