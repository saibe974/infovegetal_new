import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SalesConditionsForm from '@/components/sales/sales-conditions-form';
import { useI18n } from '@/lib/i18n';
import { type SalesConditionProfile, type SalesConditions } from '@/types';

type SellerProfileConditionsEditorProps = {
    className?: string;
    currentSeller: { seller_user_id: number } | null;
    currentSellerProfile: SalesConditionProfile | null;
    canManageSellerProfiles: boolean;
    carriers: Array<{ id: number; name: string; country?: string | null; zones?: Array<{ id: number; carrier_id: number; name: string }> }>;
    onRenameSellerProfile: (value: string) => void;
    onChangeSellerProfileConditions: (value: SalesConditions) => void;
};

export default function SellerProfileConditionsEditor({
    className,
    currentSeller,
    currentSellerProfile,
    canManageSellerProfiles,
    carriers,
    onRenameSellerProfile,
    onChangeSellerProfileConditions,
}: SellerProfileConditionsEditorProps) {
    const { t } = useI18n();

    return (
        <Card className={`p-6 space-y-4 ${className ?? ''}`}>
            {!currentSeller ? (
                <p className="text-sm text-muted-foreground">{t('Aucun commercial sélectionné.')}</p>
            ) : currentSellerProfile ? (
                <>
                    <CardHeader className="px-0">
                        <CardTitle>{t('Profil commercial')}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-0 space-y-3 rounded-md border p-3">
                        <input
                            className="w-full rounded-md border px-3 py-2"
                            value={currentSellerProfile.name}
                            disabled={!canManageSellerProfiles}
                            onChange={(e) => {
                                if (!canManageSellerProfiles) {
                                    return;
                                }

                                onRenameSellerProfile(e.target.value);
                            }}
                        />

                        <SalesConditionsForm
                            value={currentSellerProfile.conditions ?? {}}
                            onChange={(next) => {
                                if (!canManageSellerProfiles) {
                                    return;
                                }

                                onChangeSellerProfileConditions(next);
                            }}
                            carriers={carriers ?? []}
                            mode="defaults"
                        />
                    </CardContent>
                </>
            ) : (
                <p className="text-sm text-muted-foreground">{t('Aucun profil commercial défini.')}</p>
            )}
        </Card>
    );
}
