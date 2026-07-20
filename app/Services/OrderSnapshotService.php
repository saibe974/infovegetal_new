<?php

namespace App\Services;

use App\Domain\Sales\DTO\ProductComponentBreakdown;
use App\Domain\Sales\DTO\ProductPriceReference;
use App\Domain\Sales\DTO\SalesLineBreakdown;
use App\Domain\Sales\DTO\ExpectedSettlementCollection;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\TransportCalculationResult;
use App\Domain\Sales\DTO\OrderTransportBreakdown;
use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\ProductTaxContext;
use App\Domain\Sales\DTO\ResolvedCondition;
use App\Domain\Sales\DTO\ResolvedConditionCollection;
use App\Domain\Sales\Enums\ActorType;
use App\Domain\Sales\Enums\ApplicationScope;
use App\Domain\Sales\Enums\CalculationBaseType;
use App\Domain\Sales\Enums\ConditionType;
use App\Domain\Sales\Enums\PriceSourceType;
use App\Domain\Sales\Enums\RoundingRule;
use App\Domain\Sales\Enums\SalesMode;
use App\Domain\Sales\Services\CustomerInvoiceProjector;
use App\Domain\Sales\Services\OrderCalculationBreakdownAssembler;
use App\Domain\Sales\Services\ProductSalesPriceCalculator;
use App\Domain\Sales\Services\SalesCalculationSnapshotBuilder;
use App\Domain\Sales\DTO\ProductVatResolutionInput;
use App\Domain\Sales\Enums\ProductVatSource;
use App\Domain\Sales\Services\ProductVatResolver;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Domain\Sales\ValueObjects\Quantity;
use App\Domain\Sales\Services\OrderActorResolver;
use App\Domain\Sales\Services\SalesConditionRelationResolver;
use App\Domain\Sales\Services\SalesConditionSnapshotResolver;
use App\Models\Cart;
use App\Models\DbProductBillingUser;
use App\Models\ClientSalesCondition;
use App\Models\DbProductSellerUser;
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
            $actors['client_user_id'],
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
            $lineBreakdowns = [];
            $billingGainTotal = 0.0;
            $order = OrderHeader::create([
                'cart_id' => (int) $cart->id,
                'client_user_id' => $actors['client_user_id'],
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
                    'resolved_actors' => [
                        'db_product_id' => $actors['db_product_id'],
                        'client_user_id' => $actors['client_user_id'],
                        'billing_user_id' => $actors['billing_user_id'],
                        'seller_user_id' => $actors['seller_user_id'],
                    ],
                ],
            ]);

            $tvaRatesById = DB::table('tva')->pluck('rate', 'id');
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

                $billingGain = $this->resolveBillingGain(
                    product: $product,
                    quantity: $quantity,
                    purchaseUnitPrice: $purchaseUnitPrice,
                    tvaRate: $tvaRate,
                    actors: $actors,
                    conditionsSnapshot: $conditionsSnapshot,
                );
                $billingGainTotal += $billingGain;

                $lineBreakdowns[] = $this->buildSnapshotLineBreakdown(
                    product: $product,
                    lineId: $index + 1,
                    sellingUnitPrice: $sellingUnitPrice,
                    lineTotalHt: $lineTotalHt,
                    lineTotalTva: $lineTotalTva,
                    lineTotalTtc: $lineTotalTtc,
                    tvaRate: $tvaRate,
                    billingGain: $billingGain,
                );

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
                        'billing_gain_ht' => round($billingGain, 4),
                    ],
                ]);
            }

            ['breakdown' => $breakdown, 'invoice' => $invoice] = $this->projectSnapshotInvoiceTotals($lineBreakdowns);
            $snapshot = (new SalesCalculationSnapshotBuilder())->build(
                breakdown: $breakdown,
                invoice: $invoice,
                settlements: new ExpectedSettlementCollection([]),
                inputContext: [
                    'cart_id' => (int) $cart->id,
                    'db_product_id' => $actors['db_product_id'],
                    'client_user_id' => $actors['client_user_id'],
                    'billing_user_id' => $actors['billing_user_id'],
                    'seller_user_id' => $actors['seller_user_id'],
                    'items_total_ht' => $itemsTotal,
                    'shipping_total_ht' => $shippingTotal,
                    'source' => $options['source'] ?? 'cart_validation',
                ],
                generatedAtUtc: $orderDate->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
            );

            $order->update([
                'total_ht' => round($invoice->totalHt->minorAmount / 100, 2),
                'total_tva' => round($invoice->totalVat->minorAmount / 100, 2),
                'total_ttc' => round($invoice->totalTtc->minorAmount / 100, 2),
                'meta' => array_merge($order->meta ?? [], [
                    'billing_gain_total_ht' => round($billingGainTotal, 4),
                    'sales_calculation_snapshot' => $snapshot->toArray(),
                ]),
            ]);

            return $order->fresh(['lines']);
        });

        return $header;
    }

    private function resolveActors(User $client, Collection $items): array
    {
        return (new OrderActorResolver())->resolve($client, $items);
    }

    private function resolveConditionsSnapshot(?int $dbProductId, ?int $billingUserId, ?int $sellerUserId, ?int $clientUserId = null): array
    {
        if (!$dbProductId || !$billingUserId) {
            return [];
        }

        $conditionsResolver = new SalesConditionSnapshotResolver();
        $relationResolver = new SalesConditionRelationResolver();

        $rule = DbProductBillingUser::query()
            ->where('db_product_id', $dbProductId)
            ->where('billing_user_id', $billingUserId)
            ->where('active', true)
            ->first();

        $defaults = is_array($rule?->defaults) ? $rule->defaults : [];
        $sellerRuleData = $relationResolver->resolveSellerRuleData($dbProductId, $billingUserId, $sellerUserId);
        $clientOverride = $relationResolver->resolveClientOverride($dbProductId, $billingUserId, $sellerUserId, $clientUserId);

        return array_merge(
            $conditionsResolver->resolve($defaults, $sellerRuleData, $clientOverride),
            [
                'db_product_id' => $dbProductId,
                'billing_user_id' => $billingUserId,
                'seller_user_id' => $sellerUserId,
            ]
        );
    }

    private function resolveTvaRate(Product $product, Collection $ratesById): float
    {
        $productVatRate = $this->resolvePercentageRate($product->tva_id, $ratesById);
        $categoryVatRate = $this->resolvePercentageRate($product->category?->tva_id, $ratesById);
        $categoryId = $product->category_products_id ? (int) $product->category_products_id : null;

        if ($categoryId === null) {
            return $productVatRate?->basisPoints !== null
                ? round($productVatRate->basisPoints / 100, 2)
                : 0.0;
        }

        if ($productVatRate === null && $categoryVatRate === null) {
            return 0.0;
        }

        try {
            $resolution = (new ProductVatResolver())->resolve(new ProductVatResolutionInput(
            productId: (int) $product->id,
            categoryId: $categoryId,
            productVatRate: $productVatRate,
            categoryVatRate: $categoryVatRate,
        ));

            return round($resolution->vatRate->basisPoints / 100, 2);
        } catch (\DomainException) {
            return 0.0;
        }
    }

    private function resolvePercentageRate(mixed $tvaId, Collection $ratesById): ?Percentage
    {
        $resolvedTvaId = (int) ($tvaId ?? 0);
        if ($resolvedTvaId <= 0) {
            return null;
        }

        $rawRate = $ratesById->get($resolvedTvaId);
        if ($rawRate === null) {
            return null;
        }

        return Percentage::fromString((string) $rawRate);
    }

    private function buildOrderNumber(Cart $cart): string
    {
        return 'ORD-' . now()->format('Ymd-His') . '-' . str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT) . '-' . Str::upper(Str::random(4));
    }

    /**
     * @param list<SalesLineBreakdown> $lineBreakdowns
     */
    private function projectSnapshotInvoiceTotals(array $lineBreakdowns): array
    {
        $currency = Currency::EUR;
        $zero = Money::zero($currency);
        $breakdown = (new OrderCalculationBreakdownAssembler())->assemble(
            $lineBreakdowns,
            new TransportCalculationResult(
                new OrderTransportBreakdown(
                    carrierId: null,
                    zoneId: null,
                    rollCount: 0,
                    tariffGrossHt: $zero,
                    minimumAppliedHt: $zero,
                    transportRealHt: $zero,
                    transportEmbeddedInProductsHt: $zero,
                    transportRemainingHt: $zero,
                    transportChargedOnLinesHt: $zero,
                    transportChargedAsOrderFeeHt: $zero,
                    transportVatRate: Percentage::fromString('0'),
                    transportVatTotal: $zero,
                    transportTtc: $zero,
                ),
                [],
            ),
        );

        return [
            'breakdown' => $breakdown,
            'invoice' => (new CustomerInvoiceProjector())->project($breakdown),
        ];
    }

    private function buildSnapshotLineBreakdown(
        Product $product,
        int $lineId,
        float $sellingUnitPrice,
        float $lineTotalHt,
        float $lineTotalTva,
        float $lineTotalTtc,
        float $tvaRate,
        float $billingGain,
    ): SalesLineBreakdown {
        $currency = Currency::EUR;

        return new SalesLineBreakdown(
            lineId: $lineId,
            priceReference: new ProductPriceReference(
                productId: (int) $product->id,
                dbProductId: (int) ($product->db_products_id ?? 0),
                priceSource: PriceSourceType::Standard,
                baseUnitPriceHt: new Money((int) round($sellingUnitPrice * 100), $currency),
            ),
            product: new ProductComponentBreakdown(
                dbLineBaseHt: new Money((int) round($lineTotalHt * 100), $currency),
                billingMarginLineHt: new Money((int) round($billingGain * 100), $currency),
                sellerMarginLineHt: Money::zero($currency),
                discountPercentLineHt: Money::zero($currency),
                discountFixedLineHt: Money::zero($currency),
                finalLineHt: new Money((int) round($lineTotalHt * 100), $currency),
                productVatRate: Percentage::fromString((string) $tvaRate),
                productVatLineAmount: new Money((int) round($lineTotalTva * 100), $currency),
                finalLineTtc: new Money((int) round($lineTotalTtc * 100), $currency),
                roundingRule: RoundingRule::LineHalfUpV1,
            ),
            operations: [],
            actorEarnings: [],
            warnings: [],
        );
    }

    /**
     * @param array{db_product_id:int|null, client_user_id:int|null, billing_user_id:int|null, seller_user_id:int|null} $actors
     * @param array<string, mixed> $conditionsSnapshot
     */
    private function resolveBillingGain(
        Product $product,
        int $quantity,
        float $purchaseUnitPrice,
        float $tvaRate,
        array $actors,
        array $conditionsSnapshot,
    ): float {
        $billingUserId = (int) ($actors['billing_user_id'] ?? 0);
        if ($billingUserId <= 0 || $quantity <= 0 || $purchaseUnitPrice <= 0) {
            return 0.0;
        }

        $billingConditions = $this->buildBillingResolvedConditions(
            is_array($conditionsSnapshot['billing_to_seller_conditions'] ?? null)
                ? $conditionsSnapshot['billing_to_seller_conditions']
                : [],
            $billingUserId,
            $product,
        );

        if ($billingConditions->all() === []) {
            return 0.0;
        }

        $result = (new ProductSalesPriceCalculator())->calculate(new LineCalculationInput(
            lineId: (int) ($product->id ?? 0),
            priceReference: new ProductPriceReference(
                productId: (int) ($product->id ?? 0),
                dbProductId: (int) ($product->db_products_id ?? 0),
                priceSource: PriceSourceType::Standard,
                baseUnitPriceHt: new Money((int) round($purchaseUnitPrice * 100), Currency::EUR),
                weightingPercent: null,
            ),
            quantity: Quantity::fromInt($quantity),
            actorChain: new ActorChain(
                databaseOwnerId: 0,
                billingUserId: $billingUserId,
                sellerId: null,
            ),
            conditions: $billingConditions,
            taxContext: new ProductTaxContext(Percentage::fromString((string) $tvaRate)),
            salesMode: SalesMode::Depart,
        ));

        foreach ($result->actorEarnings as $earning) {
            if ($earning->actorType === ActorType::BillingUser) {
                return round($earning->netEarningHt->minorAmount / 100, 4);
            }
        }

        return 0.0;
    }

    /**
     * @param array<string, mixed> $conditions
     */
    private function buildBillingResolvedConditions(array $conditions, int $billingUserId, Product $product): ResolvedConditionCollection
    {
        $resolved = [];
        $priority = 1;

        $generalMargin = $this->floatOrNull($conditions['m'] ?? null);
        if ($generalMargin !== null && $generalMargin !== 0.0) {
            $resolved[] = new ResolvedCondition(
                id: 'billing_margin',
                type: ConditionType::MarginPercent,
                sourceActorType: ActorType::BillingUser,
                sourceActorId: $billingUserId,
                scope: ApplicationScope::Line,
                baseType: CalculationBaseType::DbLineBaseHt,
                percentageValue: Percentage::fromString((string) $generalMargin),
                priority: $priority++,
            );
        }

        $tierMargins = [
            $this->tierMarginForProduct($conditions, $product),
        ];

        $tierMargin = $tierMargins[0];
        if ($tierMargin !== null && $tierMargin !== 0.0) {
            $resolved[] = new ResolvedCondition(
                id: 'billing_margin_tier',
                type: ConditionType::MarginPercent,
                sourceActorType: ActorType::BillingUser,
                sourceActorId: $billingUserId,
                scope: ApplicationScope::Line,
                baseType: CalculationBaseType::DbLineBaseHt,
                percentageValue: Percentage::fromString((string) $tierMargin),
                priority: $priority++,
            );
        }

        $minimumMargin = $this->minimumMarginPerLine($conditions, $product);
        if ($minimumMargin !== null && $minimumMargin > 0.0) {
            $resolved[] = new ResolvedCondition(
                id: 'billing_minimum_margin',
                type: ConditionType::MarginPercent,
                sourceActorType: ActorType::BillingUser,
                sourceActorId: $billingUserId,
                scope: ApplicationScope::Line,
                baseType: CalculationBaseType::DbLineBaseHt,
                moneyValue: new Money((int) round($minimumMargin * 100), Currency::EUR),
                priority: $priority++,
            );
        }

        return new ResolvedConditionCollection($resolved);
    }

    /**
     * @param array<string, mixed> $conditions
     */
    private function tierMarginForProduct(array $conditions, Product $product): ?float
    {
        $cond = max(0, (int) ($product->cond ?? 0));
        $floor = max(0, (int) ($product->floor ?? 0));
        $roll = max(0, (int) ($product->roll ?? 0));

        if ($cond > 0 && $floor > 0 && $roll > 0) {
            return $this->floatOrNull($conditions['mr'] ?? null);
        }

        if ($cond > 0 && $floor > 0) {
            return $this->floatOrNull($conditions['me'] ?? null);
        }

        if ($cond > 0) {
            return $this->floatOrNull($conditions['mc'] ?? null);
        }

        return null;
    }

    /**
     * @param array<string, mixed> $conditions
     */
    private function minimumMarginPerLine(array $conditions, Product $product): ?float
    {
        $minimumPerRoll = $this->floatOrNull($conditions['mm'] ?? null);
        if ($minimumPerRoll === null || $minimumPerRoll <= 0.0) {
            return null;
        }

        $cond = max(1, (int) ($product->cond ?? 1));
        $floor = max(1, (int) ($product->floor ?? 1));
        $roll = max(1, (int) ($product->roll ?? 1));
        $unitsPerRoll = $cond * $floor * $roll;

        return $unitsPerRoll > 0 ? $minimumPerRoll / $unitsPerRoll : null;
    }

    private function floatOrNull(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $parsed = (float) str_replace(',', '.', (string) $value);

        return is_finite($parsed) ? $parsed : null;
    }
}
