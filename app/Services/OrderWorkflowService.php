<?php

namespace App\Services;

use App\Domain\Sales\Services\OrderActorResolver;
use App\Domain\Sales\Services\ProductVolumePriceSelector;
use App\Models\Cart;
use App\Models\OrderDocument;
use App\Models\OrderIssue;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** The submitted sales snapshot is immutable; preparation and delivery live here. */
class OrderWorkflowService
{
    public const LABELS = [
        'current' => 'En cours', 'processing' => 'En cours de traitement',
        'delivering' => 'En cours de livraison', 'delivered' => 'Livrée',
        'closed' => 'Clôturée', 'processed' => 'Traitée (ancienne commande)',
    ];

    public function initialize(Cart $cart): void
    {
        if ($cart->workflow !== null || $cart->status === 'current') {
            return;
        }
        $header = $cart->orderHeaders()->oldest('id')->with('lines')->first();
        $lines = [];
        $bases = $header?->lines->groupBy('db_product_id')->map(fn ($group) => (float) $group->sum(
            fn ($line) => (float) $line->selling_price * $line->quantity + (float) $line->transport_price,
        )) ?? collect();
        $discounts = $header?->meta['discounts'] ?? [];
        foreach ($header?->lines ?? [] as $line) {
            $product = new Product(['db_products_id' => $line->db_product_id]);
            $actors = app(OrderActorResolver::class)->resolve($cart->user, collect([['product' => $product]]));
            $lines[] = [
                'product_id' => (int) $line->product_id, 'db_id' => (int) $line->db_product_id,
                'name' => $line->product_name, 'ref' => $line->product_ref,
                'ordered_quantity' => (int) $line->quantity, 'quantity' => (int) $line->quantity,
                'unit_price' => (float) $line->selling_price, 'tva_rate' => (float) $line->tva_rate,
                'shipping' => (float) $line->transport_price,
                'discount_rate' => $discounts !== []
                    ? min(1, (float) ($discounts[$line->db_product_id]['amount'] ?? 0) / max(0.0001, $bases[$line->db_product_id] ?? 0))
                    : (($header->items_total_ht + $header->shipping_total_ht) > 0
                        ? min(1, (float) $header->discount_total_ht / (float) ($header->items_total_ht + $header->shipping_total_ht)) : 0),
                'billing_user_id' => $actors['billing_user_id'], 'seller_user_id' => $actors['seller_user_id'],
                'client_comment' => $line->comment,
            ];
        }
        $participants = collect($lines)->flatMap(fn ($line) => [$line['billing_user_id'], $line['seller_user_id']])
            ->filter()->map(fn ($id) => (int) $id)->unique()->values()->all();
        $cart->workflow = ['lines' => $lines, 'participants' => $participants, 'submitted_at' => $header?->order_date?->toIso8601String()];
        $cart->save();
    }

    public function canManageLine(User $actor, array $line): bool
    {
        return $actor->hasRole('admin') || in_array((int) $actor->id, [
            (int) ($line['billing_user_id'] ?? 0), (int) ($line['seller_user_id'] ?? 0),
        ], true);
    }

    public function canManage(User $actor, Cart $cart): bool
    {
        return $actor->hasRole('admin') || collect($cart->workflow['lines'] ?? [])
            ->contains(fn ($line) => $this->canManageLine($actor, $line));
    }

    public function authorizeView(User $actor, Cart $cart): void
    {
        $this->initialize($cart);
        $visible = app(UserManagementAuthorizationService::class)
            ->scopeManageableOrders($actor, Cart::query())->whereKey($cart->id)->exists();
        abort_unless((int) $cart->user_id === (int) $actor->id || $visible || $this->canManage($actor, $cart), 403);
    }

    public function mutate(Cart $cart, User $actor, int $revision, callable $change): mixed
    {
        return DB::transaction(function () use ($cart, $actor, $revision, $change) {
            $locked = Cart::lockForUpdate()->findOrFail($cart->id);
            $this->authorizeView($actor, $locked);
            if ($locked->revision !== $revision) {
                throw ValidationException::withMessages([
                    'order' => 'La commande a changé. Actualisez la page avant de continuer.',
                ])->status(409);
            }
            $result = $change($locked);
            $locked->revision++;
            $locked->save();

            return $result;
        });
    }

    public function updateLines(Cart $cart, User $actor, array $updates): void
    {
        abort_unless($cart->status === 'processing' && $this->canManage($actor, $cart), 403);
        $workflow = $cart->workflow;
        foreach ($updates as $update) {
            $index = collect($workflow['lines'])->search(fn ($l) => $l['product_id'] === (int) $update['product_id']);
            if ($index === false) {
                $product = Product::orderableAt()->findOrFail($update['product_id']);
                $client = $cart->user;
                $context = collect($workflow['lines'])->firstWhere('db_id', (int) $product->db_products_id);
                abort_unless($context && $this->canManageLine($actor, $context), 403);
                abort_unless($client->dbProducts()->where('db_product_id', $product->db_products_id)
                    ->wherePivot('can_buy', true)->exists(), 403);
                $line = [
                    'product_id' => (int) $product->id, 'db_id' => (int) $product->db_products_id,
                    'name' => $product->name, 'ref' => $product->ref, 'ordered_quantity' => 0,
                    'billing_user_id' => $context['billing_user_id'], 'seller_user_id' => $context['seller_user_id'],
                    'unit_price' => $this->price($product, $client, $update['quantity']),
                    'tva_rate' => (float) str_replace(',', '.', (string) DB::table('tva')
                        ->where('id', $product->tva_id ?: $product->category?->tva_id)->value('rate')),
                    'shipping' => 0, 'discount_rate' => 0, 'client_comment' => null,
                ];
                $workflow['lines'][] = $line;
                $index = array_key_last($workflow['lines']);
            }
            abort_unless($this->canManageLine($actor, $workflow['lines'][$index]), 403);
            $workflow['lines'][$index]['quantity'] = (int) $update['quantity'];
        }
        $cart->workflow = $workflow;
        $cart->items_total = round(collect($workflow['lines'])->sum(fn ($line) => $line['unit_price'] * $line['quantity'] * (1 - $line['discount_rate'])), 2);
        $cart->shipping_total = round(collect($workflow['lines'])->sum(fn ($line) => $line['shipping'] * (1 - $line['discount_rate'])), 2);
        $cart->products()->sync(collect($workflow['lines'])->filter(fn ($line) => $line['quantity'] > 0)
            ->mapWithKeys(fn ($line) => [$line['product_id'] => ['quantity' => $line['quantity'], 'comment' => $line['client_comment']]])->all());
    }

    private function price(Product $product, User $client, int $quantity): float
    {
        $prices = app(PriceCalculatorService::class)->calculatePrice($product, $client, (int) $product->db_products_id);

        return (new ProductVolumePriceSelector)->selectUnitPrice(
            quantity: $quantity, traySize: (int) $product->cond,
            floorSize: (int) $product->cond * (int) $product->floor,
            rollSize: (int) $product->cond * (int) $product->floor * (int) $product->roll,
            standardUnitPrice: (float) ($prices[0] ?? 0), floorUnitPrice: (float) ($prices[1] ?? 0),
            rollUnitPrice: (float) ($prices[2] ?? 0), promoUnitPrice: (float) ($prices[3] ?? 0),
        );
    }

    public function ship(Cart $cart, User $actor): void
    {
        abort_unless($cart->status === 'processing' && $this->canManage($actor, $cart), 403);
        $workflow = $cart->workflow;
        $this->require(collect($workflow['lines'])->sum('quantity') > 0, 'La commande ne contient aucun produit à livrer.');
        foreach ($workflow['lines'] as &$line) {
            $line['shipped_quantity'] = $line['quantity'];
        }
        unset($line);
        $workflow['shipped_at'] = now()->toIso8601String();
        $cart->workflow = $workflow;
        $cart->status = 'delivering';
        $this->document($cart, $actor->id, 'delivery', 'BL-'.str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT), $workflow['lines']);
    }

    public function acceptedQuantity(Cart $cart, array $line): int
    {
        return max(0, (int) ($line['shipped_quantity'] ?? $line['quantity']) - (int) $cart->issues()
            ->where('product_id', $line['product_id'])->where('status', 'approved')->sum('quantity'));
    }

    public function report(Cart $cart, User $actor, array $data): void
    {
        abort_unless($cart->status === 'delivered' && ((int) $cart->user_id === (int) $actor->id || $this->canManage($actor, $cart)), 403);
        $line = collect($cart->workflow['lines'])->firstWhere('product_id', (int) $data['product_id']);
        $this->require($line !== null, 'Produit absent de la livraison.');
        abort_unless((int) $cart->user_id === (int) $actor->id || $this->canManageLine($actor, $line), 403);
        $reserved = $cart->issues()->where('product_id', $data['product_id'])->whereIn('status', ['pending', 'approved'])->sum('quantity');
        $this->require($reserved + $data['quantity'] <= ($line['shipped_quantity'] ?? 0), 'La quantité dépasse la quantité livrée encore disponible pour un signalement.');
        $cart->issues()->create($data + ['user_id' => $actor->id]);
    }

    public function review(Cart $cart, User $actor, OrderIssue $issue, array $data): void
    {
        abort_unless($cart->status === 'delivered' && (int) $issue->cart_id === (int) $cart->id, 403);
        $line = collect($cart->workflow['lines'])->firstWhere('product_id', (int) $issue->product_id);
        abort_unless($line && $this->canManageLine($actor, $line), 403);
        $this->require($issue->status === 'pending', 'Ce signalement a déjà été traité.');
        $issue->update($data + ['reviewed_by' => $actor->id, 'reviewed_at' => now()]);
    }

    public function invoice(Cart $cart, User $actor): OrderDocument
    {
        abort_unless($cart->status === 'delivered', 403);
        // Invoice issuance belongs to the assigned billing party, including when an admin views the order.
        $lines = collect($cart->workflow['lines'])->where('billing_user_id', (int) $actor->id)->values();
        abort_if($lines->isEmpty(), 403);
        $ids = $lines->pluck('product_id');
        $this->require(! $cart->issues()->whereIn('product_id', $ids)->where('status', 'pending')->exists(), 'Traitez les signalements avant de facturer.');
        $this->require(! $cart->documents()->where('kind', 'invoice')->where('issuer_id', $actor->id)->exists(), 'La facture est déjà émise.');
        $lines = $lines->map(function ($line) use ($cart) {
            $line['quantity'] = $this->acceptedQuantity($cart, $line);

            return $line;
        })->all();
        $number = app(InvoiceNumberService::class)->next($actor, $cart);

        return $this->document($cart, $actor->id, 'invoice', $number, $lines);
    }

    public function credit(Cart $cart, User $actor): OrderDocument
    {
        abort_unless($cart->status === 'delivered', 403);
        $invoice = $cart->documents()->where('kind', 'invoice')->where('issuer_id', $actor->id)->firstOrFail();
        $this->require(! $cart->issues()->whereIn('product_id', collect($invoice->snapshot['lines'])->pluck('product_id'))->where('status', 'pending')->exists(), 'Traitez les signalements avant d’émettre un avoir.');
        $credited = $cart->documents()->where('kind', 'credit')->where('invoice_id', $invoice->id)->get();
        $lines = [];
        foreach ($invoice->snapshot['lines'] as $line) {
            $current = collect($cart->workflow['lines'])->firstWhere('product_id', $line['product_id']);
            $previous = $credited->sum(fn ($doc) => collect($doc->snapshot['lines'])->where('product_id', $line['product_id'])->sum('quantity'));
            $difference = $line['quantity'] - $this->acceptedQuantity($cart, $current) - $previous;
            if ($difference > 0) {
                // Allocate cumulative amounts from the issued invoice, including its rounding.
                // Repeating partial credits must never refund more than the original line.
                $missing = $line['quantity'] - $this->acceptedQuantity($cart, $current);
                $productHt = $line['product_total_ht'];
                $productVat = $line['product_total_tva'];
                $previousHt = $credited->sum(fn ($doc) => collect($doc->snapshot['lines'])->where('product_id', $line['product_id'])->sum('total_ht'));
                $previousVat = $credited->sum(fn ($doc) => collect($doc->snapshot['lines'])->where('product_id', $line['product_id'])->sum('total_tva'));
                $line['credit_ht'] = max(0, round(round($productHt * $missing / $line['quantity'], 2) - $previousHt, 2));
                $line['credit_tva'] = max(0, round(round($productVat * $missing / $line['quantity'], 2) - $previousVat, 2));
                $line['quantity'] = $difference;
                $line['shipping'] = 0;
                $lines[] = $line;
            }
        }
        $this->require(count($lines) > 0, 'Aucun écart validé ne nécessite un nouvel avoir.');

        return $this->document($cart, $actor->id, 'credit', 'AV-'.$invoice->number.'-'.($credited->count() + 1), $lines, $invoice);
    }

    public function close(Cart $cart, User $actor): void
    {
        abort_unless($cart->status === 'delivered' && $this->canManage($actor, $cart), 403);
        $this->require(! $cart->issues()->where('status', 'pending')->exists(), 'Des signalements restent à traiter.');
        $billingIds = collect($cart->workflow['lines'])->pluck('billing_user_id')->unique();
        $this->require(! $billingIds->contains(null), 'Un facturant doit être défini pour chaque produit.');
        foreach ($billingIds as $id) {
            $invoice = $cart->documents()->where('kind', 'invoice')->where('issuer_id', $id)->first();
            $this->require($invoice !== null, 'Chaque facturant doit avoir émis sa facture.');
            $credits = $cart->documents()->where('kind', 'credit')->where('invoice_id', $invoice->id)->get();
            foreach ($invoice->snapshot['lines'] as $line) {
                $current = collect($cart->workflow['lines'])->firstWhere('product_id', $line['product_id']);
                $credited = $credits->sum(fn ($doc) => collect($doc->snapshot['lines'])->where('product_id', $line['product_id'])->sum('quantity'));
                $this->require($this->acceptedQuantity($cart, $current) === $line['quantity'] - $credited, 'Un avoir reste à émettre.');
            }
        }
        $cart->status = 'closed';
    }

    private function document(Cart $cart, int $issuerId, string $kind, string $number, array $lines, ?OrderDocument $invoice = null): OrderDocument
    {
        $ht = 0;
        $vat = 0;
        foreach ($lines as &$line) {
            $line['product_total_ht'] = round($line['unit_price'] * $line['quantity'] * (1 - $line['discount_rate']), 2);
            $line['product_total_tva'] = round($line['product_total_ht'] * $line['tva_rate'] / 100, 2);
            $line['total_ht'] = $line['credit_ht'] ?? round(($line['unit_price'] * $line['quantity'] + $line['shipping']) * (1 - $line['discount_rate']), 2);
            $line['total_tva'] = $line['credit_tva'] ?? round($line['total_ht'] * $line['tva_rate'] / 100, 2);
            $ht += (int) round($line['total_ht'] * 100);
            $vat += (int) round($line['total_tva'] * 100);
        }
        unset($line);

        return $cart->documents()->create([
            'issuer_id' => $issuerId, 'kind' => $kind, 'number' => $number,
            'invoice_id' => $invoice?->id, 'issued_at' => now(),
            'snapshot' => [
                'order_number' => str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT),
                'client' => $cart->user->only(['name', 'ref', 'email', 'address_road', 'address_zip', 'address_town']),
                'issuer' => User::findOrFail($issuerId)->only(['name', 'ref', 'email', 'address_road', 'address_zip', 'address_town']),
                'lines' => $lines, 'total_ht' => $ht / 100, 'total_tva' => $vat / 100, 'total_ttc' => ($ht + $vat) / 100,
                'invoice_number' => $invoice?->number,
                'comments' => $cart->comments()->with('user:id,name')->get()->toArray(),
                'issues' => $cart->issues()->whereIn('product_id', collect($lines)->pluck('product_id'))
                    ->where('status', 'approved')->with('reviewer:id,name')->get()->toArray(),
                'client_comment' => $cart->comment,
            ],
        ]);
    }

    private function require(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['order' => $message]);
        }
    }
}
