<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\TransportPreparationInput;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Models\Carrier;
use App\Models\CarrierZone;

final class TransportDeparturePricingService
{
    public function __construct(
        private readonly TransportPricingPreparationService $pricingPreparationService = new TransportPricingPreparationService(),
        private readonly TransportRenderedPricingService $renderedPricingService = new TransportRenderedPricingService(),
    ) {
    }

    public function calculate(array $rollDistribution, array $pivotsByDbProductId): float
    {
        $suppliers = $rollDistribution['suppliers'] ?? [];
        if (empty($suppliers) || empty($pivotsByDbProductId)) {
            return 0.0;
        }

        $carrierIds = [];
        $zoneIds = [];
        foreach ($suppliers as $supplier) {
            $supplierId = (int) ($supplier['supplier_id'] ?? 0);
            $attrs = $pivotsByDbProductId[$supplierId] ?? null;
            if (!$attrs) {
                continue;
            }

            $transportChoice = $this->resolveTransportChoice($attrs);
            $carrierId = $transportChoice['carrier_id'];
            $zoneId = $transportChoice['zone_id'];
            if ($carrierId > 0) {
                $carrierIds[] = $carrierId;
            }
            if ($zoneId > 0) {
                $zoneIds[] = $zoneId;
            }
        }

        $carriers = empty($carrierIds)
            ? collect()
            : Carrier::whereIn('id', array_unique($carrierIds))->get()->keyBy('id');
        $zones = empty($zoneIds)
            ? collect()
            : CarrierZone::whereIn('id', array_unique($zoneIds))->get()->keyBy('id');

        $totalShipping = 0.0;

        foreach ($suppliers as $supplier) {
            $supplierId = (int) ($supplier['supplier_id'] ?? 0);
            $modLiv = (string) ($supplier['mod_liv'] ?? '');
            $rolls = is_array($supplier['rolls'] ?? null) ? $supplier['rolls'] : [];

            if ($modLiv !== 'roll' || empty($rolls)) {
                continue;
            }

            $attrs = $pivotsByDbProductId[$supplierId] ?? null;
            if (!$attrs) {
                continue;
            }

            $transportChoice = $this->resolveTransportChoice($attrs);
            $carrierId = $transportChoice['carrier_id'];
            $zoneId = $transportChoice['zone_id'];
            $priceMode = $this->normalizeShippingPriceMode($attrs['p'] ?? 0);
            $rollCount = count($rolls);

            if ($carrierId > 0 && $zoneId > 0) {
                $carrier = $carriers->get($carrierId);
                $zone = $zones->get($zoneId);

                if ($carrier && $zone) {
                    $tariffs = is_array($zone->tariffs) ? $zone->tariffs : [];
                    $baseTariffPerRoll = (new TransportZoneTariffResolver())->resolve($rollCount, $tariffs);
                    $baseTotal = $baseTariffPerRoll * $rollCount;
                    $carrierMinimum = max(0.0, $this->tariffToFloat($tariffs['mini'] ?? 0));

                    if ($priceMode === 1 && $rollCount > 0) {
                        $fillRates = [];
                        foreach ($rolls as $roll) {
                            $coef = $this->tariffToFloat($roll['coef'] ?? 0);
                            $fillRates[] = $this->tariffToFillRatio($coef);
                        }

                        $embeddedMinor = 0;
                        foreach ($fillRates as $fillRate) {
                            $embeddedMinor += (int) round($baseTariffPerRoll * $fillRate * 100);
                        }

                        $realTransportMinor = (int) round(max(max(0.0, $carrierMinimum), $baseTariffPerRoll * $rollCount) * 100);

                        $preparation = $this->pricingPreparationService->prepare(new TransportPreparationInput(
                            presentationMode: TransportPresentationMode::SeparateAdditionalFee,
                            transportRealHt: new Money($realTransportMinor, Currency::EUR),
                            transportEmbeddedInProductsHt: new Money($embeddedMinor, Currency::EUR),
                            lineIds: array_map(static fn (int $index): int => $index + 1, array_keys($fillRates)),
                        ));

                        $adjustedTotal = $preparation->transportAdditionalFeeHt->minorAmount / 100.0;
                    } else {
                        $adjustedTotal = $carrierMinimum > 0.0 && $baseTotal < $carrierMinimum
                            ? $carrierMinimum
                            : $baseTotal;
                    }

                    $taxgoRate = max(0.0, $this->tariffToFloat($carrier->taxgo ?? 0));
                    $totalShipping += round($adjustedTotal * (1.0 + $taxgoRate / 100.0) * 100) / 100;
                    continue;
                }
            }

            $rollPrice = max(0.0, $this->tariffToFloat($attrs['l'] ?? 0));
            $customMinimum = max(0.0, $this->tariffToFloat($attrs['lm'] ?? 0));
            $customTaxRate = max(0.0, $this->tariffToFloat($attrs['tvat'] ?? 0));

            if ($priceMode === 0) {
                $baseTotal = $rollPrice * $rollCount;
                $adjustedTotal = $customMinimum > 0.0 && $baseTotal < $customMinimum
                    ? $customMinimum
                    : $baseTotal;

                $totalShipping += round($adjustedTotal * (1.0 + $customTaxRate / 100.0) * 100) / 100;
            } elseif ($priceMode === 1) {
                $fillRates = [];
                foreach ($rolls as $roll) {
                    $coef = $this->tariffToFloat($roll['coef'] ?? 0);
                    $fillRates[] = $this->tariffToFillRatio($coef);
                }

                $embeddedMinor = 0;
                foreach ($fillRates as $fillRate) {
                    $embeddedMinor += (int) round($rollPrice * $fillRate * 100);
                }

                $realTransportMinor = (int) round(max($customMinimum, $rollPrice * $rollCount) * 100);

                $preparation = $this->pricingPreparationService->prepare(new TransportPreparationInput(
                    presentationMode: TransportPresentationMode::SeparateAdditionalFee,
                    transportRealHt: new Money($realTransportMinor, Currency::EUR),
                    transportEmbeddedInProductsHt: new Money($embeddedMinor, Currency::EUR),
                    lineIds: array_map(static fn (int $index): int => $index + 1, array_keys($fillRates)),
                ));

                $adjustedTotal = $preparation->transportAdditionalFeeHt->minorAmount / 100.0;
                $totalShipping += round($adjustedTotal * (1.0 + $customTaxRate / 100.0) * 100) / 100;
            }
        }

        return round($totalShipping * 100) / 100;
    }

    /**
     * @param array<string, mixed> $attrs
     * @return array{carrier_id:int,zone_id:int}
     */
    private function resolveTransportChoice(array $attrs): array
    {
        $legacyCarrierId = (int) ($attrs['t'] ?? 0);
        $legacyZoneId = (int) ($attrs['z'] ?? 0);

        if ($legacyCarrierId > 0 && $legacyZoneId > 0) {
            return [
                'carrier_id' => $legacyCarrierId,
                'zone_id' => $legacyZoneId,
            ];
        }

        $raw = $attrs['t'] ?? null;
        $parsed = is_string($raw) ? json_decode($raw, true) : $raw;
        if (!is_array($parsed) || empty($parsed)) {
            return [
                'carrier_id' => 0,
                'zone_id' => 0,
            ];
        }

        $preferredZoneId = (int) ($attrs['z'] ?? 0);
        $selected = null;

        foreach ($parsed as $option) {
            if (!is_array($option)) {
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

        if (!is_array($selected)) {
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