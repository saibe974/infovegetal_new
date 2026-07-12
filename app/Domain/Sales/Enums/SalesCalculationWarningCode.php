<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum SalesCalculationWarningCode: string
{
    case UnsupportedOrderScopedConditionIgnored = 'unsupported_order_scoped_condition_ignored';
    case MultipleConditionsFirstApplied = 'multiple_conditions_first_applied';
}
