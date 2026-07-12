<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\ValueObjects\Money;

final class SalesCalculationSnapshotBuilder
{
    /**
     * @return object
     */
    public function build(
        \App\Domain\Sales\DTO\OrderCalculationBreakdown $breakdown,
        \App\Domain\Sales\DTO\CustomerInvoiceProjection $invoice,
        \App\Domain\Sales\DTO\ExpectedSettlementCollection $settlements,
        array $inputContext,
        string $generatedAtUtc,
        string $engineVersion = 'sales-engine-v1',
        string $schemaVersion = '1.0',
    ) {
        $payload = [
            'input_context' => $this->canonicalizeAssociative($inputContext),
            'order_breakdown' => $this->serializeOrderBreakdown($breakdown),
            'customer_invoice' => $this->serializeCustomerInvoice($invoice),
            'expected_settlements' => $this->serializeSettlements($settlements),
        ];

        $payloadJson = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $checksum = hash('sha256', $payloadJson);

        $snapshotClass = 'App\\Domain\\Sales\\DTO\\SalesCalculationSnapshot';

        return new $snapshotClass(
            schemaVersion: $schemaVersion,
            engineVersion: $engineVersion,
            generatedAtUtc: $generatedAtUtc,
            payload: $payload,
            checksum: $checksum,
        );
    }

    private function serializeOrderBreakdown(\App\Domain\Sales\DTO\OrderCalculationBreakdown $breakdown): array
    {
        $lines = $breakdown->lines;
        usort($lines, static fn ($a, $b): int => $a->lineId <=> $b->lineId);

        $serializedLines = [];
        foreach ($lines as $line) {
            $serializedOperations = [];
            foreach ($line->operations as $operation) {
                $serializedOperations[] = [
                    'operation_type' => $operation->operationType,
                    'source_condition_id' => $operation->sourceConditionId,
                    'base_type' => $operation->baseType->value,
                    'input_amount' => $this->money($operation->inputAmount),
                    'calculated_amount' => $this->money($operation->calculatedAmount),
                    'output_amount' => $this->money($operation->outputAmount),
                    'formula_id' => $operation->formulaId,
                ];
            }

            $serializedActorEarnings = [];
            foreach ($line->actorEarnings as $earning) {
                $serializedActorEarnings[] = [
                    'actor_type' => $earning->actorType->value,
                    'actor_id' => $earning->actorId,
                    'gross_margin_ht' => $this->money($earning->grossMarginHt),
                    'discount_supported_ht' => $this->money($earning->discountSupportedHt),
                    'net_earning_ht' => $this->money($earning->netEarningHt),
                ];
            }

            $serializedWarnings = [];
            foreach ($line->warnings as $warning) {
                $serializedWarnings[] = [
                    'code' => $warning->code->value,
                    'message' => $warning->message,
                ];
            }

            $serializedLines[] = [
                'line_id' => $line->lineId,
                'price_reference' => [
                    'product_id' => $line->priceReference->productId,
                    'db_product_id' => $line->priceReference->dbProductId,
                    'price_source' => $line->priceReference->priceSource->value,
                    'base_unit_price_ht' => $this->money($line->priceReference->baseUnitPriceHt),
                ],
                'product' => [
                    'db_line_base_ht' => $this->money($line->product->dbLineBaseHt),
                    'billing_margin_line_ht' => $this->money($line->product->billingMarginLineHt),
                    'seller_margin_line_ht' => $this->money($line->product->sellerMarginLineHt),
                    'discount_percent_line_ht' => $this->money($line->product->discountPercentLineHt),
                    'discount_fixed_line_ht' => $this->money($line->product->discountFixedLineHt),
                    'final_line_ht' => $this->money($line->product->finalLineHt),
                    'product_vat_rate_basis_points' => $line->product->productVatRate->basisPoints,
                    'product_vat_line_amount' => $this->money($line->product->productVatLineAmount),
                    'final_line_ttc' => $this->money($line->product->finalLineTtc),
                    'rounding_rule' => $line->product->roundingRule->value,
                ],
                'operations' => $serializedOperations,
                'actor_earnings' => $serializedActorEarnings,
                'warnings' => $serializedWarnings,
            ];
        }

        $transportLineAllocations = $breakdown->transport->lineAllocations;
        usort($transportLineAllocations, static fn ($a, $b): int => $a->lineId <=> $b->lineId);

        $serializedTransportAllocations = [];
        foreach ($transportLineAllocations as $allocation) {
            $serializedTransportAllocations[] = [
                'line_id' => $allocation->lineId,
                'roll_occupancy_basis_points' => $allocation->rollOccupancyBasisPoints,
                'transport_embedded_ht' => $this->money($allocation->transportEmbeddedHt),
                'transport_additional_ht' => $this->money($allocation->transportAdditionalHt),
                'transport_total_charged_ht' => $this->money($allocation->transportTotalChargedHt),
                'transport_economic_cost_allocated_ht' => $this->money($allocation->transportEconomicCostAllocatedHt),
                'transport_vat_rate_basis_points' => $allocation->transportVatRate->basisPoints,
                'transport_vat_amount' => $this->money($allocation->transportVatAmount),
            ];
        }

        $warnings = [];
        foreach ($breakdown->warnings as $warning) {
            $warnings[] = [
                'code' => $warning->code->value,
                'message' => $warning->message,
            ];
        }

        return [
            'lines' => $serializedLines,
            'transport' => [
                'order_breakdown' => [
                    'carrier_id' => $breakdown->transport->orderBreakdown->carrierId,
                    'zone_id' => $breakdown->transport->orderBreakdown->zoneId,
                    'roll_count' => $breakdown->transport->orderBreakdown->rollCount,
                    'tariff_gross_ht' => $this->money($breakdown->transport->orderBreakdown->tariffGrossHt),
                    'minimum_applied_ht' => $this->money($breakdown->transport->orderBreakdown->minimumAppliedHt),
                    'transport_real_ht' => $this->money($breakdown->transport->orderBreakdown->transportRealHt),
                    'transport_embedded_in_products_ht' => $this->money($breakdown->transport->orderBreakdown->transportEmbeddedInProductsHt),
                    'transport_remaining_ht' => $this->money($breakdown->transport->orderBreakdown->transportRemainingHt),
                    'transport_charged_on_lines_ht' => $this->money($breakdown->transport->orderBreakdown->transportChargedOnLinesHt),
                    'transport_charged_as_order_fee_ht' => $this->money($breakdown->transport->orderBreakdown->transportChargedAsOrderFeeHt),
                    'transport_vat_rate_basis_points' => $breakdown->transport->orderBreakdown->transportVatRate->basisPoints,
                    'transport_vat_total' => $this->money($breakdown->transport->orderBreakdown->transportVatTotal),
                    'transport_ttc' => $this->money($breakdown->transport->orderBreakdown->transportTtc),
                ],
                'line_allocations' => $serializedTransportAllocations,
            ],
            'totals' => [
                'products_ht' => $this->money($breakdown->productsHt),
                'products_vat' => $this->money($breakdown->productsVat),
                'transport_ht' => $this->money($breakdown->transportHt),
                'transport_vat' => $this->money($breakdown->transportVat),
                'total_ht' => $this->money($breakdown->totalHt),
                'total_vat' => $this->money($breakdown->totalVat),
                'total_ttc' => $this->money($breakdown->totalTtc),
            ],
            'warnings' => $warnings,
        ];
    }

    private function serializeCustomerInvoice(\App\Domain\Sales\DTO\CustomerInvoiceProjection $invoice): array
    {
        $lines = $invoice->lines;
        usort($lines, static fn ($a, $b): int => $a->lineId <=> $b->lineId);

        $serializedLines = [];
        foreach ($lines as $line) {
            $serializedLines[] = [
                'line_id' => $line->lineId,
                'product_ht' => $this->money($line->productHt),
                'product_vat' => $this->money($line->productVat),
                'product_ttc' => $this->money($line->productTtc),
                'transport_ht' => $this->money($line->transportHt),
                'transport_vat' => $this->money($line->transportVat),
                'transport_ttc' => $this->money($line->transportTtc),
                'total_ht' => $this->money($line->totalHt),
                'total_vat' => $this->money($line->totalVat),
                'total_ttc' => $this->money($line->totalTtc),
            ];
        }

        return [
            'lines' => $serializedLines,
            'totals' => [
                'products_ht' => $this->money($invoice->productsHt),
                'products_vat' => $this->money($invoice->productsVat),
                'products_ttc' => $this->money($invoice->productsTtc),
                'transport_ht' => $this->money($invoice->transportHt),
                'transport_vat' => $this->money($invoice->transportVat),
                'transport_ttc' => $this->money($invoice->transportTtc),
                'transport_order_fee_ht' => $this->money($invoice->transportOrderFeeHt),
                'transport_order_fee_vat' => $this->money($invoice->transportOrderFeeVat),
                'transport_order_fee_ttc' => $this->money($invoice->transportOrderFeeTtc),
                'total_ht' => $this->money($invoice->totalHt),
                'total_vat' => $this->money($invoice->totalVat),
                'total_ttc' => $this->money($invoice->totalTtc),
            ],
        ];
    }

    private function serializeSettlements(\App\Domain\Sales\DTO\ExpectedSettlementCollection $settlements): array
    {
        $lines = $settlements->lines;
        usort(
            $lines,
            static function ($a, $b): int {
                $aKey = [$a->reason->value, $a->fromActorType->value, $a->fromActorId, $a->toActorType->value, $a->toActorId];
                $bKey = [$b->reason->value, $b->fromActorType->value, $b->fromActorId, $b->toActorType->value, $b->toActorId];
                return $aKey <=> $bKey;
            }
        );

        $serialized = [];
        foreach ($lines as $line) {
            $serialized[] = [
                'from_actor_type' => $line->fromActorType->value,
                'from_actor_id' => $line->fromActorId,
                'to_actor_type' => $line->toActorType->value,
                'to_actor_id' => $line->toActorId,
                'reason' => $line->reason->value,
                'amount_ht' => $this->money($line->amountHt),
                'vat_rate_basis_points' => $line->vatRate?->basisPoints,
                'vat_amount' => $line->vatAmount ? $this->money($line->vatAmount) : null,
                'tax_treatment_status' => $line->taxTreatmentStatus->value,
            ];
        }

        return ['lines' => $serialized];
    }

    private function money(Money $money): array
    {
        return [
            'minor' => $money->minorAmount,
            'currency' => $money->currency->value,
        ];
    }

    private function canonicalizeAssociative(array $input): array
    {
        foreach ($input as $key => $value) {
            if (is_array($value)) {
                if (array_is_list($value)) {
                    $input[$key] = array_map(fn ($entry) => is_array($entry) ? $this->canonicalizeAssociative($entry) : $entry, $value);
                } else {
                    $input[$key] = $this->canonicalizeAssociative($value);
                }
            }
        }

        ksort($input);

        return $input;
    }
}
