<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\ExpectedSettlementCollection;
use App\Domain\Sales\DTO\ExpectedSettlementLine;
use App\Domain\Sales\DTO\OrderCalculationBreakdown;
use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\SettlementReason;
use App\Domain\Sales\Enums\TaxTreatmentStatus;
use App\Domain\Sales\ValueObjects\Money;

final class ExpectedSettlementBuilder
{
    public function build(OrderCalculationBreakdown $breakdown, ActorChain $actorChain): ExpectedSettlementCollection
    {
        $currency = $breakdown->totalHt->currency;

        $dbBaseHt = Money::zero($currency);
        $sellerNetHt = Money::zero($currency);

        foreach ($breakdown->lines as $line) {
            $dbBaseHt = $dbBaseHt->add($line->product->dbLineBaseHt);

            foreach ($line->actorEarnings as $earning) {
                if ($earning->actorType === ActorType::Seller && $earning->netEarningHt->minorAmount > 0) {
                    $sellerNetHt = $sellerNetHt->add($earning->netEarningHt);
                }
            }
        }

        $lines = [];

        if (
            $dbBaseHt->minorAmount > 0
            && $actorChain->billingUserId !== $actorChain->databaseOwnerId
        ) {
            $lines[] = new ExpectedSettlementLine(
                fromActorType: ActorType::BillingUser,
                fromActorId: $actorChain->billingUserId,
                toActorType: ActorType::DatabaseOwner,
                toActorId: $actorChain->databaseOwnerId,
                reason: SettlementReason::ProductBaseSupply,
                amountHt: $dbBaseHt,
                vatRate: null,
                vatAmount: null,
                taxTreatmentStatus: TaxTreatmentStatus::PendingConfiguration,
            );
        }

        if (
            $actorChain->sellerId !== null
            && $sellerNetHt->minorAmount > 0
            && $actorChain->billingUserId !== $actorChain->sellerId
        ) {
            $lines[] = new ExpectedSettlementLine(
                fromActorType: ActorType::BillingUser,
                fromActorId: $actorChain->billingUserId,
                toActorType: ActorType::Seller,
                toActorId: $actorChain->sellerId,
                reason: SettlementReason::SellerNetEarning,
                amountHt: $sellerNetHt,
                vatRate: null,
                vatAmount: null,
                taxTreatmentStatus: TaxTreatmentStatus::PendingConfiguration,
            );
        }

        if (
            $breakdown->transportHt->minorAmount > 0
            && $actorChain->billingUserId !== $actorChain->databaseOwnerId
        ) {
            $lines[] = new ExpectedSettlementLine(
                fromActorType: ActorType::BillingUser,
                fromActorId: $actorChain->billingUserId,
                toActorType: ActorType::DatabaseOwner,
                toActorId: $actorChain->databaseOwnerId,
                reason: SettlementReason::TransportCostRecovery,
                amountHt: $breakdown->transportHt,
                vatRate: null,
                vatAmount: null,
                taxTreatmentStatus: TaxTreatmentStatus::PendingConfiguration,
            );
        }

        return new ExpectedSettlementCollection($lines);
    }
}
