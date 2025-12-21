import { useI18n } from "@/lib/i18n";
import AppLogo from "./app-logo";
import { NavFooter } from "../ui/nav-footer";
import { AppLogoIconMini } from "./app-logo-icon";
import { Button } from "../ui/button";
import { Link } from "@inertiajs/react";
import { cn } from "@/lib/utils";
interface AppFooterProps {
    hideOnInfiniteScroll?: boolean;
}

export function AppFooter({ hideOnInfiniteScroll = false }: AppFooterProps) {
    const { t } = useI18n();

    const footerLinks = [
        { title: t('Accueil'), href: '/' },
        { title: t('Produits'), href: '/products' },
        { title: t('Contact'), href: '/contact' },
        { title: t('Panier'), href: '/cart' },
        { title: t('Admin'), href: '/dashboard' },
    ];

    const infoLinks = [
        { title: t('Mentions légales'), href: '/legals/legal-notices' },
        { title: t('Conditions de vente'), href: '/legals/sale-conditions' },
        { title: t('Notre politique'), href: '/legals/our-policy' },
    ]

    const contact = [
        {
            id: 1,
            type: "Commercial",
            name: "Bernard PAILLOT",
            tel: "+33 06 85 31 86 53",
            email: "bernard.paillot@infovegetal.com"
        },
        // {
        //     id: 2,
        //     type: "Logistique",
        //     name: "Godfried Bernaert",
        //     tel: "0032 475 46 18 75",
        //     email: "godfried@adriaenssens-dierickx.be"
        // },
        {
            id: 3,
            type: "Conception",
            name: "Devali",
            tel: "+262 6 92 22 28 76",
            email: "contact@devali.fr"
        }
    ]

    return (
        <footer className={cn(
            "w-full mt-10 border-t-3 border-black/30 dark:border-accent flex flex-col items-center py-6",
            hideOnInfiniteScroll && "hidden"
        )}>
            <div className="flex flex-col md:flex-row w-full justify-center mb-5 px-2 lg:px-10 gap-20 md:gap-0 items-center">

                <div className="md:flex-1 items-start flex justify-center">
                    <a href="/" className="flex items-center gap-3">
                        <AppLogoIconMini className="size-15" />
                        <p className="font-semibold text-lg">Infovegetal</p>
                    </a>

                </div>

                <div className="flex flex-col flex-1 justify-center md:items-center">
                    <div className="flex flex-col items-start">
                        <h4 className="font-semibold text-xl mb-2">{t('Liens')}</h4>
                        {footerLinks.map((link) => (
                            <Button key={link.title} variant="link" className="p-0 font-light">

                                <Link href={link.href} >{link.title}</Link>
                            </Button>
                        ))}
                    </div>

                </div>

                <div className="flex flex-col flex-1 items-center justify-center w-full">
                    <div className="flex flex-col items-center md:items-start">
                        <h4 className="font-semibold text-xl mb-2">{t('Infos')}</h4>
                        {infoLinks.map((link) => (
                            <Button asChild key={link.title} variant="link" className="p-0 font-light">

                                <a href={link.href} target="_blank" rel="noopener noreferrer">{link.title}</a>

                            </Button>
                        ))}
                    </div>

                </div>

                <div className="flex flex-col flex-1  items-center">
                    <div className="flex flex-col items-center md:items-start">
                        <h4 className="font-semibold text-xl mb-2">{t('Une question ?')}</h4>
                        <div className="flex flex-col gap-2 md:items-start">
                            {contact.map((contact) => (
                                <div key={contact.id} className="flex flex-col items-start mb-3">
                                    <p className="font-semibold">{contact.type} :</p>
                                    <p className="font-light">{contact.name}</p>
                                    <p className="font-light">{contact.tel}</p>
                                    <a href={`mailto:${contact.email}`} className="font-light">{contact.email}</a>
                                </div>
                            ))}
                        </div>
                    </div>


                </div>
            </div>
            <div className="flex flex-col items-center w-fit gap-3">

                <p className="text-sm font-light">Copyright © 2025 All rights reserved | by Devali</p>
            </div>
        </footer>
    );
}