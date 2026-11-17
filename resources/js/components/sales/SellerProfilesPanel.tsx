import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';
import { type BillingDefaults } from '@/types';
import { TrashIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { ButtonsActions } from '../buttons-actions';

/** Le panneau n'utilise que l'id et le nom : réutilisable pour d'autres profils. */
type SellerProfile = Pick<BillingDefaults['profiles'][number], 'id' | 'name'>;

type SellerProfilesPanelProps = {
    className?: string;
    currentSeller: { seller_user_id: number } | null;
    currentSellerDefaults: { profiles: SellerProfile[] } | null;
    currentSellerProfile: SellerProfile | null;
    activeSellerProfileId: string | null;
    setActiveSellerProfileId: (value: string | null) => void;
    canManageSellerProfiles: boolean;
    onAddSellerProfile: () => void;
    onDeleteSellerProfile: (profileId: string) => void;
    title?: string;
    emptyLabel?: string;
    children?: ReactNode;
};

export default function SellerProfilesPanel({
    className,
    currentSeller,
    currentSellerDefaults,
    currentSellerProfile,
    activeSellerProfileId,
    setActiveSellerProfileId,
    canManageSellerProfiles,
    onAddSellerProfile,
    onDeleteSellerProfile,
    title,
    emptyLabel,
    children,
}: SellerProfilesPanelProps) {
    const { t } = useI18n();

    return (
        <Card className={`space-y-4 p-6 ${className ?? ''}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 px-0 pb-2">
                <CardTitle>{title ?? t('Profils commerciaux')}</CardTitle>
                {canManageSellerProfiles && currentSeller ? (
                    <ButtonsActions add={onAddSellerProfile} />
                ) : null}
            </CardHeader>
            <CardContent className="space-y-4 px-0">
                {(currentSellerDefaults?.profiles ?? []).length > 0 ? (
                    <div className="max-h-[520px] space-y-2 overflow-y-auto">
                        {(currentSellerDefaults?.profiles ?? []).map(
                            (profile) => (
                                <div
                                    key={profile.id}
                                    className="flex items-center justify-between gap-2"
                                >
                                    <button
                                        type="button"
                                        className={`w-full rounded-md border px-3 py-2 text-left ${activeSellerProfileId === profile.id || currentSellerProfile?.id === profile.id ? 'border-primary bg-muted' : 'border-border'}`}
                                        onClick={() =>
                                            setActiveSellerProfileId(profile.id)
                                        }
                                    >
                                        <span className="font-medium">
                                            {profile.name}
                                        </span>
                                    </button>
                                    {canManageSellerProfiles ? (
                                        <Button
                                            type="button"
                                            variant="destructive-outline"
                                            size="icon"
                                            onClick={() =>
                                                onDeleteSellerProfile(
                                                    profile.id,
                                                )
                                            }
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </Button>
                                    ) : null}
                                </div>
                            ),
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {emptyLabel ?? t('Aucun profil commercial défini.')}
                    </p>
                )}
                {children}
            </CardContent>
        </Card>
    );
}
