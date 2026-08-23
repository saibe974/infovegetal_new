import { router, usePage } from '@inertiajs/react';
import { BE, DE, ES, FR, GB, IT, NL } from 'country-flag-icons/react/3x2';
import { useEffect, useState, type ReactNode } from 'react';
import { SharedData } from '@/types';
import { SelectWithItems } from './select-with-items';

const LANGS: { value: string; label: string; img: ReactNode }[] = [
    { value: 'en', label: 'English', img: <GB title="United Kingdom" className="w-4" /> },
    { value: 'fr', label: 'Français', img: <FR title="France" className="w-4" /> },
    { value: 'es', label: 'Español', img: <ES title="Spain" className="w-4" /> },
    { value: 'de', label: 'Deutsch', img: <DE title="Germany" className="w-4" /> },
    { value: 'it', label: 'Italiano', img: <IT title="Italy" className="w-4" /> },
    { value: 'nl', label: 'Nederlands', img: <NL title="Netherlands" className="w-4" /> },
];

const COUNTRIES: { value: string; label: string; img: ReactNode }[] = [
    { value: 'BE', label: 'Belgium', img: <BE title="Belgium" className="w-4" /> },
    { value: 'DE', label: 'Germany', img: <DE title="Germany" className="w-4" /> },
    { value: 'ES', label: 'Spain', img: <ES title="Spain" className="w-4" /> },
    { value: 'FR', label: 'France', img: <FR title="France" className="w-4" /> },
    { value: 'GB', label: 'United Kingdom', img: <GB title="United Kingdom" className="w-4" /> },
    { value: 'IT', label: 'Italy', img: <IT title="Italy" className="w-4" /> },
    { value: 'NL', label: 'Netherlands', img: <NL title="Netherlands" className="w-4" /> },
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
        ? COUNTRIES
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
