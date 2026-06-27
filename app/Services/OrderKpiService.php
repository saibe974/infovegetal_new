<?php

namespace App\Services;

use App\Models\OrderHeader;
use App\Models\OrderLine;
use Illuminate\Support\Collection;

class OrderKpiService
{
    public function monthlySummary(?\DateTimeInterface $from = null, ?\DateTimeInterface $to = null): array
    {
        $query = OrderHeader::query()->completed();

        if ($from && $to) {
            $query->whereBetween('order_date', [$from, $to]);
        } else {
            $query->currentMonth();
        }

        $base = $query->selectRaw('COUNT(*) as orders_count, COALESCE(SUM(total_ht),0) as total_ht, COALESCE(SUM(total_tva),0) as total_tva, COALESCE(SUM(total_ttc),0) as total_ttc, COALESCE(SUM(shipping_total_ht),0) as shipping_total_ht')->first();
        $ordersCount = (int) ($base->orders_count ?? 0);
        $totalTtc = (float) ($base->total_ttc ?? 0);

        return [
            'orders_count' => $ordersCount,
            'total_ht' => (float) ($base->total_ht ?? 0),
            'total_tva' => (float) ($base->total_tva ?? 0),
            'total_ttc' => $totalTtc,
            'shipping_total_ht' => (float) ($base->shipping_total_ht ?? 0),
            'average_basket_ttc' => $ordersCount > 0 ? round($totalTtc / $ordersCount, 2) : 0.0,
        ];
    }

    public function topClients(int $limit = 10): Collection
    {
        return OrderHeader::query()
            ->completed()
            ->selectRaw('client_user_id, COUNT(*) as orders_count, COALESCE(SUM(total_ttc),0) as total_ttc')
            ->groupBy('client_user_id')
            ->orderByDesc('total_ttc')
            ->limit($limit)
            ->with('client:id,name,email')
            ->get();
    }

    public function topSellers(int $limit = 10): Collection
    {
        return OrderHeader::query()
            ->completed()
            ->selectRaw('seller_user_id, COUNT(*) as orders_count, COALESCE(SUM(total_ttc),0) as total_ttc')
            ->whereNotNull('seller_user_id')
            ->groupBy('seller_user_id')
            ->orderByDesc('total_ttc')
            ->limit($limit)
            ->with('sellerUser:id,name,email')
            ->get();
    }

    public function topDbProducts(int $limit = 10): Collection
    {
        return OrderLine::query()
            ->completed()
            ->selectRaw('db_product_id, COALESCE(SUM(quantity),0) as quantity_total, COALESCE(SUM(line_total_ttc),0) as total_ttc')
            ->whereNotNull('db_product_id')
            ->groupBy('db_product_id')
            ->orderByDesc('total_ttc')
            ->limit($limit)
            ->with('dbProduct:id,name')
            ->get();
    }
}
