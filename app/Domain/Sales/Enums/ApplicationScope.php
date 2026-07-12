<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum ApplicationScope: string
{
    case Unit = 'unit';
    case Line = 'line';
    case Order = 'order';
}
