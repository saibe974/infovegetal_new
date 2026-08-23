import EditableProfileTitle from '@/components/sales/EditableProfileTitle';
import SalesConditionsForm from '@/components/sales/sales-conditions-form';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { type SalesConditionProfile, type SalesConditions } from '@/types';

type SellerProfileConditionsEditorProps = {
    className?: string;
    currentSeller: { seller_user_id: number } | null;
    currentSellerProfile: SalesConditionProfile | null;
    canManageSellerProfiles: boolean;
    carriers: Array<{
        id: number;
        name: string;
        country?: string | null;
        zones?: Array<{ id: number; carrier_id: number; name: string }>;
    }>;
    onRenameSellerProfile: (value: string) => void;
    onChangeSellerProfileConditions: (value: SalesConditions) => void;
    showProfileHeader?: boolean;
    embedded?: boolean;
};

export default function SellerProfileConditionsEditor({
    className,
    currentSeller,
    currentSellerProfile,
    canManageSellerProfiles,
    carriers,
    onRenameSellerProfile,
    onChangeSellerProfileConditions,
    showProfileHeader = true,
    embedded = false,
}: SellerProfileConditionsEditorProps) {
    const { t } = useI18n();
    const Container = embedded ? 'div' : Card;
    const ContentContainer = embedded ? 'div' : CardContent;

    return (
        <Container
            className={
                embedded
                    ? `space-y-3 ${className ?? ''}`
                    : `space-y-4 p-6 ${className ?? ''}`
            }
        >
            {!currentSeller ? (
                <p className="text-sm text-muted-foreground">
                    {t('Aucun commercial sélectionné.')}
                </p>
            ) : currentSellerProfile ? (
                <>
                    {showProfileHeader ? (
                        <CardHeader className="px-0">
                            <div className="flex items-center gap-3">
                                <label className="flex shrink-0 items-center gap-2 text-sm">
                                    <Input
                                        type="checkbox"
                                        className="size-4"
                                        checked={Boolean(
                                            currentSellerProfile.conditions
                                                ?.retro_com,
                                        )}
                                        disabled={!canManageSellerProfiles}
                                        onChange={(event) =>
                                            onChangeSellerProfileConditions({
                                                ...(currentSellerProfile.conditions ??
                                                    {}),
                                                retro_com: event.target.checked
                                                    ? 1
                                                    : 0,
                                            })
                                        }
                                    />
                                    <span>{t('Rétro com')}</span>
                                </label>
                                <EditableProfileTitle
                                    name={currentSellerProfile.name}
                                    canEdit={canManageSellerProfiles}
                                    onRename={onRenameSellerProfile}
                                />
                            </div>
                        </CardHeader>
                    ) : null}
                    <ContentContainer
                        className={
                            embedded
                                ? 'space-y-3'
                                : 'space-y-3 rounded-md border p-3 px-0'
                        }
                    >
                        {currentSellerProfile.conditions?.retro_com ? (
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {t('Marge sur facturant')}
                                </label>
                                <div className="relative max-w-xs">
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        step="any"
                                        className="pr-8"
                                        disabled={!canManageSellerProfiles}
                                        value={
                                            currentSellerProfile.conditions
                                                ?.billing_margin ?? 0
                                        }
                                        onChange={(event) =>
                                            onChangeSellerProfileConditions({
                                                ...(currentSellerProfile.conditions ??
                                                    {}),
                                                billing_margin: Number(
                                                    event.target.value,
                                                ),
                                            })
                                        }
                                    />
                                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                                        %
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <SalesConditionsForm
                                value={currentSellerProfile.conditions ?? {}}
                                onChange={(next) => {
                                    if (!canManageSellerProfiles) return;
                                    onChangeSellerProfileConditions(next);
                                }}
                                carriers={carriers ?? []}
                                mode="defaults"
                                hideTitle={!showProfileHeader}
                                embedded={embedded}
                            />
                        )}
                    </ContentContainer>
                </>
            ) : (
                <p className="text-sm text-muted-foreground">
                    {t('Aucun profil commercial défini.')}
                </p>
            )}
        </Container>
    );
}
