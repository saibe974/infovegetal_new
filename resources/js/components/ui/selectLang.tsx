import { router, usePage } from '@inertiajs/react';
import { DE, ES, FR, GB, IT, NL } from 'country-flag-icons/react/3x2';
import { useEffect, useState, type ReactNode } from 'react';
import { SharedData } from '@/types';
import { SelectWithItems } from './select-with-items';

const LANGS: { value: string; country: string; label: string; countryLabel: string; img: ReactNode }[] = [
    { value: 'en', country: 'GB', label: 'English', countryLabel: 'United Kingdom', img: <GB title="United Kingdom" className="w-4" /> },
    { value: 'fr', country: 'FR', label: 'Français', countryLabel: 'France', img: <FR title="France" className="w-4" /> },
    { value: 'es', country: 'ES', label: 'Español', countryLabel: 'Spain', img: <ES title="Spain" className="w-4" /> },
    { value: 'de', country: 'DE', label: 'Deutsch', countryLabel: 'Germany', img: <DE title="Germany" className="w-4" /> },
    { value: 'it', country: 'IT', label: 'Italiano', countryLabel: 'Italy', img: <IT title="Italy" className="w-4" /> },
    { value: 'nl', country: 'NL', label: 'Nederlands', countryLabel: 'Netherlands', img: <NL title="Netherlands" className="w-4" /> },
];

type SelectLangProps = {
    mode?: 'locale' | 'country';
    value?: string;
    onValueChange?: (value: string) => void;
    name?: string;
    id?: string;
    className?: string;
    'aria-invalid'?: boolean;
};

export function SelectLang({
    mode = 'locale',
    value,
    onValueChange,
    name,
    id,
    className,
    'aria-invalid': ariaInvalid,
}: SelectLangProps = {}) {
    const { locale: serverLocale } = usePage<SharedData>().props;

    const [locale, setLocale] = useState<string>(() => {
        if (typeof window === 'undefined') return (serverLocale as string) ?? 'en';
        const stored = localStorage.getItem('locale');
        if (stored) return stored;
        const userLanguage = 'userLanguage' in navigator
            ? String((navigator as Navigator & { userLanguage?: string }).userLanguage ?? '')
            : '';
        const systemLocale = (navigator.language || userLanguage || 'en').split('-')[0];
        return (serverLocale as string) ?? systemLocale ?? 'en';
    });

    useEffect(() => {
        try {
            document.documentElement.lang = locale;
        } catch {
            // Ignore document language update errors.
        }
        if (typeof window !== 'undefined') {
            localStorage.setItem('locale', locale);
        }
    }, [locale]);

    const handleChange = (selectedValue: string) => {
        if (mode === 'country') {
            onValueChange?.(selectedValue);
            return;
        }

        setLocale(selectedValue);
        onValueChange?.(selectedValue);
        document.cookie = `locale=${selectedValue}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;

        if (typeof window !== 'undefined') {
            localStorage.setItem('locale', selectedValue);
        }

        router.reload();
    };

    const items = mode === 'country'
        ? LANGS.map((lang) => ({ value: lang.country, label: lang.countryLabel, img: lang.img }))
        : LANGS.map((lang) => ({ value: lang.value, label: lang.label, img: lang.img }));

    return (
        <div>
            <SelectWithItems
                name={name ?? (mode === 'country' ? 'country' : 'locale')}
                defaultValue={mode === 'country' ? value?.toUpperCase() : (value ?? locale)}
                items={items}
                id={id ?? (mode === 'country' ? 'country' : 'locale')}
                className={className ?? 'w-11 border-0 bg-none shadow-none hover:bg-sidebar-accent p-0 rounded-md transition-colors'}
                aria-invalid={ariaInvalid}
                onValueChange={handleChange}
            />
        </div>
    );
}
