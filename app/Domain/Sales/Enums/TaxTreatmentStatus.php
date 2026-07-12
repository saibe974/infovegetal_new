<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum TaxTreatmentStatus: string
{
    case PendingConfiguration = 'pending_configuration';
    case NotApplicable = 'not_applicable';
}
