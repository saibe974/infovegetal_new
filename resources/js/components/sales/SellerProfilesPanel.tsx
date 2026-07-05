import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonsActions } from '../buttons-actions';
import { TrashIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { type BillingDefaults } from '@/types';

type SellerProfile = BillingDefaults['profiles'][number];

type SellerProfilesPanelProps = {
    className?: string;
    currentSeller: { seller_user_id: number } | null;
    currentSellerDefaults: BillingDefaults | null;
    currentSellerProfile: SellerProfile | null;
    activeSellerProfileId: string | null;
    setActiveSellerProfileId: (value: string | null) => void;
    canManageSellerProfiles: boolean;
    onAddSellerProfile: () => void;
    onDeleteSellerProfile: (profileId: string) => void;
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
}: SellerProfilesPanelProps) {
    const { t } = useI18n();

    return (
        <Card className={`p-6 space-y-4 ${className ?? ''}`}>
            <CardHeader className="px-0 pb-2">
                <CardTitle>{t('Profils commerciaux')}</CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-4">
                {canManageSellerProfiles && currentSeller ? (
                    <div className="flex justify-end">
                        <ButtonsActions
                            add={onAddSellerProfile}
                        />
                    </div>
                ) : null}

                {(currentSellerDefaults?.profiles ?? []).length > 0 ? (
                    <div className="space-y-2 max-h-[520px] overflow-y-auto">
                        {(currentSellerDefaults?.profiles ?? []).map((profile) => (
                            <div key={profile.id} className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    className={`text-left rounded-md px-3 py-2 w-full border ${activeSellerProfileId === profile.id || currentSellerProfile?.id === profile.id ? 'bg-muted border-primary' : 'border-border'}`}
                                    onClick={() => setActiveSellerProfileId(profile.id)}
                                >
                                    <span className="font-medium">{profile.name}</span>
                                </button>
                                {canManageSellerProfiles ? (
                                    <Button
                                        type="button"
                                        variant="destructive-outline"
                                        size="icon"
                                        onClick={() => onDeleteSellerProfile(profile.id)}
                                    >
                                        <TrashIcon className="h-4 w-4" />
                                    </Button>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">{t('Aucun profil commercial défini.')}</p>
                )}
            </CardContent>
        </Card>
    );
}
