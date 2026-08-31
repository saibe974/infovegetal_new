<?php

declare(strict_types=1);

namespace App\Domain\Sales\Services;

use App\Models\ClientSalesCondition;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class OrderActorResolver
{
    /**
     * BR-013
     * BR-011
     * BR-012
     *
     * @param  Collection<int, array{product: object, line_total?: float|int}>  $items
     * @return array{client_user_id: int, db_product_id: int|null, billing_user_id: int|null, seller_user_id: int|null}
     */
    public function resolve(User $client, Collection $items): array
    {
        $dbStats = [];
        foreach ($items as $item) {
            $product = $item['product'];
            $dbProductId = (int) ($product->db_products_id ?? 0);
            if ($dbProductId <= 0) {
                continue;
            }

            $lineTotal = (float) ($item['line_total'] ?? 0);
            $dbStats[$dbProductId] = ($dbStats[$dbProductId] ?? 0.0) + $lineTotal;
        }

        if (empty($dbStats)) {
            return [
                'client_user_id' => (int) $client->id,
                'db_product_id' => null,
                'billing_user_id' => null,
                'seller_user_id' => null,
            ];
        }

        arsort($dbStats);
        $primaryDbProductId = (int) array_key_first($dbStats);

        $attributes = DB::table('db_product_user')
            ->where('user_id', (int) $client->id)
            ->where('db_product_id', $primaryDbProductId)
            ->value('attributes');

        $attrs = is_array($attributes)
            ? $attributes
            : json_decode((string) $attributes, true);
        $attrs = is_array($attrs) ? $attrs : [];

        // Match the price calculator: explicit legacy actors take priority,
        // otherwise use the latest active client sales conditions for this base.
        $clientRule = null;
        if (! isset($attrs['fact']) || ! isset($attrs['com'])) {
            $clientRule = ClientSalesCondition::query()
                ->where('client_user_id', (int) $client->id)
                ->where('db_product_id', $primaryDbProductId)
                ->where('active', true)
                ->latest('updated_at')
                ->latest('id')
                ->first(['billing_user_id', 'seller_user_id']);
        }

        $billingUserId = (int) ($attrs['fact'] ?? $clientRule?->billing_user_id ?? 0);
        $sellerUserId = (int) ($attrs['com'] ?? $clientRule?->seller_user_id ?? 0);

        return [
            'client_user_id' => (int) $client->id,
            'db_product_id' => $primaryDbProductId,
            'billing_user_id' => $billingUserId ?: null,
            'seller_user_id' => $sellerUserId ?: null,
        ];
    }
}
