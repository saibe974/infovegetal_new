import { useI18n } from "@/lib/i18n";
import AppLogo from "./app-logo";
import { NavFooter } from "./nav-footer";
import { AppLogoIconMini } from "./app-logo-icon";
import { Button } from "./ui/button";

export function AppFooter() {
    const { t } = useI18n();

    const footerLinks = [
        { title: t('Accueil'), href: '/' },
        { title: t('Produits'), href: '/products' },
        { title: t('Contact'), href: '/contact' },
        { title: t('Panier'), href: '/cart' },
        { title: t('Admin'), href: '/dashboard' },
    ];

    const infoLinks = [
        { title: t('Mentions légales'), href: '/' },
        { title: t('Conditions de vente'), href: '/' },
        { title: t('Notre politique'), href: '/' },
    ]

    const contact = [
        {
            id: 1,
            type: "Commercial",
            name: "Bernard PAILLOT",
            tel: "+33 06 85 31 86 53",
            email: "bernard.paillot@infovegetal.com"
        },
        {
            id: 2,
            type: "Logistique",
            name: "Godfried Bernaert",
            tel: "0032 475 46 18 75",
            email: "godfried@adriaenssens-dierickx.be"
        },
        {
            id: 3,
            type: "Conception",
            name: "Devali",
            tel: "+262 6 92 22 28 76",
            email: "contact@devali.fr"
        }
    ]

    return (
        <footer className="w-full border-t-3 border-black/30 dark:border-accent flex flex-col items-center py-6">
            <div className="flex w-full justify-center mb-5 px-10">

                <div className="flex-1 items-start flex justify-center">
                    <a href="/" className="flex items-center gap-3">
                        <AppLogoIconMini className="size-15" />
                        <p className="font-semibold text-lg">Infovegetal</p>
                    </a>

                </div>

                <div className="flex flex-col flex-1 items-center">
                    <div className="flex flex-col items-start">
                        <h4 className="font-semibold text-xl mb-2">{t('Liens')}</h4>
                        {footerLinks.map((link) => (
                            <Button key={link.title} variant="link" className="p-0 font-light">
                                {link.title}
                            </Button>
                        ))}
                    </div>

                </div>

                <div className="flex flex-col flex-1 items-center">
                    <div className="flex flex-col items-start">
                        <h4 className="font-semibold text-xl mb-2">{t('Infos')}</h4>
                        {infoLinks.map((link) => (
                            <Button key={link.title} variant="link" className="p-0 font-light">
                                {link.title}
                            </Button>
                        ))}
                    </div>

                </div>

                <div className="flex flex-col flex-1  items-center">
                    <div className="flex flex-col items-start">
                        <h4 className="font-semibold text-xl mb-2">{t('Une question ?')}</h4>
                        <div className="flex flex-col gap-2">
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