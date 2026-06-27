<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\DbProductBillingUser;
use App\Models\OrderHeader;
use App\Models\OrderLine;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OrderSnapshotService
{
    /**
     * @param array{items: Collection<int, array{product: Product, quantity: int, unit_price: float|int, line_total: float|int}>, items_total: float|int, shipping_total: float|int, total: float|int} $payload
     */
    public function createFromPayload(
        Cart $cart,
        User $client,
        array $payload,
        array $options = []
    ): OrderHeader {
        $items = collect($payload['items'] ?? []);
        $itemsTotal = round((float) ($payload['items_total'] ?? 0), 2);
        $shippingTotal = round((float) ($payload['shipping_total'] ?? 0), 2);

        $actors = $this->resolveActors($client, $items);
        $conditionsSnapshot = $this->resolveConditionsSnapshot(
            $actors['db_product_id'],
            $actors['billing_user_id'],
            $actors['seller_user_id'],
        );

        $orderDate = $options['order_date'] ?? now();
        $status = (string) ($options['status'] ?? 'completed');

        $header = DB::transaction(function () use (
            $cart,
            $client,
            $items,
            $itemsTotal,
            $shippingTotal,
            $actors,
            $conditionsSnapshot,
            $orderDate,
            $status,
            $options,
        ) {
            $order = OrderHeader::create([
                'cart_id' => (int) $cart->id,
                'client_user_id' => (int) $client->id,
                'billing_user_id' => $actors['billing_user_id'],
                'seller_user_id' => $actors['seller_user_id'],
                'db_product_id' => $actors['db_product_id'],
                'order_number' => $this->buildOrderNumber($cart),
                'order_date' => $orderDate,
                'status' => $status,
                'currency' => 'EUR',
                'items_total_ht' => $itemsTotal,
                'shipping_total_ht' => $shippingTotal,
                'total_ht' => round($itemsTotal + $shippingTotal, 2),
                'total_tva' => 0,
                'total_ttc' => 0,
                'conditions_snapshot' => $conditionsSnapshot,
                'meta' => [
                    'source' => $options['source'] ?? 'cart_validation',
                    'cart_status' => (string) ($cart->status ?? ''),
                ],
            ]);

            $tvaRatesById = DB::table('tva')->pluck('rate', 'id');
            $totalTva = 0.0;
            $totalTtc = 0.0;
            $runningShipping = 0.0;
            $lineCount = max(1, $items->count());

            foreach ($items->values() as $index => $item) {
                $product = $item['product'];
                $quantity = max(1, (int) ($item['quantity'] ?? 1));
                $sellingUnitPrice = round((float) ($item['unit_price'] ?? 0), 4);
                $productLineTotal = round((float) ($item['line_total'] ?? ($sellingUnitPrice * $quantity)), 2);

                $shippingShare = 0.0;
                if ($shippingTotal > 0) {
                    if ($index === $lineCount - 1) {
                        $shippingShare = round($shippingTotal - $runningShipping, 4);
                    } elseif ($itemsTotal > 0) {
                        $shippingShare = round($shippingTotal * ($productLineTotal / $itemsTotal), 4);
                    } else {
                        $shippingShare = round($shippingTotal / $lineCount, 4);
                    }
                    $runningShipping += $shippingShare;
                }

                $purchaseUnitPrice = round((float) ($product->price ?? 0), 4);
                $marginAmount = round(($sellingUnitPrice - $purchaseUnitPrice) * $quantity, 4);
                $marginPercent = $purchaseUnitPrice > 0
                    ? round((($sellingUnitPrice - $purchaseUnitPrice) / $purchaseUnitPrice) * 100, 4)
                    : null;

                $tvaRate = $this->resolveTvaRate($product, $tvaRatesById);
                $lineTotalHt = round($productLineTotal + $shippingShare, 2);
                $lineTotalTva = round($lineTotalHt * ($tvaRate / 100), 2);
                $lineTotalTtc = round($lineTotalHt + $lineTotalTva, 2);

                OrderLine::create([
                    'order_header_id' => (int) $order->id,
                    'product_id' => (int) $product->id,
                    'db_product_id' => $product->db_products_id ? (int) $product->db_products_id : null,
                    'product_name' => (string) ($product->name ?? ''),
                    'product_ref' => (string) ($product->ref ?? ''),
                    'product_ean' => (string) ($product->ean13 ?? ''),
                    'producer_id' => $product->producer_id ? (int) $product->producer_id : null,
                    'quantity' => $quantity,
                    'cond' => $product->cond ? (int) $product->cond : null,
                    'floor' => $product->floor ? (int) $product->floor : null,
                    'roll' => $product->roll ? (int) $product->roll : null,
                    'purchase_price' => $purchaseUnitPrice,
                    'selling_price' => $sellingUnitPrice,
                    'transport_price' => $shippingShare,
                    'margin_amount' => $marginAmount,
                    'margin_percent' => $marginPercent,
                    'line_total_ht' => $lineTotalHt,
                    'line_total_tva' => $lineTotalTva,
                    'line_total_ttc' => $lineTotalTtc,
                    'tva_rate' => $tvaRate,
                    'product_snapshot' => [
                        'name' => (string) ($product->name ?? ''),
                        'ref' => (string) ($product->ref ?? ''),
                        'ean13' => (string) ($product->ean13 ?? ''),
                        'pot' => $product->pot,
                        'height' => $product->height,
                        'country' => (string) ($product->dbProduct->country ?? ''),
                        'db_product_name' => (string) ($product->dbProduct->name ?? ''),
                        'category_id' => $product->category_products_id,
                    ],
                    'meta' => [
                        'product_line_total_ht' => $productLineTotal,
                    ],
                ]);

                $totalTva += $lineTotalTva;
                $totalTtc += $lineTotalTtc;
            }

            $order->update([
                'total_tva' => round($totalTva, 2),
                'total_ttc' => round($totalTtc, 2),
            ]);

            return $order->fresh(['lines']);
        });

        return $header;
    }

    private function resolveActors(User $client, Collection $items): array
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

        return [
            'db_product_id' => $primaryDbProductId,
            'billing_user_id' => !empty($attrs['fact']) ? (int) $attrs['fact'] : null,
            'seller_user_id' => !empty($attrs['com']) ? (int) $attrs['com'] : null,
        ];
    }

    private function resolveConditionsSnapshot(?int $dbProductId, ?int $billingUserId, ?int $sellerUserId): array
    {
        if (!$dbProductId || !$billingUserId) {
            return [];
        }

        $rule = DbProductBillingUser::query()
            ->where('db_product_id', $dbProductId)
            ->where('billing_user_id', $billingUserId)
            ->where('active', true)
            ->first();

        $defaults = is_array($rule?->defaults) ? $rule->defaults : [];
        $defaultConditions = $this->extractDefaultConditions($defaults);

        $override = [];
        if ($sellerUserId) {
            $rawOverride = DB::table('billing_user_seller_user')
                ->where('billing_user_id', $billingUserId)
                ->where('seller_user_id', $sellerUserId)
                ->where('active', true)
                ->value('conditions_override');

            $decoded = is_array($rawOverride)
                ? $rawOverride
                : json_decode((string) $rawOverride, true);

            if (is_array($decoded)) {
                $override = $decoded;
            }
        }

        $resolved = array_replace_recursive($defaultConditions, $override);

        return [
            'resolved' => $resolved,
            'defaults' => $defaults,
            'override' => $override,
            'db_product_id' => $dbProductId,
            'billing_user_id' => $billingUserId,
            'seller_user_id' => $sellerUserId,
        ];
    }

    private function extractDefaultConditions(array $defaults): array
    {
        $profiles = $defaults['profiles'] ?? null;
        if (!is_array($profiles)) {
            return $defaults;
        }

        if (empty($profiles)) {
            return [];
        }

        $defaultProfileId = isset($defaults['default_profile_id']) ? (string) $defaults['default_profile_id'] : null;
        $selected = null;

        foreach ($profiles as $profile) {
            if (!is_array($profile)) {
                continue;
            }

            $profileId = (string) ($profile['id'] ?? '');
            if ($defaultProfileId !== null && $profileId === $defaultProfileId) {
                $selected = $profile;
                break;
            }
        }

        if (!$selected) {
            $selected = is_array($profiles[0] ?? null) ? $profiles[0] : [];
        }

        return is_array($selected['conditions'] ?? null) ? $selected['conditions'] : [];
    }

    private function resolveTvaRate(Product $product, Collection $ratesById): float
    {
        $tvaId = (int) ($product->tva_id ?? 0);
        if ($tvaId <= 0) {
            return 0.0;
        }

        $rawRate = $ratesById->get($tvaId);
        if ($rawRate === null) {
            return 0.0;
        }

        return round((float) $rawRate, 2);
    }

    private function buildOrderNumber(Cart $cart): string
    {
        return 'ORD-' . now()->format('Ymd-His') . '-' . str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT) . '-' . Str::upper(Str::random(4));
    }
}
