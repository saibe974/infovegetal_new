<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum CalculationBaseType: string
{
    case DbLineBaseHt = 'db_line_base_ht';
    case CommercialSubtotalLineHt = 'commercial_subtotal_line_ht';
    case FinalLineHt = 'final_line_ht';
}
