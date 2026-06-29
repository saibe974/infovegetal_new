import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import InputError from '@/components/ui/input-error';
import SearchSelect from '@/components/app/search-select';
import { TrashIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { type BillingDraft } from '@/components/sales/types';

type Option = { value: string; label: string };

type BillingUserSelectorProps = {
    className?: string;
    billingUsers: BillingDraft[];
    activeBillingUserId: number | null;
    userOptionById: Map<number, Option>;
    billingSearch: string;
    setBillingSearch: (value: string) => void;
    availableBillingOptions: Option[];
    canManageBillingUsers: boolean;
    onSelectBillingUser: (id: number) => void;
    onAddBillingUser: (id: number) => void;
    onDeleteBillingUser: (id: number) => void;
    errors?: Record<string, string>;
};

export default function BillingUserSelector({
    className,
    billingUsers,
    activeBillingUserId,
    userOptionById,
    billingSearch,
    setBillingSearch,
    availableBillingOptions,
    canManageBillingUsers,
    onSelectBillingUser,
    onAddBillingUser,
    onDeleteBillingUser,
    errors,
}: BillingUserSelectorProps) {
    const { t } = useI18n();

    return (
        <Card className={`p-6 space-y-4 ${className ?? ''}`}>
            {canManageBillingUsers ? (
                <FormField label={t('Ajouter un Facturant')}>
                    <SearchSelect
                        value={billingSearch}
                        onChange={setBillingSearch}
                        onSubmit={(value) => {
                            const id = Number(value.trim().split(/\s+/).pop() ?? '');
                            if (!Number.isInteger(id) || id <= 0) {
                                return;
                            }

                            onAddBillingUser(id);
                            setBillingSearch('');
                        }}
                        propositions={availableBillingOptions}
                        selection={[]}
                        loading={false}
                        minQueryLength={0}
                    />
                    <InputError message={errors?.billing_users} />
                </FormField>
            ) : null}

            <div className="space-y-2 max-h-[460px] overflow-y-auto">
                {billingUsers.map((rule) => {
                    const id = Number(rule.billing_user_id);
                    const option = userOptionById.get(id);
                    if (!option) {
                        return null;
                    }

                    return (
                        <div key={id} className="flex items-center justify-between gap-2">
                            <button
                                type="button"
                                className={`text-left rounded-md px-3 py-2 w-full border ${activeBillingUserId === id ? 'bg-muted border-primary' : 'border-border'}`}
                                onClick={() => onSelectBillingUser(id)}
                            >
                                <span className="font-medium">{option.label}</span>
                            </button>
                            {canManageBillingUsers ? (
                                <Button
                                    type="button"
                                    variant="destructive-outline"
                                    size="icon"
                                    onClick={() => onDeleteBillingUser(id)}
                                >
                                    <TrashIcon className="h-4 w-4" />
                                </Button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
