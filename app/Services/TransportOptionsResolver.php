<?php

namespace App\Services;

use App\Models\Carrier;

class TransportOptionsResolver
{
    public function resolve(array $attributesByDb): array
    {
        $pairs = [];
        foreach ($attributesByDb as $attrs) {
            $raw = $attrs['t'] ?? null;
            $parsed = is_string($raw) ? json_decode($raw, true) : $raw;
            $choices = is_array($parsed) ? $parsed : [['carrier_id' => $raw, 'zone_id' => $attrs['z'] ?? null]];
            foreach ($choices as $choice) {
                if (! is_array($choice)) {
                    continue;
                }
                $carrierId = (int) ($choice['carrier_id'] ?? 0);
                $zoneId = (int) ($choice['zone_id'] ?? 0);
                if ($carrierId > 0 && $zoneId > 0) {
                    $pairs[$carrierId.':'.$zoneId] = [$carrierId, $zoneId];
                }
            }
        }
        $carriers = Carrier::with(['zones', 'dbProducts'])->whereIn('id', array_unique(array_column($pairs, 0)))->get()->keyBy('id');
        $options = [];
        foreach ($pairs as $key => [$carrierId, $zoneId]) {
            $carrier = $carriers->get($carrierId);
            $zone = $carrier?->zones->firstWhere('id', $zoneId);
            if (! $zone) {
                continue;
            }
            $options[$key] = [
                'carrier_id' => $carrierId,
                'carrier_name' => $carrier->name,
                'zone_id' => $zoneId,
                'zone_name' => $zone->name,
                'taxgo' => (float) $carrier->taxgo,
                'tariffs' => $zone->tariffs ?? [],
                'supplements_by_db' => $carrier->supplementsByDb(),
            ];
        }

        return $options;
    }
}
