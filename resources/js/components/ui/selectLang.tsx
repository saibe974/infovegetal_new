import { router, usePage } from "@inertiajs/react";
import { useEffect, useState } from "react";
import { SelectWithItems } from "./select-with-items";
import { SharedData } from "@/types";
import { GB, FR, ES, DE, IT, NL } from 'country-flag-icons/react/3x2'

const LANGS: { value: string; label: string; img: any }[] = [
    { value: "en", label: "English", img: <GB title="United Kingdom" className="w-4" /> },
    { value: "fr", label: "Français", img: <FR title="France" className="w-4" /> },
    { value: "es", label: "Español", img: <ES title="Spain" className="w-4" /> },
    { value: "de", label: "Deutsch", img: <DE title="Germany" className="w-4" /> },
    { value: "it", label: "Italiano", img: <IT title="Italy" className="w-4" /> },
    { value: "nl", label: "Nederlands", img: <NL title="Netherlands" className="w-4" /> },
];

export function SelectLang() {
    const { auth, locale: serverLocale } = usePage<SharedData>().props;

    const [locale, setLocale] = useState<string>(() => {
        if (typeof window === "undefined") return (serverLocale as string) ?? "en";
        // Si l'utilisateur est connecté, utiliser sa préférence
        if (auth?.user && (auth.user as any).locale) {
            return (auth.user as any).locale;
        }
        // Sinon vérifier le localStorage
        const stored = localStorage.getItem("locale");
        if (stored) return stored;
        // Ou utiliser la locale du serveur ou du système
        const sys = (navigator.language || (navigator as any).userLanguage || "en").split("-")[0];
        return (serverLocale as string) ?? sys ?? "en";
    });

    useEffect(() => {
        try {
            document.documentElement.lang = locale;
        } catch (e) { }
        // Sauvegarde côté client pour les utilisateurs non connectés
        if (typeof window !== "undefined" && !auth?.user) {
            localStorage.setItem("locale", locale);
        }
    }, [locale, auth?.user]);

    const handleChange = (newLocale: string) => {
        setLocale(newLocale);

        // Sauvegarder dans un cookie pour la session
        document.cookie = `locale=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

        // Sauvegarder dans localStorage pour les utilisateurs non connectés
        if (typeof window !== "undefined" && !auth?.user) {
            localStorage.setItem("locale", newLocale);
        }

        // Si l'utilisateur est connecté, sauvegarder dans la base de données
        if (auth?.user) {
            router.put(
                '/user/locale',
                { locale: newLocale },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        // Recharger la page pour appliquer la nouvelle langue
                        router.reload({ only: ['locale'] });
                    },
                }
            );
        } else {
            // Pour les utilisateurs non connectés, simplement recharger
            router.reload();
        }
    };

    return (
        <div>
            <SelectWithItems
                name="locale"
                defaultValue={locale}
                items={LANGS}
                id="locale"
                className="w-10 border-0 hover:bg-sidebar-accent p-0"
                onValueChange={handleChange}
            />
        </div>
    );
}