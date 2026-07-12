<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\ActorChain;

final class OrderSalesChainCalculator
{
    public function __construct(
        private readonly ProductSalesPriceCalculator $lineCalculator = new ProductSalesPriceCalculator(),
        private readonly TransportAllocationCalculator $transportCalculator = new TransportAllocationCalculator(),
        private readonly OrderCalculationBreakdownAssembler $breakdownAssembler = new OrderCalculationBreakdownAssembler(),
        private readonly CustomerInvoiceProjector $invoiceProjector = new CustomerInvoiceProjector(),
        private readonly ExpectedSettlementBuilder $settlementBuilder = new ExpectedSettlementBuilder(),
        private readonly SalesCalculationSnapshotBuilder $snapshotBuilder = new SalesCalculationSnapshotBuilder(),
        private readonly LegacySalesComparator $legacyComparator = new LegacySalesComparator(),
        private readonly ShadowModeEvaluator $shadowModeEvaluator = new ShadowModeEvaluator(),
    ) {
    }

    /**
     * @return object
     */
    public function calculate(\App\Domain\Sales\DTO\OrderSalesCalculationInput $input)
    {
        if (count($input->lineInputs) === 0) {
            throw new \InvalidArgumentException('OrderSalesChainCalculator requires at least one line input.');
        }

        $actorChain = $this->resolveUniqueActorChain($input->lineInputs);

        $lineBreakdowns = [];
        foreach ($input->lineInputs as $lineInput) {
            $lineBreakdowns[] = $this->lineCalculator->calculate($lineInput);
        }

        $transport = $this->transportCalculator->calculate($input->transportInput);
        $breakdown = $this->breakdownAssembler->assemble($lineBreakdowns, $transport);
        $invoice = $this->invoiceProjector->project($breakdown);
        $settlements = $this->settlementBuilder->build($breakdown, $actorChain);

        $snapshot = $this->snapshotBuilder->build(
            breakdown: $breakdown,
            invoice: $invoice,
            settlements: $settlements,
            inputContext: $input->inputContext,
            generatedAtUtc: $input->generatedAtUtc,
        );

        $comparison = $input->legacyReference
            ? $this->legacyComparator->compare($input->legacyReference, $invoice, $input->comparisonToleranceMinor)
            : null;

        $shadow = $this->shadowModeEvaluator->evaluate($comparison);

        $resultClass = 'App\\Domain\\Sales\\DTO\\SalesOrderCalculationResult';

        return new $resultClass(
            orderBreakdown: $breakdown,
            customerInvoice: $invoice,
            expectedSettlements: $settlements,
            snapshot: $snapshot,
            legacyComparisonReport: $comparison,
            shadowModeEvaluation: $shadow,
        );
    }

    /**
     * @param list<\App\Domain\Sales\DTO\LineCalculationInput> $lineInputs
     */
    private function resolveUniqueActorChain(array $lineInputs): ActorChain
    {
        $reference = $lineInputs[0]->actorChain;

        foreach ($lineInputs as $lineInput) {
            $chain = $lineInput->actorChain;
            if (
                $chain->databaseOwnerId !== $reference->databaseOwnerId
                || $chain->billingUserId !== $reference->billingUserId
                || $chain->sellerId !== $reference->sellerId
            ) {
                throw new \DomainException('All line inputs must share the same actor chain for order-level settlement projection.');
            }
        }

        return $reference;
    }
}
