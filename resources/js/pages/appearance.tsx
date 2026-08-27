import HeadingSmall from '@/components/heading-small';
import {
    AppearanceConfirmationSettings,
    AppearanceGeneralSettings,
    AppearancePageSettings,
} from '@/components/settings/appearance-options';
import { Button } from '@/components/ui/button';
import {
    applyDisplayPreferences,
    defaultDisplayPreferences,
    getStoredDisplayPreferences,
    storeDisplayPreferences,
    type DisplayPreferences,
    type PreferencePage,
} from '@/lib/display-preferences';
import AppLayout from '@/layouts/app-layout';
import type { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Apparence', href: '/appearance' }];

export default function GuestAppearance() {
    const [preferences, setPreferences] = useState<DisplayPreferences>(() =>
        getStoredDisplayPreferences('local'),
    );
    const [savedPreferences, setSavedPreferences] = useState<DisplayPreferences>(() =>
        getStoredDisplayPreferences('local'),
    );
    const [saving, setSaving] = useState(false);
    const dirty = JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

    useEffect(() => {
        applyDisplayPreferences(preferences);
    }, [preferences]);

    const updateGeneral = <K extends keyof DisplayPreferences['general']>(
        key: K,
        value: DisplayPreferences['general'][K],
    ) => {
        setPreferences((prev) => ({ ...prev, general: { ...prev.general, [key]: value } }));
    };

    const updatePage = (
        page: PreferencePage,
        patch: Partial<DisplayPreferences['pages'][PreferencePage]>,
    ) => {
        setPreferences((prev) => ({
            ...prev,
            pages: { ...prev.pages, [page]: { ...prev.pages[page], ...patch } },
        }));
    };

    const updateConfirmation = <K extends keyof DisplayPreferences['confirmations']>(
        key: K,
        value: DisplayPreferences['confirmations'][K],
    ) => {
        setPreferences((prev) => ({
            ...prev,
            confirmations: { ...prev.confirmations, [key]: value },
        }));
    };

    const save = () => {
        setSaving(true);
        storeDisplayPreferences(preferences, 'local');
        applyDisplayPreferences(preferences);
        setSavedPreferences(structuredClone(preferences));
        toast.success('Préférences enregistrées sur cet appareil');
        setSaving(false);
    };

    const reset = () => setPreferences(structuredClone(defaultDisplayPreferences));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Apparence" />

            <div className="space-y-5 py-4">
                <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                    <div className="flex items-end justify-between px-1">
                        <HeadingSmall
                            title="Paramètres d'apparence"
                            description="Personnalisez l'interface. Les préférences sont enregistrées sur cet appareil."
                        />
                        <div className="flex shrink-0 gap-2">
                            <Button variant="outline" size="sm" onClick={reset} disabled={saving}>
                                Réinitialiser
                            </Button>
                            <Button size="sm" onClick={save} disabled={!dirty || saving}>
                                Enregistrer
                            </Button>
                        </div>
                    </div>

                    <AppearanceGeneralSettings
                        preferences={preferences.general}
                        onChange={updateGeneral}
                    />
                    <AppearanceConfirmationSettings
                        confirmations={preferences.confirmations}
                        onChange={updateConfirmation}
                    />
                    <AppearancePageSettings
                        pages={preferences.pages}
                        onChange={updatePage}
                    />
                </div>
            </div>
        </AppLayout>
    );
}
