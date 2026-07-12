<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum TransportPresentationMode: string
{
    case SeparateAdditionalFee = 'separate_additional_fee';
    case RedistributeOnLines = 'redistribute_on_lines';
}
