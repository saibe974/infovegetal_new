<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Models\ClientSalesCondition;
use App\Models\DbProductSellerUser;

final class SalesConditionRelationResolver
{
    /**
     * BR-020
     *
     * @return array<string, mixed>
     */
    public function resolveSellerRuleData(?int $dbProductId, ?int $billingUserId, ?int $sellerUserId): array
    {
        if (!$dbProductId || !$billingUserId || !$sellerUserId) {
            return [];
        }

        $sellerRule = DbProductSellerUser::query()
            ->where('db_product_id', $dbProductId)
            ->where('seller_user_id', $sellerUserId)
            ->where(function ($query) use ($billingUserId) {
                $query->where('billing_user_id', $billingUserId)
                    ->orWhereNull('billing_user_id');
            })
            ->where('active', true)
            ->orderByRaw('CASE WHEN billing_user_id IS NULL THEN 1 ELSE 0 END')
            ->first();

        if (!$sellerRule) {
            return [];
        }

        return [
            'conditions' => is_array($sellerRule->conditions) ? $sellerRule->conditions : [],
            'seller_defaults' => is_array($sellerRule->seller_defaults) ? $sellerRule->seller_defaults : [],
            'use_billing_profile' => (bool) ($sellerRule->use_billing_profile ?? true),
            'billing_profile_id' => $sellerRule->billing_profile_id ? (string) $sellerRule->billing_profile_id : null,
        ];
    }

    /**
     * BR-021
     *
     * @return array<string, mixed>
     */
    public function resolveClientOverride(?int $dbProductId, ?int $billingUserId, ?int $sellerUserId, ?int $clientUserId): array
    {
        if (!$dbProductId || !$billingUserId || !$sellerUserId || !$clientUserId) {
            return [];
        }

        $clientRule = ClientSalesCondition::query()
            ->where('client_user_id', $clientUserId)
            ->where('db_product_id', $dbProductId)
            ->where('billing_user_id', $billingUserId)
            ->where('seller_user_id', $sellerUserId)
            ->where('active', true)
            ->first();

        return $clientRule && is_array($clientRule->conditions_override)
            ? $clientRule->conditions_override
            : [];
    }
}