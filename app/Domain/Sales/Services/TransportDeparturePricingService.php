<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Models\Carrier;

final class TransportDeparturePricingService
{
    public function calculate(array $rollDistribution, array $pivotsByDbProductId): float
    {
        return $this->calculateBreakdown($rollDistribution, $pivotsByDbProductId)['total'];
    }

    /** One invocation represents the cart's common delivery address and date. */
    public function calculateBreakdown(array $rollDistribution, array $pivotsByDbProductId): array
    {
        $groups = [];
        $byDb = [];
        $carrierIds = array_map(fn ($attrs) => $this->resolveTransportChoice($attrs)['carrier_id'], $pivotsByDbProductId);
        $carriers = Carrier::with(['zones', 'dbProducts'])->whereIn('id', array_unique($carrierIds))->get()->keyBy('id');
        foreach ($rollDistribution['suppliers'] ?? [] as $supplier) {
            $dbId = (int) ($supplier['supplier_id'] ?? 0);
            $rolls = $supplier['rolls'] ?? [];
            $attrs = $pivotsByDbProductId[$dbId] ?? [];
            if (($supplier['mod_liv'] ?? '') !== 'roll' || ! $rolls) {
                continue;
            }
            $choice = $this->resolveTransportChoice($attrs);
            $carrierId = $choice['carrier_id'];
            $zoneId = $choice['zone_id'];
            $rendered = $this->normalizeShippingPriceMode($attrs['p'] ?? 0) === 1;
            $fills = array_map(fn ($roll) => $this->tariffToFillRatio($this->tariffToFloat($roll['coef'] ?? 0)), $rolls);
            if ($carrierId > 0) {
                $carrier = $carriers->get($carrierId);
                $zone = $carrier?->zones->firstWhere('id', $zoneId);
                $base = $carrier?->dbProducts->firstWhere('id', $dbId);
                if (! $carrier || ! $zone || ! $base) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'transport_selection' => "Le transporteur ou la zone ne dessert plus la base #{$dbId}. Choisissez un transporteur disponible.",
                    ]);
                }
                $key = $carrierId.':'.$zoneId;
                $groups[$key] ??= ['carrier_id' => $carrierId, 'zone_id' => $zoneId, 'tariffs' => $zone->tariffs ?? [], 'taxgo' => (float) $carrier->taxgo, 'bases' => []];
                $groups[$key]['bases'][] = ['id' => $dbId, 'count' => count($rolls), 'fills' => $fills, 'rendered' => $rendered, 'supplement' => (float) $base->pivot->supplement_per_roll];
            } else {
                $price = max(0, $this->tariffToFloat($attrs['l'] ?? 0));
                $minimum = max(0, $this->tariffToFloat($attrs['lm'] ?? 0));
                $cost = max($minimum, count($rolls) * $price);
                if ($rendered) {
                    $cost = max(0, $cost - array_sum($fills) * $price);
                }
                $byDb[$dbId] = round($cost * (1 + max(0, $this->tariffToFloat($attrs['tvat'] ?? 0)) / 100), 2);
            }
        }
        $breakdown = [];
        foreach ($groups as $group) {
            $count = array_sum(array_column($group['bases'], 'count'));
            $price = (new TransportZoneTariffResolver)->resolve($count, $group['tariffs']);
            $minimum = max(0, $this->tariffToFloat($group['tariffs']['mini'] ?? 0));
            $minimumGap = max(0, $minimum - $price * $count);
            $rate = 1 + max(0, $group['taxgo']) / 100;
            $groupTotal = 0;
            foreach ($group['bases'] as $base) {
                $grid = $price * $base['count'] + $minimumGap * $base['count'] / $count;
                $embedded = $base['rendered'] ? array_sum($base['fills']) * $price : 0;
                $supplement = $base['count'] * $base['supplement'];
                $amount = round((max(0, $grid - $embedded) + $supplement) * $rate, 2);
                $byDb[$base['id']] = $amount;
                $groupTotal += $amount;
            }
            $breakdown[] = ['carrier_id' => $group['carrier_id'], 'zone_id' => $group['zone_id'], 'roll_count' => $count, 'price_per_roll' => $price, 'bases' => $group['bases'], 'total' => round($groupTotal, 2)];
        }

        return ['total' => round(array_sum($byDb), 2), 'by_db' => $byDb, 'groups' => $breakdown];
    }

    /**
     * @param  array<string, mixed>  $attrs
     * @return array{carrier_id:int,zone_id:int}
     */
    private function resolveTransportChoice(array $attrs): array
    {
        $selected = $attrs['transport_selection'][0] ?? null;
        if (is_array($selected)) {
            return ['carrier_id' => (int) ($selected['carrier_id'] ?? 0), 'zone_id' => (int) ($selected['zone_id'] ?? 0)];
        }
        $legacyCarrierId = is_numeric($attrs['t'] ?? null) ? (int) $attrs['t'] : 0;
        $legacyZoneId = (int) ($attrs['z'] ?? 0);

        if ($legacyCarrierId > 0 && $legacyZoneId > 0) {
            return [
                'carrier_id' => $legacyCarrierId,
                'zone_id' => $legacyZoneId,
            ];
        }

        $raw = $attrs['t'] ?? null;
        $parsed = is_string($raw) ? json_decode($raw, true) : $raw;
        if (! is_array($parsed) || empty($parsed)) {
            return [
                'carrier_id' => 0,
                'zone_id' => 0,
            ];
        }

        $preferredZoneId = (int) ($attrs['z'] ?? 0);
        $selected = null;

        foreach ($parsed as $option) {
            if (! is_array($option)) {
                continue;
            }

            $carrierId = (int) ($option['carrier_id'] ?? 0);
            $zoneId = (int) ($option['zone_id'] ?? 0);
            if ($carrierId <= 0 || $zoneId <= 0) {
                continue;
            }

            if ($preferredZoneId > 0 && $zoneId === $preferredZoneId) {
                $selected = $option;
                break;
            }

            if ($selected === null) {
                $selected = $option;
            }
        }

        if (! is_array($selected)) {
            return [
                'carrier_id' => 0,
                'zone_id' => 0,
            ];
        }

        return [
            'carrier_id' => (int) ($selected['carrier_id'] ?? 0),
            'zone_id' => (int) ($selected['zone_id'] ?? 0),
        ];
    }

    private function normalizeShippingPriceMode(mixed $value): int
    {
        if (is_int($value) || is_float($value)) {
            return ((int) $value) === 1 ? 1 : 0;
        }

        $raw = strtolower(trim((string) $value));
        if ($raw === '1' || $raw === 'price_render') {
            return 1;
        }

        return 0;
    }

    private function tariffToFloat(mixed $value): float
    {
        if (is_float($value)) {
            return is_finite($value) ? $value : 0.0;
        }

        if (is_int($value)) {
            return (float) $value;
        }

        if (is_string($value)) {
            $parsed = (float) str_replace(',', '.', trim($value));

            return is_finite($parsed) ? $parsed : 0.0;
        }

        return 0.0;
    }

    private function tariffToFillRatio(float $coef): float
    {
        $normalized = $coef > 1.0 ? $coef / 100.0 : $coef;

        return max(0.0, min(1.0, $normalized));
    }
}
