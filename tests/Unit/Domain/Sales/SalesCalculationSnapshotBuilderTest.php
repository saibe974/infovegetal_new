<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\ActorEarningBreakdown;
use App\Domain\Sales\DTO\CalculationWarning;
use App\Domain\Sales\DTO\OrderTransportCalculationInput;
use App\Domain\Sales\DTO\ProductComponentBreakdown;
use App\Domain\Sales\DTO\ProductPriceReference;
use App\Domain\Sales\DTO\SalesLineBreakdown;
use App\Domain\Sales\DTO\TransportLineInput;
use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\PriceSourceType;
use App\Domain\Sales\Enums\RoundingRule;
use App\Domain\Sales\Enums\SalesCalculationWarningCode;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\Services\CustomerInvoiceProjector;
use App\Domain\Sales\Services\ExpectedSettlementBuilder;
use App\Domain\Sales\Services\OrderCalculationBreakdownAssembler;
use App\Domain\Sales\Services\SalesCalculationSnapshotBuilder;
use App\Domain\Sales\Services\TransportAllocationCalculator;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;

it('builds deterministic snapshot checksum regardless of input context key order', function (): void {
    [$breakdown, $invoice, $settlements] = buildSnapshotArtifacts();

    $builder = new SalesCalculationSnapshotBuilder();

    $snapshotA = $builder->build(
        breakdown: $breakdown,
        invoice: $invoice,
        settlements: $settlements,
        inputContext: [
            'sales_mode' => 'rendered',
            'db_product_id' => 77,
            'request' => ['country' => 'FR', 'channel' => 'b2b'],
        ],
        generatedAtUtc: '2026-07-12T10:00:00Z',
    );

    $snapshotB = $builder->build(
        breakdown: $breakdown,
        invoice: $invoice,
        settlements: $settlements,
        inputContext: [
            'request' => ['channel' => 'b2b', 'country' => 'FR'],
            'db_product_id' => 77,
            'sales_mode' => 'rendered',
        ],
        generatedAtUtc: '2026-07-12T10:00:00Z',
    );

    expect($snapshotA->checksum)->toBe($snapshotB->checksum)
        ->and($snapshotA->payload)->toBe($snapshotB->payload)
        ->and($snapshotA->toArray()['payload']['input_context']['request'])->toBe([
            'channel' => 'b2b',
            'country' => 'FR',
        ]);
});

it('includes order, invoice and settlements sections with consistent totals', function (): void {
    [$breakdown, $invoice, $settlements] = buildSnapshotArtifacts();

    $snapshot = (new SalesCalculationSnapshotBuilder())->build(
        breakdown: $breakdown,
        invoice: $invoice,
        settlements: $settlements,
        inputContext: ['db_product_id' => 77],
        generatedAtUtc: '2026-07-12T10:00:00Z',
    );

    $payload = $snapshot->payload;

    expect($payload)->toHaveKeys(['input_context', 'order_breakdown', 'customer_invoice', 'expected_settlements'])
        ->and($payload['order_breakdown']['totals']['total_ht']['minor'])->toBe($payload['customer_invoice']['totals']['total_ht']['minor'])
        ->and($payload['order_breakdown']['totals']['total_vat']['minor'])->toBe($payload['customer_invoice']['totals']['total_vat']['minor'])
        ->and($payload['order_breakdown']['totals']['total_ttc']['minor'])->toBe($payload['customer_invoice']['totals']['total_ttc']['minor'])
        ->and(count($payload['expected_settlements']['lines']))->toBeGreaterThan(0);
});

/**
 * @return array{0: \App\Domain\Sales\DTO\OrderCalculationBreakdown, 1: \App\Domain\Sales\DTO\CustomerInvoiceProjection, 2: \App\Domain\Sales\DTO\ExpectedSettlementCollection}
 */
function buildSnapshotArtifacts(): array
{
    $transport = (new TransportAllocationCalculator())->calculate(new OrderTransportCalculationInput(
        presentationMode: TransportPresentationMode::SeparateAdditionalFee,
        tariffGrossHt: new Money(1000, Currency::EUR),
        minimumAppliedHt: new Money(0, Currency::EUR),
        transportRealHt: new Money(1000, Currency::EUR),
        transportVatRate: Percentage::fromString('20'),
        lines: [
            new TransportLineInput(1, 6000, new Money(250, Currency::EUR)),
            new TransportLineInput(2, 4000, new Money(150, Currency::EUR)),
        ],
    ));

    $line1 = snapshotLine(1, 3000, 5000, 275, 400);
    $line2 = snapshotLine(2, 4500, 7500, 413, 600);

    $breakdown = (new OrderCalculationBreakdownAssembler())->assemble([$line1, $line2], $transport);
    $invoice = (new CustomerInvoiceProjector())->project($breakdown);
    $settlements = (new ExpectedSettlementBuilder())->build($breakdown, new ActorChain(
        databaseOwnerId: 1,
        billingUserId: 2,
        sellerId: 3,
    ));

    return [$breakdown, $invoice, $settlements];
}

function snapshotLine(int $lineId, int $dbBaseMinor, int $finalHtMinor, int $vatMinor, int $sellerNetMinor): SalesLineBreakdown
{
    $currency = Currency::EUR;

    return new SalesLineBreakdown(
        lineId: $lineId,
        priceReference: new ProductPriceReference(
            productId: 100 + $lineId,
            dbProductId: 200 + $lineId,
            priceSource: PriceSourceType::Standard,
            baseUnitPriceHt: new Money($dbBaseMinor, $currency),
        ),
        product: new ProductComponentBreakdown(
            dbLineBaseHt: new Money($dbBaseMinor, $currency),
            billingMarginLineHt: new Money(0, $currency),
            sellerMarginLineHt: new Money($sellerNetMinor, $currency),
            discountPercentLineHt: new Money(0, $currency),
            discountFixedLineHt: new Money(0, $currency),
            finalLineHt: new Money($finalHtMinor, $currency),
            productVatRate: Percentage::fromString('5.5'),
            productVatLineAmount: new Money($vatMinor, $currency),
            finalLineTtc: new Money($finalHtMinor + $vatMinor, $currency),
            roundingRule: RoundingRule::LineHalfUpV1,
        ),
        operations: [],
        actorEarnings: [
            new ActorEarningBreakdown(
                actorType: ActorType::BillingUser,
                actorId: 2,
                grossMarginHt: new Money(0, $currency),
                discountSupportedHt: new Money(0, $currency),
                netEarningHt: new Money(0, $currency),
            ),
            new ActorEarningBreakdown(
                actorType: ActorType::Seller,
                actorId: 3,
                grossMarginHt: new Money($sellerNetMinor, $currency),
                discountSupportedHt: new Money(0, $currency),
                netEarningHt: new Money($sellerNetMinor, $currency),
            ),
        ],
        warnings: [
            new CalculationWarning(
                code: SalesCalculationWarningCode::MultipleConditionsFirstApplied,
                message: 'test warning',
            ),
        ],
    );
}
