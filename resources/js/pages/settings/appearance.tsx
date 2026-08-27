import HeadingSmall from '@/components/heading-small';
import {
    AppearanceConfirmationSettings,
    AppearanceGeneralSettings,
    AppearancePageSettings,
} from '@/components/settings/appearance-options';
import { AppearanceToolbar } from '@/components/settings/appearance-toolbar';
import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import {
    applyDisplayPreferences,
    defaultDisplayPreferences,
    getPreferenceScope,
    getStoredDisplayPreferences,
    normalizeDisplayPreferences,
    previewDisplayPreferences,
    saveAccountDisplayPreferences,
    setPreferenceScope,
    storeDisplayPreferences,
    type DisplayPreferences,
    type PreferencePage,
    type PreferenceScope,
} from '@/lib/display-preferences';
import { useI18n } from '@/lib/i18n';
import { edit as editAdminAppearance } from '@/routes/appearance';
import { edit as editSettingsAppearance } from '@/routes/settings/appearance';
import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type AppearancePageProps = SharedData & {
    editingUser?: User;
    appearancePreferences?: DisplayPreferences | null;
};

const copyPreferences = (preferences: DisplayPreferences): DisplayPreferences =>
    structuredClone(preferences);

export default function Appearance() {
    const { t } = useI18n();
    const { auth, editingUser, appearancePreferences } =
        usePage<AppearancePageProps>().props;
    const userId = editingUser?.id ?? auth.user?.id;
    const isSelf = !editingUser || editingUser.id === auth.user?.id;
    const [scope, setScope] = useState<PreferenceScope>(() =>
        isSelf ? getPreferenceScope(Boolean(appearancePreferences)) : 'account',
    );
    const initialPreferences = () =>
        isSelf
            ? getStoredDisplayPreferences(scope)
            : normalizeDisplayPreferences(appearancePreferences);
    const [preferences, setPreferences] =
        useState<DisplayPreferences>(initialPreferences);
    const [savedPreferences, setSavedPreferences] =
        useState<DisplayPreferences>(initialPreferences);
    const [saving, setSaving] = useState(false);
    const dirty =
        JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

    useEffect(() => {
        if (isSelf) previewDisplayPreferences(preferences);
    }, [isSelf, preferences]);

    if (!userId) return null;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Appearance settings'),
            href: (isSelf
                ? editSettingsAppearance()
                : editAdminAppearance(userId)
            ).url,
        },
    ];

    const updateGeneral = <K extends keyof DisplayPreferences['general']>(
        key: K,
        value: DisplayPreferences['general'][K],
    ) => {
        setPreferences((current) => ({
            ...current,
            general: { ...current.general, [key]: value },
        }));
    };

    const updatePage = (
        page: PreferencePage,
        patch: Partial<DisplayPreferences['pages'][PreferencePage]>,
    ) => {
        setPreferences((current) => ({
            ...current,
            pages: {
                ...current.pages,
                [page]: { ...current.pages[page], ...patch },
            },
        }));
    };

    const updateConfirmation = <
        K extends keyof DisplayPreferences['confirmations'],
    >(
        key: K,
        value: DisplayPreferences['confirmations'][K],
    ) => {
        setPreferences((current) => ({
            ...current,
            confirmations: { ...current.confirmations, [key]: value },
        }));
    };

    const selectScope = (nextScope: PreferenceScope) => {
        if (nextScope === scope) return;
        if (
            dirty &&
            !window.confirm('Abandonner les modifications non enregistrées ?')
        ) {
            return;
        }

        const nextPreferences = getStoredDisplayPreferences(nextScope);
        setScope(nextScope);
        setPreferenceScope(nextScope);
        setPreferences(copyPreferences(nextPreferences));
        setSavedPreferences(copyPreferences(nextPreferences));
        applyDisplayPreferences(nextPreferences);
    };

    const save = async () => {
        setSaving(true);
        try {
            if (scope === 'account') {
                await saveAccountDisplayPreferences(
                    preferences,
                    isSelf
                        ? '/settings/appearance'
                        : `/admin/users/${userId}/appearance`,
                );
            } else {
                storeDisplayPreferences(preferences, 'local');
            }

            if (isSelf) {
                setPreferenceScope(scope);
                applyDisplayPreferences(preferences);
            }
            setSavedPreferences(copyPreferences(preferences));
            toast.success(
                scope === 'account'
                    ? 'Préférences enregistrées sur le compte'
                    : 'Préférences enregistrées sur cet appareil',
            );
        } catch {
            toast.error("Les préférences n'ont pas pu être enregistrées");
        } finally {
            setSaving(false);
        }
    };

    const reset = () =>
        setPreferences(copyPreferences(defaultDisplayPreferences));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Appearance settings')} />

            <SettingsLayout>
                <div className="space-y-5 py-4">
                    <AppearanceToolbar
                        scope={scope}
                        isSelf={isSelf}
                        userName={editingUser?.name}
                        dirty={dirty}
                        saving={saving}
                        onScopeChange={selectScope}
                        onReset={reset}
                        onSave={save}
                    />

                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
                        <div className="px-1">
                            <HeadingSmall
                                title={t('Appearance settings')}
                                description="Personnalisez l’interface et choisissez où conserver vos préférences."
                            />
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
            </SettingsLayout>
        </AppLayout>
    );
}
