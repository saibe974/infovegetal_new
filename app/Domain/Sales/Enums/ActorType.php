<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum ActorType: string
{
    case DatabaseOwner = 'database_owner';
    case BillingUser = 'billing_user';
    case Seller = 'seller';
    case Transporter = 'transporter';
    case Client = 'client';
}
