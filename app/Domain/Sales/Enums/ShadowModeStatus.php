<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum ShadowModeStatus: string
{
    case Skipped = 'skipped';
    case Pass = 'pass';
    case Warning = 'warning';
    case Fail = 'fail';
}
