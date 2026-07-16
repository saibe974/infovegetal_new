<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class SalesConditionSnapshotResolver
{
    /**
     * BR-018
     * BR-019
     *
     * @param array<string, mixed> $defaults
     * @param array<string, mixed> $sellerRuleData
     * @param array<string, mixed> $clientOverride
     * @return array<string, mixed>
     */
    public function resolve(array $defaults, array $sellerRuleData = [], array $clientOverride = []): array
    {
        $defaultConditions = $this->extractDefaultConditions($defaults);

        $billingToSellerConditions = $defaultConditions;
        $sellerDefaults = $this->extractDefaultConditions(
            is_array($sellerRuleData['seller_defaults'] ?? null) ? $sellerRuleData['seller_defaults'] : []
        );

        if (!empty($sellerRuleData)) {
            if ((bool) ($sellerRuleData['use_billing_profile'] ?? true)) {
                $profileConditions = $this->extractProfileConditionsById(
                    $defaults,
                    isset($sellerRuleData['billing_profile_id']) ? (string) $sellerRuleData['billing_profile_id'] : null,
                );

                $billingToSellerConditions = !empty($profileConditions) ? $profileConditions : $defaultConditions;
            } else {
                $billingToSellerConditions = is_array($sellerRuleData['conditions'] ?? null)
                    ? $sellerRuleData['conditions']
                    : [];
            }
        }

        $resolved = array_replace_recursive($billingToSellerConditions, $sellerDefaults, $clientOverride);

        return [
            'resolved' => $resolved,
            'defaults' => $defaults,
            'billing_to_seller_conditions' => $billingToSellerConditions,
            'seller_defaults' => $sellerDefaults,
            'client_override' => $clientOverride,
        ];
    }

    /**
     * BR-019
     *
     * @param array<string, mixed> $defaults
     * @return array<string, mixed>
     */
    public function extractDefaultConditions(array $defaults): array
    {
        $profiles = $defaults['profiles'] ?? null;
        if (!is_array($profiles)) {
            return $defaults;
        }

        if (empty($profiles)) {
            return [];
        }

        $defaultProfileId = isset($defaults['default_profile_id']) ? (string) $defaults['default_profile_id'] : null;
        $selected = null;

        foreach ($profiles as $profile) {
            if (!is_array($profile)) {
                continue;
            }

            $profileId = (string) ($profile['id'] ?? '');
            if ($defaultProfileId !== null && $profileId === $defaultProfileId) {
                $selected = $profile;
                break;
            }
        }

        if (!$selected) {
            $selected = is_array($profiles[0] ?? null) ? $profiles[0] : [];
        }

        return is_array($selected['conditions'] ?? null) ? $selected['conditions'] : [];
    }

    /**
     * BR-019
     *
     * @param array<string, mixed> $defaults
     * @return array<string, mixed>
     */
    public function extractProfileConditionsById(array $defaults, ?string $profileId): array
    {
        $profiles = $defaults['profiles'] ?? null;
        if (!is_array($profiles) || empty($profiles)) {
            return [];
        }

        if ($profileId) {
            foreach ($profiles as $profile) {
                if (!is_array($profile)) {
                    continue;
                }

                if ((string) ($profile['id'] ?? '') === $profileId) {
                    return is_array($profile['conditions'] ?? null) ? $profile['conditions'] : [];
                }
            }
        }

        return $this->extractDefaultConditions($defaults);
    }
}