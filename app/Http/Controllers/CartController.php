<?php

namespace App\Http\Controllers;

use App\Domain\Sales\Services\ProductVolumePriceSelector;
use App\Domain\Sales\Services\ProductPriceFallbackResolver;
use App\Domain\Sales\Services\TransportDeparturePricingService;
use App\Domain\Sales\Services\TransportZoneTariffResolver;
use App\Models\Cart;
use App\Models\Product;
use App\Support\RenderedTransportCalculator;
use App\Services\PdfRollDistributionService;
use App\Services\CartTcpdfService;
use App\Services\OrderSnapshotService;
use App\Services\PriceCalculatorService;
use App\Services\ProductMediaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Spatie\LaravelPdf\Facades\Pdf;

class CartController extends Controller
{
    public function index()
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $cart = $user->cart()->with('products')->firstOrCreate([]);
        return response()->json($cart->load('products'));
    }

    /**
     * Place an order: persist cart, generate PDF, store it and notify stakeholders.
     */
    public function placeOrder(Request $request, OrderSnapshotService $orderSnapshotService)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.comment' => 'nullable|string|max:2000',
            'comment' => 'nullable|string|max:2000',
            'shipping_total' => 'nullable|numeric|min:0',
            'shipping_by_db' => 'nullable|array',
            'shipping_by_db.*' => 'nullable|numeric|min:0',
            'discounts' => 'nullable|array',
            'discounts.*.type' => 'required|in:fixed,percent',
            'discounts.*.value' => 'required|numeric|min:0',
            'transport_selection' => 'nullable|array',
            'choice' => 'nullable|in:append,new',
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();
        $shippingByDb = $this->normalizeShippingByDb($data['shipping_by_db'] ?? null);

        $existingProcessing = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'processing')
            ->latest('updated_at')
            ->first();

        $choice = $data['choice'] ?? null;

        if ($existingProcessing && !$choice) {
            return response()->json([
                'requires_choice' => true,
                'existing_order' => [
                    'id' => $existingProcessing->id,
                    'number' => $this->formatOrderNumber((int) $existingProcessing->id),
                ],
                'message' => 'Une commande est deja en cours de traitement. Choisissez ajouter ou nouvelle commande.',
            ], 409);
        }

        $cart = null;
        if ($existingProcessing && $choice === 'append') {
            $cart = $existingProcessing;
        } elseif (!$existingProcessing || $choice === 'new') {
            $cart = Cart::create([
                'user_id' => $user->id,
                'status' => 'processing',
            ]);
        } else {
            $cart = $existingProcessing;
        }

        $discounts = array_key_exists('discounts', $data)
            ? $this->normalizeDiscounts($data['discounts'], $user)
            : (is_array($cart->discounts) ? $cart->discounts : []);

        $requestedByProductId = [];
        foreach ($data['items'] as $item) {
            $productId = (int) $item['id'];
            $qty = (int) $item['quantity'];
            $requestedByProductId[$productId] = ($requestedByProductId[$productId] ?? 0) + $qty;
        }

        if ($choice === 'append' && $existingProcessing) {
            $existingByProductId = $cart->products()->pluck('quantity', 'products.id')->map(fn ($q) => (int) $q)->toArray();
            foreach ($existingByProductId as $productId => $existingQty) {
                $requestedByProductId[(int) $productId] = ($requestedByProductId[(int) $productId] ?? 0) + $existingQty;
            }
        }

        $syncData = [];
        foreach ($requestedByProductId as $productId => $qty) {
            $matchingItem = collect($data['items'])->firstWhere('id', (int) $productId);
            $syncData[(int) $productId] = [
                'quantity' => (int) $qty,
                'comment' => $matchingItem['comment'] ?? null,
            ];
        }
        $cart->products()->sync($syncData);
        $cart->comment = $data['comment'] ?? null;
        $cart->touch();

        $shippingTotal = round((float) ($data['shipping_total'] ?? 0) * 100) / 100;
        $transportSelection = $this->normalizeTransportSelection($data['transport_selection'] ?? null);
        $cart->transport_selection = $transportSelection;
        $cart->discounts = $discounts;

        $pdfPayload = $this->buildPdfPayload(
            array_values(array_map(
                fn ($productId, $qty) => [
                    'id' => (int) $productId,
                    'quantity' => (int) $qty,
                    'comment' => collect($data['items'])->firstWhere('id', (int) $productId)['comment'] ?? '',
                ],
                array_keys($requestedByProductId),
                array_values($requestedByProductId),
            )),
            $user,
            $shippingTotal,
            false,
            $transportSelection,
            $discounts,
            $shippingByDb,
            $data['comment'] ?? null,
        );

        $cart->items_total = round((float) ($pdfPayload['items_total'] ?? 0), 2);
        $cart->shipping_total = round((float) ($pdfPayload['shipping_total'] ?? $shippingTotal), 2);
        $cart->save();

        $orderNumber = $this->formatOrderNumber((int) $cart->id);
        $pdfFilename = $this->buildOrderPdfFilename((int) $cart->id);
        $pdfRelativePath = sprintf('commandes/%d/%s', $user->id, $pdfFilename);

        Pdf::view('pdf.cart', array_merge($pdfPayload, [
            'order_id' => $cart->id,
            'order_number' => $orderNumber,
        ]))
            ->format('a4')
            ->disk('public', 'public')
            ->save($pdfRelativePath);

        $mailCount = $this->sendOrderPdfMails(
            $pdfPayload['mail_recipients'],
            $pdfRelativePath,
            $orderNumber,
            $user,
        );

        $existingSnapshot = \App\Models\OrderHeader::query()
            ->where('cart_id', $cart->id)
            ->latest('id')
            ->first();

        if (!$existingSnapshot) {
            $payloadForSnapshot = $this->buildPdfPayload($data['items'], $user, $shippingTotal, false, $transportSelection, $discounts, $shippingByDb, $data['comment'] ?? null);
            $orderSnapshotService->createFromPayload(
                $cart,
                $user,
                $payloadForSnapshot,
                ['source' => 'place_order']
            );
        }

        return response()->json([
            'status' => 'ok',
            'order_id' => $cart->id,
            'order_number' => $orderNumber,
            'pdf_filename' => $pdfFilename,
            'pdf_download_url' => asset('storage/' . $pdfRelativePath),
            'mail_recipients_count' => $mailCount,
            'message' => 'Commande enregistree, PDF genere et emails envoyes.',
        ]);
    }

    public function checkout()
    {
        /** @var \App\Models\User $user */
        $user = Auth::user();

        $rows = DB::table('db_product_user')
            ->where('user_id', $user->id)
            ->whereNotNull('attributes')
            ->get(['db_product_id', 'attributes']);

        $contactIds = [];
        $contactIdsByDbProductId = [];

        foreach ($rows as $row) {
            $dbProductId = (int) ($row->db_product_id ?? 0);
            if ($dbProductId <= 0) {
                continue;
            }

            $attrs = is_array($row->attributes)
                ? $row->attributes
                : json_decode((string) $row->attributes, true);

            if (!is_array($attrs)) {
                continue;
            }

            $factId = !empty($attrs['fact']) ? (int) $attrs['fact'] : null;
            $comId = !empty($attrs['com']) ? (int) $attrs['com'] : null;

            $contactIdsByDbProductId[$dbProductId] = [
                'fact' => $factId,
                'com' => $comId,
            ];

            if ($factId) {
                $contactIds[] = $factId;
            }

            if ($comId) {
                $contactIds[] = $comId;
            }
        }

        $clientConditions = \App\Models\ClientSalesCondition::query()
            ->where('client_user_id', $user->id)
            ->where('active', true)
            ->get(['db_product_id', 'billing_user_id', 'seller_user_id']);

        foreach ($clientConditions as $condition) {
            $dbProductId = (int) $condition->db_product_id;
            if ($dbProductId <= 0) {
                continue;
            }

            $existing = $contactIdsByDbProductId[$dbProductId] ?? ['fact' => null, 'com' => null];

            if ($existing['fact'] === null && $condition->billing_user_id) {
                $existing['fact'] = (int) $condition->billing_user_id;
                $contactIds[] = (int) $condition->billing_user_id;
            }

            if ($existing['com'] === null && $condition->seller_user_id) {
                $existing['com'] = (int) $condition->seller_user_id;
                $contactIds[] = (int) $condition->seller_user_id;
            }

            $contactIdsByDbProductId[$dbProductId] = $existing;
        }

        $usersById = \App\Models\User::query()
            ->whereIn('id', array_values(array_unique($contactIds)))
            ->get(['id', 'name', 'email'])
            ->keyBy('id');

        $dbProductCountries = DB::table('db_products')
            ->whereIn('id', array_keys($contactIdsByDbProductId))
            ->pluck('country', 'id')
            ->mapWithKeys(fn ($country, $id) => [(string) $id => (string) ($country ?? '')])
            ->toArray();

        $cartContacts = [];
        foreach ($contactIdsByDbProductId as $dbProductId => $ids) {
            $fact = null;
            $com = null;

            if (!empty($ids['fact'])) {
                $factUser = $usersById->get((int) $ids['fact']);
                if ($factUser) {
                    $fact = [
                        'id' => (int) $factUser->id,
                        'name' => (string) $factUser->name,
                        'email' => (string) ($factUser->email ?? ''),
                    ];
                }
            }

            if (!empty($ids['com'])) {
                $comUser = $usersById->get((int) $ids['com']);
                if ($comUser) {
                    $com = [
                        'id' => (int) $comUser->id,
                        'name' => (string) $comUser->name,
                        'email' => (string) ($comUser->email ?? ''),
                    ];
                }
            }

            $cartContacts[(string) $dbProductId] = [
                'fact' => $fact,
                'com' => $com,
            ];
        }

        $carriers = \App\Models\Carrier::query()
            ->get(['id', 'name', 'days', 'minimum', 'minimum_delay_hours', 'order_cutoff_time'])
            ->mapWithKeys(fn ($carrier) => [
                (int) $carrier->id => [
                    'name' => (string) $carrier->name,
                    'days' => $carrier->days,
                    'minimum_delay_hours' => (int) ($carrier->minimum_delay_hours ?? 24),
                    'order_cutoff_time' => substr((string) ($carrier->order_cutoff_time ?? '12:00'), 0, 5),
                ],
            ])
            ->toArray();

        $transportAttributeSets = [];
        $transportDbProductIds = collect($rows)->pluck('db_product_id')
            ->merge($clientConditions->pluck('db_product_id'))
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique();
        $priceCalculator = app(PriceCalculatorService::class);
        foreach ($transportDbProductIds as $dbProductId) {
            $resolvedAttributes = $priceCalculator->resolveUserAttributes($user, $dbProductId);
            if (is_array($resolvedAttributes)) {
                $transportAttributeSets[] = $resolvedAttributes;
            }
        }

        $carrierZonePairs = [];
        $seenPairs = [];
        foreach ($transportAttributeSets as $attrs) {
            $parsed = isset($attrs['t']) && is_string($attrs['t'])
                ? json_decode($attrs['t'], true)
                : ($attrs['t'] ?? null);
            $options = is_array($parsed) ? $parsed : [];
            if (!is_array($parsed) && !empty($attrs['t']) && is_numeric($attrs['t']) && !empty($attrs['z'])) {
                $options[] = ['carrier_id' => (int) $attrs['t'], 'zone_id' => (int) $attrs['z']];
            }
            foreach ($options as $option) {
                if (!is_array($option)) continue;
                $cid = (int) ($option['carrier_id'] ?? 0);
                $zid = (int) ($option['zone_id'] ?? 0);
                if ($cid <= 0 || $zid <= 0) continue;
                $key = $cid . ':' . $zid;
                if (!isset($seenPairs[$key])) {
                    $seenPairs[$key] = true;
                    $carrierZonePairs[] = ['carrier_id' => $cid, 'zone_id' => $zid];
                }
            }
        }

        $transportOptions = [];
        if (!empty($carrierZonePairs)) {
            $carrierIds = array_unique(array_map(fn ($p) => $p['carrier_id'], $carrierZonePairs));
            $zoneIds = array_unique(array_map(fn ($p) => $p['zone_id'], $carrierZonePairs));
            $carriersData = \App\Models\Carrier::query()
                ->whereIn('id', $carrierIds)
                ->get(['id', 'taxgo'])
                ->keyBy('id');
            $zonesData = \App\Models\CarrierZone::query()
                ->whereIn('id', $zoneIds)
                ->get(['id', 'carrier_id', 'name', 'tariffs'])
                ->groupBy('carrier_id');
            foreach ($carrierZonePairs as $pair) {
                $carrier = $carriersData->get($pair['carrier_id']);
                $zone = $zonesData->get($pair['carrier_id'])?->firstWhere('id', $pair['zone_id']);
                if (!$carrier || !$zone) continue;
                $key = $pair['carrier_id'] . ':' . $pair['zone_id'];
                $transportOptions[$key] = [
                    'carrier_id' => (int) $carrier->id,
                    'zone_id' => (int) $zone->id,
                    'zone_name' => (string) ($zone->name ?? ''),
                    'taxgo' => (float) ($carrier->taxgo ?? 0),
                    'tariffs' => is_array($zone->tariffs) ? $zone->tariffs : [],
                ];
            }
        }

        $activeCart = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'current')
            ->latest('updated_at')
            ->first();

        return Inertia::render('products/cart', [
            'cart_contacts' => $cartContacts,
            'cart_db_countries' => $dbProductCountries,
            'cart_carriers' => $carriers,
            'cart_transport_options' => $transportOptions,
            'cart_transport_selection' => $activeCart?->transport_selection ?? [],
            'cart_discounts' => $activeCart?->discounts ?? [],
        ]);
    }

    public function addProduct(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
            'quantity' => 'integer|min:1',
        ]);
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $cart = $user->cart()->firstOrCreate([]);
        $quantity = $request->input('quantity', 1);
        $cart->products()->syncWithoutDetaching([
            $request->product_id => ['quantity' => $quantity]
        ]);
        return response()->json(['message' => 'Produit ajouté au panier']);
    }

    public function removeProduct(Request $request)
    {
        $request->validate([
            'product_id' => 'required|exists:products,id',
        ]);
        $cart = Auth::user()->cart;
        if ($cart) {
            $cart->products()->detach($request->product_id);
        }
        return response()->json(['message' => 'Produit retiré du panier']);
    }

    public function save(Request $request, CartTcpdfService $cartTcpdfService)
    {
        $data = $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|integer|min:1',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.line_total' => 'nullable|numeric|min:0',
            'items.*.comment' => 'nullable|string|max:2000',
            'comment' => 'nullable|string|max:2000',
            'shipping_total' => 'nullable|numeric|min:0',
            'shipping_by_db' => 'nullable|array',
            'shipping_by_db.*' => 'nullable|numeric|min:0',
            'discounts' => 'nullable|array',
            'discounts.*.type' => 'required|in:fixed,percent',
            'discounts.*.value' => 'required|numeric|min:0',
            'transport_selection' => 'nullable|array',
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();
        $shippingByDb = $this->normalizeShippingByDb($data['shipping_by_db'] ?? null);

        // Le panier sauvegardé est un brouillon courant distinct des commandes processées.
        $cart = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'current')
            ->latest('updated_at')
            ->first();

        if (!$cart) {
            $cart = Cart::create([
                'user_id' => $user->id,
                'status' => 'current',
            ]);
        }

        $discounts = array_key_exists('discounts', $data)
            ? $this->normalizeDiscounts($data['discounts'], $user)
            : (is_array($cart->discounts) ? $cart->discounts : []);

        $cart->status = 'current';
        $cart->comment = $data['comment'] ?? null;

        $syncData = [];
        foreach ($data['items'] as $item) {
            $syncData[$item['id']] = [
                'quantity' => $item['quantity'],
                'comment' => $item['comment'] ?? null,
            ];
        }

        $cart->products()->sync($syncData);
        $cart->touch();

        $shippingTotal = round((float) ($data['shipping_total'] ?? 0) * 100) / 100;
        $transportSelection = $this->normalizeTransportSelection($data['transport_selection'] ?? null);
        $result = $this->generateAndStorePdfForCart(
            $cart,
            $data['items'],
            $user,
            $shippingTotal,
            $cartTcpdfService,
            false,
            $transportSelection,
            $discounts,
            $shippingByDb,
        );

        $request->session()->forget('cart_filter_ids');

        return response()->json([
            'status' => 'ok',
            'order_id' => $result['order_id'],
            'order_number' => $result['order_number'],
            'pdf_filename' => $result['pdf_filename'],
            'pdf_download_url' => $result['pdf_download_url'],
            'message' => __('Panier enregistré avec succès, PDF généré'),
        ]);
    }

    public function show(Cart $cart)
    {
        return response()->json($cart->load('products'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Cart $cart)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Cart $cart)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Request $request, Cart $cart)
    {
        /** @var \App\Models\User|null $user */
        $user = Auth::user();
        if (!$user || (!$user->hasRole('admin') && $cart->user_id !== $user->id)) {
            abort(403, 'Unauthorized');
        }

        $cart->delete();

        if ($request->header('X-Inertia')) {
            return redirect()->back(303);
        }

        return response()->json(['message' => 'Commande supprimée']);
    }

    public function updateStatus(Request $request, Cart $cart)
    {
        /** @var \App\Models\User|null $user */
        $user = Auth::user();
        if (!$user || (!$user->hasRole('admin') && $cart->user_id !== $user->id)) {
            abort(403, 'Unauthorized');
        }

        $data = $request->validate([
            'status' => 'required|in:current,processing,processed',
        ]);

        if ($data['status'] === 'current') {
            Cart::query()
                ->where('user_id', $cart->user_id)
                ->where('id', '!=', $cart->id)
                ->where('status', 'current')
                ->update(['status' => 'processed']);
        }

        $cart->status = $data['status'];
        $cart->save();

        if ($request->header('X-Inertia')) {
            return redirect()->back(303);
        }

        return response()->json(['message' => 'Statut mis a jour', 'status' => $cart->status]);
    }

    /**
     * Generate PDF from cart items
     */
    public function generatePdf(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.comment' => 'nullable|string|max:2000',
            'comment' => 'nullable|string|max:2000',
            'shipping_total' => 'nullable|numeric|min:0',
            'group_label' => 'nullable|string|max:190',
            'group_key' => 'nullable|integer|min:0',
        ]);

        // Récupérer les produits avec leurs détails
        $productIds = collect($data['items'])->pluck('id')->toArray();
        $products = Product::with(['category', 'tags', 'media', 'dbProduct'])->whereIn('id', $productIds)->get()->keyBy('id');

        // Avant de rendre le PDF, telecharger les images manquantes et preparer les conversions.
        $mediaService = app(ProductMediaService::class);
        foreach ($products as $product) {
            try {
                if (!$product->getFirstMedia('images')) {
                    $result = $mediaService->downloadMissing($product);
                    if (!($result['ok'] ?? false)) {
                        Log::info('Cart PDF media sync skipped for product', [
                            'product_id' => $product->id,
                            'reason' => $result['message'] ?? 'unknown',
                        ]);
                    }
                }

                if ($product->getFirstMedia('images')) {
                    $mediaService->ensureThumbnail($product);
                }
            } catch (\Throwable $e) {
                Log::warning('Cart PDF media preparation failed', [
                    'product_id' => $product->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Recharger pour utiliser les medias potentiellement crees juste avant le rendu.
        $products = Product::with(['category', 'tags', 'media', 'dbProduct'])->whereIn('id', $productIds)->get()->keyBy('id');

        // Construire les items avec les produits complets
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $priceCalculator = app(PriceCalculatorService::class);

        $items = collect($data['items'])->map(function ($item) use ($products, $user, $priceCalculator) {
            $product = $products[$item['id']];
            [$unitPrice, $lineTotal] = $this->getCartPricing($product, (int) $item['quantity'], $user, $priceCalculator);

            return [
                'product' => $product,
                'quantity' => (int) $item['quantity'],
                'comment' => trim((string) ($item['comment'] ?? '')),
                'unit_price' => $unitPrice,
                'line_total' => $lineTotal,
            ];
        });

        // Calculer le total
        $itemsTotal = $items->sum(function ($item) {
            return $item['line_total'];
        });
        $shippingTotal = round((float) ($data['shipping_total'] ?? 0) * 100) / 100;
        $total = $itemsTotal + $shippingTotal;
        $rollDistribution = app(PdfRollDistributionService::class)->build($items);

        // Récupérer le facturant et le commercial via le pivot db_product_user ou ClientSalesCondition
        $facturant = null;
        $commercial = null;
        $dbProductId = isset($data['group_key']) ? (int) $data['group_key'] : 0;
        if ($dbProductId > 0) {
            $pivot = DB::table('db_product_user')
                ->where('user_id', $user->id)
                ->where('db_product_id', $dbProductId)
                ->value('attributes');
            $attrs = is_string($pivot) ? json_decode($pivot, true) : (is_array($pivot) ? $pivot : []);

            if (!is_array($attrs)) {
                $attrs = [];
            }

            if (empty($attrs['fact']) || empty($attrs['com'])) {
                $condition = \App\Models\ClientSalesCondition::query()
                    ->where('client_user_id', $user->id)
                    ->where('db_product_id', $dbProductId)
                    ->where('active', true)
                    ->first(['billing_user_id', 'seller_user_id']);
                if ($condition) {
                    if (empty($attrs['fact']) && $condition->billing_user_id) {
                        $attrs['fact'] = (int) $condition->billing_user_id;
                    }
                    if (empty($attrs['com']) && $condition->seller_user_id) {
                        $attrs['com'] = (int) $condition->seller_user_id;
                    }
                }
            }

            $factId = isset($attrs['fact']) ? (int) $attrs['fact'] : null;
            $comId  = isset($attrs['com'])  ? (int) $attrs['com']  : null;
            if ($factId) {
                $facturant  = \App\Models\User::with('usersMeta')->find($factId);
            }
            if ($comId) {
                $commercial = \App\Models\User::with('usersMeta')->find($comId);
            }
        }

        // Générer le PDF avec Spatie
        $label = isset($data['group_label']) ? trim((string) $data['group_label']) : '';
        $safeLabel = $label !== '' ? Str::slug($label) : 'panier';
        $suffix = $dbProductId > 0 ? '-' . $dbProductId : '';

        return Pdf::view('pdf.cart', [
            'items' => $items,
            'items_total' => $itemsTotal,
            'shipping_total' => $shippingTotal,
            'total' => $total,
            'roll_distribution' => $rollDistribution,
            'user' => $user,
            'facturant' => $facturant,
            'commercial' => $commercial,
            'comment' => trim((string) ($data['comment'] ?? '')),
        ])
            ->format('a4')
            ->name($safeLabel . $suffix . '-' . now()->format('Y-m-d-His') . '.pdf')
            ->download();
    }

    /**
     * Generate PDF from cart items using TCPDF (fallback/simple renderer).
     */
    public function generatePdfTcpdf(Request $request, CartTcpdfService $cartTcpdfService, OrderSnapshotService $orderSnapshotService)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.line_total' => 'nullable|numeric|min:0',
            'items.*.comment' => 'nullable|string|max:2000',
            'comment' => 'nullable|string|max:2000',
            'shipping_total' => 'nullable|numeric|min:0',
            'shipping_by_db' => 'nullable|array',
            'shipping_by_db.*' => 'nullable|numeric|min:0',
            'discounts' => 'nullable|array',
            'discounts.*.type' => 'required|in:fixed,percent',
            'discounts.*.value' => 'required|numeric|min:0',
            'transport_selection' => 'nullable|array',
            'group_label' => 'nullable|string|max:190',
            'group_key' => 'nullable|integer|min:0',
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();
        $shippingByDb = $this->normalizeShippingByDb($data['shipping_by_db'] ?? null);
        $shippingTotal = round((float) ($data['shipping_total'] ?? 0) * 100) / 100;
        $transportSelection = $this->normalizeTransportSelection($data['transport_selection'] ?? null);

        $requestedByProductId = [];
        foreach ($data['items'] as $item) {
            $productId = (int) $item['id'];
            $qty = (int) $item['quantity'];
            $requestedByProductId[$productId] = ($requestedByProductId[$productId] ?? 0) + $qty;
        }

        $cart = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'processing')
            ->latest('updated_at')
            ->first();

        if (!$cart) {
            $cart = Cart::create([
                'user_id' => $user->id,
                'status' => 'processing',
            ]);
        }

        $storedCurrentDiscounts = Cart::query()
            ->where('user_id', $user->id)
            ->where('status', 'current')
            ->latest('updated_at')
            ->value('discounts');
        if (is_string($storedCurrentDiscounts)) {
            $storedCurrentDiscounts = json_decode($storedCurrentDiscounts, true);
        }
        $discounts = array_key_exists('discounts', $data)
            ? $this->normalizeDiscounts($data['discounts'], $user)
            : (is_array($storedCurrentDiscounts)
                ? $storedCurrentDiscounts
                : (is_array($cart->discounts) ? $cart->discounts : []));

        $syncData = [];
        foreach ($requestedByProductId as $productId => $qty) {
            $matchingItem = collect($data['items'])->firstWhere('id', (int) $productId);
            $syncData[(int) $productId] = [
                'quantity' => (int) $qty,
                'comment' => $matchingItem['comment'] ?? null,
            ];
        }
        $cart->products()->sync($syncData);
        $cart->comment = $data['comment'] ?? null;
        $cart->touch();

        $result = $this->generateAndStorePdfForCart(
            $cart,
            $data['items'],
            $user,
            $shippingTotal,
            $cartTcpdfService,
            true,
            $transportSelection,
            $discounts,
            $shippingByDb,
        );

        $existingSnapshot = \App\Models\OrderHeader::query()
            ->where('cart_id', $cart->id)
            ->latest('id')
            ->first();

        if (!$existingSnapshot) {
            $payloadForSnapshot = $this->buildPdfPayload($data['items'], $user, $shippingTotal, false, $transportSelection, $discounts, $shippingByDb, $data['comment'] ?? null);
            $orderSnapshotService->createFromPayload(
                $cart,
                $user,
                $payloadForSnapshot,
                ['source' => 'generate_pdf_tcpdf']
            );
        }

        return response($result['pdf_binary'], 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $result['pdf_filename'] . '"',
        ]);
    }

    private function getCartPricing(Product $product, int $quantity, ?\App\Models\User $user, PriceCalculatorService $priceCalculator): array
    {
        $qty = max(0, (int) $quantity);
        $cond = max(0, (int) ($product->cond ?? 0));
        $floor = max(0, (int) ($product->floor ?? 0));
        $roll = max(0, (int) ($product->roll ?? 0));

        $traySize = $cond > 0 ? $cond : 0;
        $floorSize = $cond > 0 && $floor > 0 ? $cond * $floor : 0;
        $rollSize = $cond > 0 && $floor > 0 && $roll > 0 ? $cond * $floor * $roll : 0;

        [$price, $priceFloor, $priceRoll, $pricePromo] = $this->resolveProductPrices($product, $user, $priceCalculator);
        $volumePriceSelector = new ProductVolumePriceSelector();

        $unitPrice = $volumePriceSelector->selectUnitPrice(
            quantity: $qty,
            traySize: $traySize,
            floorSize: $floorSize,
            rollSize: $rollSize,
            standardUnitPrice: $price,
            floorUnitPrice: $priceFloor,
            rollUnitPrice: $priceRoll,
            promoUnitPrice: $pricePromo,
        );

        $lineTotal = $unitPrice * $qty;

        return [$unitPrice, $lineTotal];
    }

    private function resolveProductPrices(Product $product, ?\App\Models\User $user, PriceCalculatorService $priceCalculator): array
    {
        $price = (float) ($product->price ?? 0);
        $priceFloor = (float) ($product->price_floor ?? 0);
        $priceRoll = (float) ($product->price_roll ?? 0);
        $pricePromo = (float) ($product->price_promo ?? 0);

        if ($user && $product->db_products_id) {
            $prices = $priceCalculator->calculatePrice($product, $user, (int) $product->db_products_id);
            $price = (float) ($prices[0] ?? $price);
            $priceFloor = (float) ($prices[1] ?? $priceFloor);
            $priceRoll = (float) ($prices[2] ?? $priceRoll);
            $pricePromo = (float) ($prices[3] ?? $pricePromo);
        }

        return (new ProductPriceFallbackResolver())->resolve(
            standardUnitPrice: $price,
            floorUnitPrice: $priceFloor,
            rollUnitPrice: $priceRoll,
            promoUnitPrice: $pricePromo,
        );
    }

    private function buildPdfPayload(
        array $itemsInput,
        \App\Models\User $user,
        float $shippingTotal,
        bool $preferInputPrices = false,
        array $transportSelection = [],
        array $discountSelections = [],
        array $shippingByDb = [],
        ?string $comment = null,
    ): array
    {
        $productIds = collect($itemsInput)->pluck('id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        $products = Product::with(['category', 'tags', 'media', 'dbProduct'])
            ->whereIn('id', $productIds)
            ->get()
            ->keyBy('id');

        $mediaService = app(ProductMediaService::class);
        foreach ($products as $product) {
            try {
                if (!$product->getFirstMedia('images')) {
                    $mediaService->downloadMissing($product);
                }

                if ($product->getFirstMedia('images')) {
                    $mediaService->ensureThumbnail($product);
                }
            } catch (\Throwable $e) {
                Log::warning('Order PDF media preparation failed', [
                    'product_id' => $product->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $products = Product::with(['category', 'tags', 'media', 'dbProduct'])
            ->whereIn('id', $productIds)
            ->get()
            ->keyBy('id');

        $priceCalculator = app(PriceCalculatorService::class);
        $items = collect($itemsInput)
            ->map(function ($item) use ($products, $user, $priceCalculator, $preferInputPrices) {
                $product = $products[$item['id']];
                $quantity = (int) $item['quantity'];
                [$unitPrice, $lineTotal] = $this->getCartPricing($product, $quantity, $user, $priceCalculator);

                if ($preferInputPrices) {
                    $providedUnitPrice = isset($item['unit_price']) ? (float) $item['unit_price'] : null;
                    $providedLineTotal = isset($item['line_total']) ? (float) $item['line_total'] : null;

                    if ($providedUnitPrice !== null && $providedUnitPrice >= 0) {
                        $unitPrice = $providedUnitPrice;
                        $lineTotal = $providedLineTotal !== null && $providedLineTotal >= 0
                            ? $providedLineTotal
                            : ($providedUnitPrice * $quantity);
                    }
                }

                return [
                    'product' => $product,
                    'quantity' => $quantity,
                    'comment' => trim((string) ($item['comment'] ?? '')),
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            })
            ->values();

        $itemsTotal = $items->sum(fn ($item) => $item['line_total']);
        $rollDistribution = app(PdfRollDistributionService::class)->build($items);

        $dbProductIds = $items
            ->map(fn ($item) => (int) ($item['product']->db_products_id ?? 0))
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        $facturantIds = [];
        $commercialIds = [];
        $pivotsByDbProductId = [];

        $clientConditions = \App\Models\ClientSalesCondition::query()
            ->where('client_user_id', $user->id)
            ->where('active', true)
            ->get(['db_product_id', 'billing_user_id', 'seller_user_id'])
            ->keyBy('db_product_id');

        foreach ($dbProductIds as $dbProductId) {
            $pivot = DB::table('db_product_user')
                ->where('user_id', $user->id)
                ->where('db_product_id', $dbProductId)
                ->value('attributes');

            $attrs = is_string($pivot) ? json_decode($pivot, true) : (is_array($pivot) ? $pivot : []);

            if (!is_array($attrs)) {
                $attrs = [];
            }

            if (empty($attrs['fact']) || empty($attrs['com'])) {
                $condition = $clientConditions->get($dbProductId);
                if ($condition) {
                    if (empty($attrs['fact']) && $condition->billing_user_id) {
                        $attrs['fact'] = (int) $condition->billing_user_id;
                    }
                    if (empty($attrs['com']) && $condition->seller_user_id) {
                        $attrs['com'] = (int) $condition->seller_user_id;
                    }
                }
            }

            if ($attrs === []) {
                continue;
            }

            $selection = $transportSelection[$dbProductId] ?? null;
            if (is_array($selection)) {
                $carrierId = isset($selection['carrier_id']) ? (int) $selection['carrier_id'] : 0;
                $zoneId = isset($selection['zone_id']) ? (int) $selection['zone_id'] : 0;
                if ($carrierId > 0 && $zoneId > 0) {
                    $attrs['transport_selection'] = [
                        [
                            'carrier_id' => $carrierId,
                            'zone_id' => $zoneId,
                            'tva' => isset($selection['tva']) && is_numeric($selection['tva'])
                                ? (float) $selection['tva']
                                : null,
                        ],
                    ];
                    $attrs['z'] = $zoneId;
                }
            }

            $pivotsByDbProductId[(int) $dbProductId] = $attrs;

            if (!empty($attrs['fact'])) {
                $facturantIds[] = (int) $attrs['fact'];
            }

            if (!empty($attrs['com'])) {
                $commercialIds[] = (int) $attrs['com'];
            }
        }

        $backendShipping = $this->computeShippingFromRollDistribution($rollDistribution, $pivotsByDbProductId);
        $effectiveShipping = $backendShipping > 0.0 ? $backendShipping : $shippingTotal;

        $facturantUsers = \App\Models\User::with('usersMeta')->whereIn('id', array_values(array_unique($facturantIds)))->get();
        $commercialUsers = \App\Models\User::with('usersMeta')->whereIn('id', array_values(array_unique($commercialIds)))->get();

        $mailRecipients = collect([$user])
            ->merge($facturantUsers)
            ->merge($commercialUsers)
            ->filter(fn ($u) => !empty($u?->email))
            ->unique(fn ($u) => strtolower((string) $u->email))
            ->values();

        $discountSummary = $this->calculateDiscountSummary(
            $items,
            $effectiveShipping,
            $discountSelections,
            $shippingByDb,
        );
        $discountTotal = $discountSummary['total'];
        $total = max(0, round($itemsTotal + $effectiveShipping - $discountTotal, 2));

        return [
            'items' => $items,
            'items_total' => $itemsTotal,
            'shipping_total' => $effectiveShipping,
            'discounts' => $discountSummary['by_db'],
            'discount_total' => $discountTotal,
            'total' => $total,
            'roll_distribution' => $rollDistribution,
            'user' => $user,
            'facturant' => $facturantUsers->first(),
            'commercial' => $commercialUsers->first(),
            'mail_recipients' => $mailRecipients,
            'comment' => trim((string) ($comment ?? '')),
        ];
    }

    private function sendOrderPdfMails(
        iterable $recipients,
        string $pdfRelativePath,
        string $orderNumber,
        \App\Models\User $client,
        string $disk = 'public',
        ?string $attachmentName = null
    ): int
    {
        $sent = 0;
        $pdfAbsolutePath = Storage::disk($disk)->path($pdfRelativePath);
        $attachmentFilename = $attachmentName ?: $this->buildOrderPdfFilename((int) $orderNumber);

        foreach ($recipients as $recipient) {
            try {
                Mail::raw(
                    "Bonjour {$recipient->name},\n\nVeuillez trouver en piece jointe la commande n{$orderNumber} du client {$client->name}.\n\nCordialement,\nInfovegetal",
                    function ($message) use ($recipient, $orderNumber, $pdfAbsolutePath, $attachmentFilename) {
                        $message->to($recipient->email, $recipient->name)
                            ->subject("Commande n{$orderNumber} - Infovegetal")
                            ->attach($pdfAbsolutePath, [
                                'as' => $attachmentFilename,
                                'mime' => 'application/pdf',
                            ]);
                    }
                );

                $sent++;
            } catch (\Throwable $e) {
                Log::error('Failed to send order PDF email', [
                    'recipient_id' => $recipient->id ?? null,
                    'recipient_email' => $recipient->email ?? null,
                    'order_number' => $orderNumber,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return $sent;
    }

    private function generateAndStorePdfForCart(
        Cart $cart,
        array $itemsInput,
        \App\Models\User $user,
        float $shippingTotal,
        CartTcpdfService $cartTcpdfService,
        bool $sendEmails,
        array $transportSelection = [],
        array $discountSelections = [],
        array $shippingByDb = [],
    ): array {
        $payload = $this->buildPdfPayload(
            $itemsInput,
            $user,
            $shippingTotal,
            false,
            $transportSelection,
            $discountSelections,
            $shippingByDb,
            $cart->comment,
        );
        $cart->transport_selection = $transportSelection;
        $cart->discounts = $discountSelections;
        $orderNumber = $this->formatOrderNumber((int) $cart->id);
        $payload['order_number'] = $orderNumber;

        $cart->items_total = round((float) ($payload['items_total'] ?? 0), 2);
        $cart->shipping_total = round((float) ($payload['shipping_total'] ?? 0), 2);
        $cart->save();

        $filename = $this->buildOrderPdfFilename((int) $cart->id);
        $pdfBinary = $cartTcpdfService->render($payload);

        $pdfRelativePath = sprintf('commandes/%d/%s', $user->id, $filename);
        Storage::disk('public')->put($pdfRelativePath, $pdfBinary);

        $user->files()->create([
            'file_name' => $filename,
            'file_path' => $pdfRelativePath,
            'file_size' => strlen($pdfBinary),
        ]);

        try {
            $user->addMediaFromString($pdfBinary)
                ->usingName(pathinfo($filename, PATHINFO_FILENAME))
                ->usingFileName($filename)
                ->withCustomProperties([
                    'source' => 'cart-tcpdf',
                    'shipping_total' => $shippingTotal,
                ])
                ->toMediaCollection('user_meta_files');
        } catch (\Throwable $e) {
            Log::warning('Failed to store TCPDF in media library', [
                'user_id' => $user->id,
                'filename' => $filename,
                'error' => $e->getMessage(),
            ]);
        }

        $mailCount = 0;
        if ($sendEmails) {
            $mailCount = $this->sendOrderPdfMails(
                $payload['mail_recipients'] ?? collect([$user]),
                $pdfRelativePath,
                $orderNumber,
                $user,
                'public',
                $filename,
            );
        }

        return [
            'order_id' => $cart->id,
            'order_number' => $orderNumber,
            'pdf_filename' => $filename,
            'pdf_relative_path' => $pdfRelativePath,
            'pdf_download_url' => asset('storage/' . $pdfRelativePath),
            'items_total' => $cart->items_total,
            'shipping_total' => $cart->shipping_total,
            'discount_total' => $payload['discount_total'] ?? 0,
            'mail_recipients_count' => $mailCount,
            'pdf_binary' => $pdfBinary,
        ];
    }

    private function computeShippingFromRollDistribution(array $rollDistribution, array $pivotsByDbProductId): float
    {
        return (new TransportDeparturePricingService())->calculate($rollDistribution, $pivotsByDbProductId);
    }

    private function pickZoneTariff(int $rollCount, array $tariffs): float
    {
        return (new TransportZoneTariffResolver())->resolve($rollCount, $tariffs);
    }

    private function parseTariffRange(string $key): ?array
    {
        $normalized = trim((string) preg_replace('/^roll:/', '', trim($key)));
        if ($normalized === '') {
            return null;
        }
        preg_match_all('/\d+(?:[.,]\d+)?/', $normalized, $matches);
        $parts = $matches[0] ?? [];
        if (empty($parts)) {
            return null;
        }
        $toVal = fn (string $v) => (float) str_replace(',', '.', $v);
        $min = $toVal($parts[0]);
        if (!is_finite($min)) {
            return null;
        }
        $max = isset($parts[1]) ? (is_finite($toVal($parts[1])) ? $toVal($parts[1]) : null) : null;

        return ['min' => $min, 'max' => $max];
    }

    private function tariffToFloat(mixed $value): float
    {
        if (is_float($value)) {
            return is_finite($value) ? $value : 0.0;
        }
        if (is_int($value)) {
            return (float) $value;
        }
        if (is_string($value)) {
            $parsed = (float) str_replace(',', '.', trim($value));
            return is_finite($parsed) ? $parsed : 0.0;
        }
        return 0.0;
    }

    private function tariffToFillRatio(float $coef): float
    {
        $normalized = $coef > 1.0 ? $coef / 100.0 : $coef;
        return max(0.0, min(1.0, $normalized));
    }

    private function normalizeShippingPriceMode(mixed $value): int
    {
        if (is_int($value) || is_float($value)) {
            return ((int) $value) === 1 ? 1 : 0;
        }

        $raw = strtolower(trim((string) $value));
        if ($raw === '1' || $raw === 'price_render') {
            return 1;
        }

        return 0;
    }

    /**
     * @return array<int, float>
     */
    private function normalizeShippingByDb(mixed $rawShipping): array
    {
        if (!is_array($rawShipping)) {
            return [];
        }

        $normalized = [];
        foreach ($rawShipping as $dbProductId => $amount) {
            $dbId = (int) $dbProductId;
            $value = is_numeric($amount) ? (float) $amount : 0.0;
            if ($dbId > 0 && is_finite($value) && $value >= 0) {
                $normalized[$dbId] = round($value, 2);
            }
        }

        return $normalized;
    }

    /**
     * @return array<int, array{type:string, value:float}>
     */
    private function normalizeDiscounts(mixed $rawDiscounts, \App\Models\User $user): array
    {
        if (!is_array($rawDiscounts) || $rawDiscounts === []) {
            return [];
        }

        if (!$user->hasAnyRole(['dev', 'admin', 'commercial']) && !$user->can('order.remise')) {
            abort(403, 'Vous n’êtes pas autorisé à appliquer une remise.');
        }

        $normalized = [];
        foreach ($rawDiscounts as $dbProductId => $discount) {
            $dbId = (int) $dbProductId;
            if ($dbId <= 0 || !is_array($discount)) {
                continue;
            }

            $type = ($discount['type'] ?? null) === 'percent' ? 'percent' : 'fixed';
            $value = isset($discount['value']) && is_numeric($discount['value'])
                ? (float) $discount['value']
                : 0.0;
            if (!is_finite($value)) {
                $value = 0.0;
            }

            $normalized[$dbId] = [
                'type' => $type,
                'value' => round($type === 'percent' ? min(100, max(0, $value)) : max(0, $value), 2),
            ];
        }

        return $normalized;
    }

    /**
     * @param \Illuminate\Support\Collection<int, array{product:Product, line_total:float|int}> $items
     * @param array<int, array{type:string, value:float}> $discountSelections
     * @param array<int, float> $shippingByDb
     * @return array{total:float, by_db:array<int, array{type:string, value:float, base:float, amount:float}>}
     */
    private function calculateDiscountSummary(
        $items,
        float $shippingTotal,
        array $discountSelections,
        array $shippingByDb,
    ): array {
        if ($discountSelections === []) {
            return ['total' => 0.0, 'by_db' => []];
        }

        $productTotals = $items
            ->groupBy(fn ($item) => (int) ($item['product']->db_products_id ?? 0))
            ->map(fn ($group) => round((float) $group->sum(fn ($item) => (float) ($item['line_total'] ?? 0)), 2))
            ->filter(fn ($total, $dbId) => (int) $dbId > 0 && $total >= 0);

        if ($productTotals->isEmpty()) {
            return ['total' => 0.0, 'by_db' => []];
        }

        $requestedShippingTotal = array_sum(array_intersect_key($shippingByDb, $productTotals->all()));
        $productGrandTotal = max(0.0, (float) $productTotals->sum());
        $shippingShares = [];
        $allocatedShipping = 0.0;
        $dbIds = $productTotals->keys()->map(fn ($id) => (int) $id)->values()->all();
        $lastDbId = end($dbIds);

        foreach ($dbIds as $dbId) {
            if ($dbId === $lastDbId) {
                $share = max(0, round($shippingTotal - $allocatedShipping, 2));
            } elseif ($requestedShippingTotal > 0) {
                $share = round($shippingTotal * (($shippingByDb[$dbId] ?? 0) / $requestedShippingTotal), 2);
            } elseif ($productGrandTotal > 0) {
                $share = round($shippingTotal * (((float) $productTotals[$dbId]) / $productGrandTotal), 2);
            } else {
                $share = round($shippingTotal / max(1, count($dbIds)), 2);
            }
            $shippingShares[$dbId] = $share;
            $allocatedShipping += $share;
        }

        $byDb = [];
        foreach ($discountSelections as $dbId => $discount) {
            if (!$productTotals->has($dbId)) {
                continue;
            }

            $base = round((float) $productTotals[$dbId] + ($shippingShares[$dbId] ?? 0), 2);
            $value = max(0, (float) ($discount['value'] ?? 0));
            $type = ($discount['type'] ?? null) === 'percent' ? 'percent' : 'fixed';
            $amount = $type === 'percent'
                ? round($base * min(100, $value) / 100, 2)
                : round(min($base, $value), 2);

            $byDb[$dbId] = [
                'type' => $type,
                'value' => $value,
                'base' => $base,
                'amount' => $amount,
            ];
        }

        return [
            'total' => round(array_sum(array_column($byDb, 'amount')), 2),
            'by_db' => $byDb,
        ];
    }

    /**
     * @param mixed $rawSelection
     * @return array<int, array{carrier_id:int, zone_id:int, tva?:float}>
     */
    private function normalizeTransportSelection(mixed $rawSelection): array
    {
        if (!is_array($rawSelection)) {
            return [];
        }

        $normalized = [];
        foreach ($rawSelection as $dbProductId => $choice) {
            $dbId = (int) $dbProductId;
            if ($dbId <= 0 || !is_array($choice)) {
                continue;
            }

            $carrierId = isset($choice['carrier_id']) ? (int) $choice['carrier_id'] : 0;
            $zoneId = isset($choice['zone_id']) ? (int) $choice['zone_id'] : 0;
            if ($carrierId <= 0 || $zoneId <= 0) {
                continue;
            }

            $entry = [
                'carrier_id' => $carrierId,
                'zone_id' => $zoneId,
            ];

            if (isset($choice['tva']) && is_numeric($choice['tva'])) {
                $entry['tva'] = (float) $choice['tva'];
            }

            $normalized[$dbId] = $entry;
        }

        return $normalized;
    }

    private function formatOrderNumber(int $cartId): string
    {
        return str_pad((string) $cartId, 5, '0', STR_PAD_LEFT);
    }

    private function buildOrderPdfFilename(int $cartId): string
    {
        return $this->formatOrderNumber($cartId) . '_' . now()->format('Y_m_d') . '.pdf';
    }

}
