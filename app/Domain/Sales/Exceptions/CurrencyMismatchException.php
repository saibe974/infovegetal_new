<?php

declare(strict_types=1);

namespace App\Domain\Sales\Exceptions;

use InvalidArgumentException;

final class CurrencyMismatchException extends InvalidArgumentException
{
}
