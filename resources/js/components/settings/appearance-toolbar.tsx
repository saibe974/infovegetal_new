import { ButtonsActions } from '@/components/buttons-actions';
import { StickyBar } from '@/components/ui/sticky-bar';
import type { PreferenceScope } from '@/lib/display-preferences';
import { Cloud, Monitor } from 'lucide-react';

type Props = {
    scope: PreferenceScope;
    isSelf: boolean;
    userName?: string;
    dirty: boolean;
    saving: boolean;
    onScopeChange: (scope: PreferenceScope) => void;
    onReset: () => void;
    onSave: () => void;
};

export function AppearanceToolbar({
    scope,
    isSelf,
    userName,
    dirty,
    saving,
    onScopeChange,
    onReset,
    onSave,
}: Props) {
    return (
        <StickyBar topOffsetElement=".top-sticky, .settings-sticky">
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="hidden shrink-0 text-sm text-muted-foreground md:inline">
                    Enregistrer dans :
                </span>

                {isSelf ? (
                    <div
                        className="appearance-scope-switch"
                        role="group"
                        aria-label="Emplacement des préférences"
                    >
                        <button
                            type="button"
                            className="appearance-scope-button"
                            aria-pressed={scope === 'local'}
                            title="Sur cet appareil"
                            onClick={() => onScopeChange('local')}
                        >
                            <Monitor />
                            <span className="hidden sm:inline">
                                Cet appareil
                            </span>
                        </button>
                        <button
                            type="button"
                            className="appearance-scope-button"
                            aria-pressed={scope === 'account'}
                            title="Sur mon compte"
                            onClick={() => onScopeChange('account')}
                        >
                            <Cloud />
                            <span className="hidden sm:inline">Mon compte</span>
                        </button>
                    </div>
                ) : (
                    <div className="appearance-account-label">
                        <Cloud />
                        <span className="truncate">Compte de {userName}</span>
                    </div>
                )}
            </div>

            <ButtonsActions
                reset={onReset}
                save={onSave}
                saving={saving}
                saveDisabled={!dirty}
            />
        </StickyBar>
    );
}
