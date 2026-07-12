<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum ProductVatSource: string
{
    case Product = 'product';
    case Category = 'category';
}
