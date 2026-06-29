import {
    type BillingDefaults,
    type SalesConditions,
} from '@/types';

export type UserOption = {
    id: number;
    name: string;
    email: string;
};

export type SellerDraft = {
    seller_user_id: number;
    conditions: SalesConditions;
    use_billing_profile: boolean;
    billing_profile_id: string | null;
    seller_defaults?: BillingDefaults;
    has_seller_defaults?: boolean;
    can_manage: boolean;
};

export type BillingDraft = {
    billing_user_id: number;
    defaults: BillingDefaults;
    sellers: SellerDraft[];
};

export type ActivePanelItem = {
    type: 'profile' | 'seller';
    id: string | number;
} | null;
