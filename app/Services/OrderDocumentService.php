<?php

namespace App\Services;

use App\Models\Cart;
use App\Models\File;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

class OrderDocumentService
{
    public function date(Cart $cart, array $payload = []): CarbonImmutable
    {
        // An existing document's period must survive retries and regeneration.
        $date = File::query()->where('cart_id', $cart->id)->whereNotNull('document_date')->min('document_date')
            ?? $cart->orderHeaders()->oldest('id')->value('order_date')
            ?? $payload['document_date'] ?? $cart->created_at ?? now();

        return CarbonImmutable::parse($date);
    }

    public function store(Cart $cart, int $ownerId, string $key, string $filename, string $contents, string $mime, array $payload = []): array
    {
        return Cache::lock('order-file:'.$cart->id.':'.$ownerId.':'.hash('sha256', $key), 60)->block(10,
            fn () => $this->write($cart, $ownerId, $key, $filename, $contents, $mime, $payload));
    }

    private function write(Cart $cart, int $ownerId, string $key, string $filename, string $contents, string $mime, array $payload): array
    {
        $date = $this->date($cart, $payload);
        $extension = match ($mime) {
            'application/pdf' => 'pdf',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => 'xlsx',
            'text/tab-separated-values' => 'tsv',
            default => 'csv',
        };
        $identity = ['user_id' => $ownerId, 'cart_id' => $cart->id, 'document_key' => $key];
        $existing = File::query()->where($identity)->first();
        // Content-addressed writes preserve the previous valid file if saving the record fails.
        $path = sprintf('meta_user/%d/commandes/%s/commande-%d-%s-%s.%s',
            $ownerId, $date->format('Y/m'), $cart->id, substr(hash('sha256', $key), 0, 16),
            hash('sha256', $contents), $extension);
        if (! Storage::disk('local')->put($path, $contents)) {
            throw new \RuntimeException('Impossible de sauvegarder le document de commande.');
        }
        $file = File::query()->updateOrCreate($identity, [
            'file_name' => basename(str_replace('\\', '/', $filename)),
            'file_path' => $path, 'file_size' => strlen($contents), 'disk' => 'local',
            'document_date' => $date->format('Y-m-d'), 'mime' => $mime,
        ]);
        if ($existing && $existing->file_path !== $path && str_starts_with($existing->file_path, "meta_user/{$ownerId}/commandes/")) {
            Storage::disk('local')->delete($existing->file_path);
        }

        return [
            'file_id' => $file->id, 'owner_user_id' => $ownerId, 'filename' => $file->file_name,
            'relative_path' => $path, 'disk' => 'local', 'mime' => $mime,
            'download_url' => route('order-files.download', $file->id),
        ];
    }

    public function recipientIds(User $client, array $payload): array
    {
        return collect($payload['billing_context_by_db'] ?? [])->flatMap(fn ($context) => [
            (int) ($context['billing_user_id'] ?? 0), (int) ($context['seller_user_id'] ?? 0),
        ])->push((int) $client->id)->filter(fn ($id) => $id > 0)->unique()->values()->all();
    }

    public function storePdfs(Cart $cart, User $client, array $payload, string $filename, callable $render, bool $share = true): array
    {
        $copies = [];
        $rendered = [];
        foreach ($share ? $this->recipientIds($client, $payload) : [(int) $client->id] as $ownerId) {
            $scoped = $this->payloadForRecipient($payload, $client, $ownerId);
            $scope = implode(',', collect($scoped['items'])->map(fn ($item) => $item['product']->db_products_id)->unique()->sort()->all());
            $contents = $rendered[$scope] ??= $render($scoped);
            $displayName = $ownerId === (int) $client->id ? $filename : app(OrderCsvService::class)->resolveOrderPdfFilename(
                $cart, $client, $scoped, 'commande-'.$cart->id.'.pdf',
            );
            $copies[$ownerId] = $this->store($cart, $ownerId, 'order-pdf', $displayName, $contents, 'application/pdf', $payload);
        }

        return $copies;
    }

    public function payloadForRecipient(array $payload, User $client, int $ownerId): array
    {
        if ($ownerId === (int) $client->id) {
            return $payload;
        }
        $contexts = collect($payload['billing_context_by_db'] ?? [])->filter(fn ($context) => (int) ($context['billing_user_id'] ?? 0) === $ownerId || (int) ($context['seller_user_id'] ?? 0) === $ownerId);

        return $this->payloadForDatabases($payload, $contexts->keys()->all());
    }

    public function payloadForDatabases(array $payload, array $dbIds): array
    {
        $items = collect($payload['items'] ?? []);
        $selected = $items->filter(fn ($item) => in_array((int) $item['product']->db_products_id, array_map('intval', $dbIds), true))->values();
        if ($selected->count() === $items->count()) {
            return $payload;
        }
        $payload['items'] = $selected;
        $payload['billing_context_by_db'] = array_intersect_key($payload['billing_context_by_db'] ?? [], array_flip($dbIds));
        $payload['items_total'] = (float) $selected->sum('line_total');
        $byDb = array_intersect_key($payload['transport_breakdown']['by_db'] ?? [], array_flip($dbIds));
        $payload['shipping_total'] = array_sum($byDb);
        $payload['transport_breakdown'] = ['by_db' => $byDb, 'groups' => [], 'total' => $payload['shipping_total']];
        $payload['discounts'] = array_intersect_key($payload['discounts'] ?? [], array_flip($dbIds));
        $payload['discount_total'] = (float) collect($payload['discounts'])->sum('amount');
        // A global coupon cannot be allocated to a supplier without a business allocation rule.
        $payload['global_discount_excluded'] = ! empty($payload['coupon']);
        $payload['coupon'] = null;
        $payload['total'] = max(0, round($payload['items_total'] + $payload['shipping_total'] - $payload['discount_total'], 2));
        $payload['roll_distribution'] = app(PdfRollDistributionService::class)->build($selected);
        $billingIds = collect($payload['billing_context_by_db'])->pluck('billing_user_id')->filter()->unique();
        $sellerIds = collect($payload['billing_context_by_db'])->pluck('seller_user_id')->filter()->unique();
        $payload['facturant'] = $billingIds->count() === 1 ? User::with('usersMeta')->find($billingIds->first()) : null;
        $payload['commercial'] = $sellerIds->count() === 1 ? User::with('usersMeta')->find($sellerIds->first()) : null;
        $payload['mail_recipients'] = [];

        return $payload;
    }
}
