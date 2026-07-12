<?php

declare(strict_types=1);

use App\Domain\Sales\DTO\CustomerInvoiceLineProjection;
use App\Domain\Sales\DTO\CustomerInvoiceProjection;
use App\Domain\Sales\DTO\LegacyLineReference;
use App\Domain\Sales\DTO\LegacyOrderReference;
use App\Domain\Sales\Services\LegacySalesComparator;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;

it('returns equivalent report when legacy and engine values are identical', function (): void {
    $invoice = buildInvoiceProjection([
        ['lineId' => 1, 'ht' => 7000, 'vat' => 385],
        ['lineId' => 2, 'ht' => 6500, 'vat' => 503],
    ]);

    $legacy = new LegacyOrderReference(
        totalHt: new Money(13_500, Currency::EUR),
        totalVat: new Money(888, Currency::EUR),
        totalTtc: new Money(14_388, Currency::EUR),
        lines: [
            new LegacyLineReference(1, new Money(7000, Currency::EUR), new Money(385, Currency::EUR), new Money(7385, Currency::EUR)),
            new LegacyLineReference(2, new Money(6500, Currency::EUR), new Money(503, Currency::EUR), new Money(7003, Currency::EUR)),
        ],
    );

    $report = (new LegacySalesComparator())->compare($legacy, $invoice);

    expect($report->isEquivalent)->toBeTrue()
        ->and($report->differences)->toHaveCount(0);
});

it('ignores minor differences within tolerance', function (): void {
    $invoice = buildInvoiceProjection([
        ['lineId' => 1, 'ht' => 7000, 'vat' => 385],
    ]);

    $legacy = new LegacyOrderReference(
        totalHt: new Money(7001, Currency::EUR),
        totalVat: new Money(385, Currency::EUR),
        totalTtc: new Money(7386, Currency::EUR),
        lines: [
            new LegacyLineReference(1, new Money(7001, Currency::EUR), new Money(385, Currency::EUR), new Money(7386, Currency::EUR)),
        ],
    );

    $report = (new LegacySalesComparator())->compare($legacy, $invoice, toleranceMinor: 1);

    expect($report->isEquivalent)->toBeTrue()
        ->and($report->differences)->toHaveCount(0);
});

it('reports differences above tolerance and missing lines', function (): void {
    $invoice = buildInvoiceProjection([
        ['lineId' => 1, 'ht' => 7000, 'vat' => 385],
        ['lineId' => 99, 'ht' => 500, 'vat' => 100],
    ]);

    $legacy = new LegacyOrderReference(
        totalHt: new Money(7000, Currency::EUR),
        totalVat: new Money(385, Currency::EUR),
        totalTtc: new Money(7385, Currency::EUR),
        lines: [
            new LegacyLineReference(1, new Money(6800, Currency::EUR), new Money(380, Currency::EUR), new Money(7180, Currency::EUR)),
            new LegacyLineReference(2, new Money(200, Currency::EUR), new Money(10, Currency::EUR), new Money(210, Currency::EUR)),
        ],
    );

    $report = (new LegacySalesComparator())->compare($legacy, $invoice, toleranceMinor: 0);

    expect($report->isEquivalent)->toBeFalse();

    $metrics = array_map(static fn ($d) => $d->scope . ':' . $d->metric, $report->differences);

    expect($metrics)->toContain('order:total_ht')
        ->and($metrics)->toContain('order:total_vat')
        ->and($metrics)->toContain('order:total_ttc')
        ->and($metrics)->toContain('line:1:total_ht')
        ->and($metrics)->toContain('line:1:total_vat')
        ->and($metrics)->toContain('line:1:total_ttc')
        ->and($metrics)->toContain('line:2:missing_in_engine')
        ->and($metrics)->toContain('line:99:missing_in_legacy');
});

/**
 * @param list<array{lineId:int,ht:int,vat:int}> $linesData
 */
function buildInvoiceProjection(array $linesData): CustomerInvoiceProjection
{
    $currency = Currency::EUR;
    $lines = [];
    $productsHt = 0;
    $productsVat = 0;

    foreach ($linesData as $lineData) {
        $ht = $lineData['ht'];
        $vat = $lineData['vat'];
        $ttc = $ht + $vat;

        $productsHt += $ht;
        $productsVat += $vat;

        $lines[] = new CustomerInvoiceLineProjection(
            lineId: $lineData['lineId'],
            productHt: new Money($ht, $currency),
            productVat: new Money($vat, $currency),
            productTtc: new Money($ttc, $currency),
            transportHt: new Money(0, $currency),
            transportVat: new Money(0, $currency),
            transportTtc: new Money(0, $currency),
            totalHt: new Money($ht, $currency),
            totalVat: new Money($vat, $currency),
            totalTtc: new Money($ttc, $currency),
        );
    }

    $transportHt = 0;
    $transportVat = 0;

    return new CustomerInvoiceProjection(
        lines: $lines,
        productsHt: new Money($productsHt, $currency),
        productsVat: new Money($productsVat, $currency),
        productsTtc: new Money($productsHt + $productsVat, $currency),
        transportHt: new Money($transportHt, $currency),
        transportVat: new Money($transportVat, $currency),
        transportTtc: new Money($transportHt + $transportVat, $currency),
        transportOrderFeeHt: new Money(0, $currency),
        transportOrderFeeVat: new Money(0, $currency),
        transportOrderFeeTtc: new Money(0, $currency),
        totalHt: new Money($productsHt + $transportHt, $currency),
        totalVat: new Money($productsVat + $transportVat, $currency),
        totalTtc: new Money($productsHt + $transportHt + $productsVat + $transportVat, $currency),
    );
}
