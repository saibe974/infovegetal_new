<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

final class LegacySalesComparator
{
    public function compare(
        \App\Domain\Sales\DTO\LegacyOrderReference $legacy,
        \App\Domain\Sales\DTO\CustomerInvoiceProjection $engine,
        int $toleranceMinor = 0,
    ): \App\Domain\Sales\DTO\LegacyComparisonReport {
        if ($toleranceMinor < 0) {
            throw new \InvalidArgumentException('toleranceMinor must be >= 0.');
        }

        $differences = [];

        $this->compareMoney(
            $differences,
            'order',
            'total_ht',
            $legacy->totalHt->minorAmount,
            $engine->totalHt->minorAmount,
            $toleranceMinor
        );
        $this->compareMoney(
            $differences,
            'order',
            'total_vat',
            $legacy->totalVat->minorAmount,
            $engine->totalVat->minorAmount,
            $toleranceMinor
        );
        $this->compareMoney(
            $differences,
            'order',
            'total_ttc',
            $legacy->totalTtc->minorAmount,
            $engine->totalTtc->minorAmount,
            $toleranceMinor
        );

        $legacyLines = [];
        foreach ($legacy->lines as $line) {
            $legacyLines[$line->lineId] = $line;
        }

        $engineLines = [];
        foreach ($engine->lines as $line) {
            $engineLines[$line->lineId] = $line;
        }

        $allLineIds = array_unique(array_merge(array_keys($legacyLines), array_keys($engineLines)));
        sort($allLineIds);

        foreach ($allLineIds as $lineId) {
            $legacyLine = $legacyLines[$lineId] ?? null;
            $engineLine = $engineLines[$lineId] ?? null;

            if ($legacyLine === null) {
                $differences[] = new \App\Domain\Sales\DTO\LegacyComparisonDifference(
                    scope: 'line:' . (string) $lineId,
                    metric: 'missing_in_legacy',
                    legacyMinor: 0,
                    engineMinor: 1,
                    deltaMinor: 1,
                );
                continue;
            }

            if ($engineLine === null) {
                $differences[] = new \App\Domain\Sales\DTO\LegacyComparisonDifference(
                    scope: 'line:' . (string) $lineId,
                    metric: 'missing_in_engine',
                    legacyMinor: 1,
                    engineMinor: 0,
                    deltaMinor: 1,
                );
                continue;
            }

            $scope = 'line:' . (string) $lineId;
            $this->compareMoney(
                $differences,
                $scope,
                'total_ht',
                $legacyLine->totalHt->minorAmount,
                $engineLine->totalHt->minorAmount,
                $toleranceMinor
            );
            $this->compareMoney(
                $differences,
                $scope,
                'total_vat',
                $legacyLine->totalVat->minorAmount,
                $engineLine->totalVat->minorAmount,
                $toleranceMinor
            );
            $this->compareMoney(
                $differences,
                $scope,
                'total_ttc',
                $legacyLine->totalTtc->minorAmount,
                $engineLine->totalTtc->minorAmount,
                $toleranceMinor
            );
        }

        return new \App\Domain\Sales\DTO\LegacyComparisonReport(
            isEquivalent: count($differences) === 0,
            toleranceMinor: $toleranceMinor,
            differences: $differences,
        );
    }

    /**
     * @param list<\App\Domain\Sales\DTO\LegacyComparisonDifference> $differences
     */
    private function compareMoney(
        array &$differences,
        string $scope,
        string $metric,
        int $legacyMinor,
        int $engineMinor,
        int $toleranceMinor,
    ): void {
        $delta = abs($engineMinor - $legacyMinor);
        if ($delta <= $toleranceMinor) {
            return;
        }

        $differences[] = new \App\Domain\Sales\DTO\LegacyComparisonDifference(
            scope: $scope,
            metric: $metric,
            legacyMinor: $legacyMinor,
            engineMinor: $engineMinor,
            deltaMinor: $delta,
        );
    }
}
