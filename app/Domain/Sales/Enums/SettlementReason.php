<?php

declare(strict_types=1);

namespace App\Domain\Sales\Enums;

enum SettlementReason: string
{
    case ProductBaseSupply = 'product_base_supply';
    case SellerNetEarning = 'seller_net_earning';
    case TransportCostRecovery = 'transport_cost_recovery';
}
