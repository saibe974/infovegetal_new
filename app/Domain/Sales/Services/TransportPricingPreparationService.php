<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Domain\Sales\DTO\TransportPreparationInput;
use App\Domain\Sales\DTO\TransportPreparationResult;
use App\Domain\Sales\Enums\TransportPresentationMode;
use App\Domain\Sales\ValueObjects\Money;

final class TransportPricingPreparationService
{
    public function prepare(TransportPreparationInput $input): TransportPreparationResult
    {
        if ($input->presentationMode === TransportPresentationMode::RedistributeOnLines) {
            return new TransportPreparationResult(
                presentationMode: $input->presentationMode,
                transportAdditionalFeeHt: Money::zero($input->transportRealHt->currency),
                transportEmbeddedInProductsHt: $input->transportRealHt,
                hasAdditionalTransportFee: false,
            );
        }

        $delta = $input->transportRealHt->subtract($input->transportEmbeddedInProductsHt);

        if ($delta->isNegative()) {
            $delta = Money::zero($input->transportRealHt->currency);
        }

        return new TransportPreparationResult(
            presentationMode: $input->presentationMode,
            transportAdditionalFeeHt: $delta,
            transportEmbeddedInProductsHt: $input->transportEmbeddedInProductsHt,
            hasAdditionalTransportFee: !$delta->isZero(),
        );
    }
}
