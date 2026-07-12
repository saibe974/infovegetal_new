<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum SalesMode: string
{
    case Depart = 'depart';
    case Rendered = 'rendered';
}
