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
        const stored = localStorage.getItem("locale");
        if (stored) return stored;
        const sys = (navigator.language || (navigator as any).userLanguage || "en").split("-")[0];
        return (serverLocale as string) ?? sys ?? "en";
    });

    useEffect(() => {
        try {
            document.documentElement.lang = locale;
        } catch (e) { }
        // sauvegarde côté client
        if (typeof window !== "undefined") {
            localStorage.setItem("locale", locale);
        }
    }, [locale, serverLocale]);

    const handleChange = (e: any) => {
        const v = e.target.value;
        setLocale(v);
        document.cookie = `locale=${v}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
        router.reload();
    };


    const current = LANGS.find((l) => l.value === locale) ?? LANGS[0];

    return (
        <div>
            <SelectWithItems
                name="locale"
                defaultValue={(auth?.user as any)?.locale ?? (locale as string) ?? "en"}
                items={LANGS}
                id="locale"
                className="w-10 border-0 hover:bg-sidebar-accent p-0"
            // onChange={handleChange}
            />
        </div>
    );
}