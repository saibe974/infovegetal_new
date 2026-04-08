<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\Product;
use App\Services\PdfRollDistributionService;
use App\Services\CartTcpdfService;
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
    public function placeOrder(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'shipping_total' => 'nullable|numeric|min:0',
            'choice' => 'nullable|in:append,new',
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();

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
                    'number' => str_pad((string) $existingProcessing->id, 4, '0', STR_PAD_LEFT),
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
            $syncData[(int) $productId] = ['quantity' => (int) $qty];
        }
        $cart->products()->sync($syncData);
        $cart->touch();

        $shippingTotal = round((float) ($data['shipping_total'] ?? 0) * 100) / 100;

        $pdfPayload = $this->buildPdfPayload(
            array_values(array_map(
                fn ($productId, $qty) => ['id' => (int) $productId, 'quantity' => (int) $qty],
                array_keys($requestedByProductId),
                array_values($requestedByProductId),
            )),
            $user,
            $shippingTotal,
        );

        $cart->items_total = round((float) ($pdfPayload['items_total'] ?? 0), 2);
        $cart->shipping_total = round($shippingTotal, 2);
        $cart->save();

        $orderNumber = str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT);
        $orderDate = now()->format('Y-m-d');
        $pdfFilename = $orderNumber . '-' . $orderDate . '.pdf';
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
        return Inertia::render('products/cart') ;
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

    public function save(Request $request)
    {
        $data = $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|integer|min:1',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        // Créer ou récupérer le panier de l'utilisateur
        /** @var \App\Models\User $user */
        $user = Auth::user();
        $cart = $user->cart()->firstOrCreate([]);

        // Préparer les données pour synchroniser les produits
        $syncData = [];
        foreach ($data['items'] as $item) {
            $syncData[$item['id']] = ['quantity' => $item['quantity']];
        }

        // Synchroniser les produits du panier
        $cart->products()->sync($syncData);

        // Nettoyer la session du filtre panier
        $request->session()->forget('cart_filter_ids');

        return response()->json([
            'status' => 'ok',
            'message' => __('Panier enregistré avec succès'),
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
            'status' => 'required|in:processing,processed',
        ]);

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

        // Récupérer le facturant et le commercial via le pivot db_products_users
        $facturant = null;
        $commercial = null;
        $dbProductId = isset($data['group_key']) ? (int) $data['group_key'] : 0;
        if ($dbProductId > 0) {
            $pivot = DB::table('db_products_users')
                ->where('user_id', $user->id)
                ->where('db_product_id', $dbProductId)
                ->value('attributes');
            if ($pivot) {
                $attrs = is_array($pivot) ? $pivot : json_decode($pivot, true);
                $factId = isset($attrs['fact']) ? (int) $attrs['fact'] : null;
                $comId  = isset($attrs['com'])  ? (int) $attrs['com']  : null;
                if ($factId) {
                    $facturant  = \App\Models\User::with('usersMeta')->find($factId);
                }
                if ($comId) {
                    $commercial = \App\Models\User::with('usersMeta')->find($comId);
                }
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
        ])
            ->format('a4')
            ->name($safeLabel . $suffix . '-' . now()->format('Y-m-d-His') . '.pdf')
            ->download();
    }

    /**
     * Generate PDF from cart items using TCPDF (fallback/simple renderer).
     */
    public function generatePdfTcpdf(Request $request, CartTcpdfService $cartTcpdfService)
    {
        $data = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'items.*.unit_price' => 'nullable|numeric|min:0',
            'items.*.line_total' => 'nullable|numeric|min:0',
            'shipping_total' => 'nullable|numeric|min:0',
            'group_label' => 'nullable|string|max:190',
            'group_key' => 'nullable|integer|min:0',
        ]);

        /** @var \App\Models\User $user */
        $user = Auth::user();
        $shippingTotal = round((float) ($data['shipping_total'] ?? 0) * 100) / 100;

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

        $syncData = [];
        foreach ($requestedByProductId as $productId => $qty) {
            $syncData[(int) $productId] = ['quantity' => (int) $qty];
        }
        $cart->products()->sync($syncData);
        $cart->touch();

        $payload = $this->buildPdfPayload($data['items'], $user, $shippingTotal, true);
        $orderNumber = str_pad((string) $cart->id, 5, '0', STR_PAD_LEFT);
        $payload['order_number'] = $orderNumber;

        $cart->items_total = round((float) ($payload['items_total'] ?? 0), 2);
        $cart->shipping_total = round($shippingTotal, 2);
        $cart->save();

        $orderDate = now()->format('Y-m-d');
        $filename = $orderNumber . '-' . $orderDate . '.pdf';

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

        $this->sendOrderPdfMails(
            $payload['mail_recipients'] ?? collect([$user]),
            $pdfRelativePath,
            $orderNumber,
            $user,
            'public',
            $filename,
        );

        return response($pdfBinary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
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
        $rollPrice = $pricePromo > 0 ? $pricePromo : $priceRoll;

        $unitPrice = $price > 0 ? $price : 0;

        if ($rollSize > 0 && $rollPrice > 0 && $qty >= $rollSize) {
            $unitPrice = $rollPrice;
        } elseif ($floorSize > 0 && $priceFloor > 0 && $qty >= $floorSize) {
            $unitPrice = $priceFloor;
        } elseif ($traySize > 0 && $price > 0 && $qty >= $traySize) {
            $unitPrice = $price;
        }

        $lineTotal = $unitPrice * $qty;

        return [$unitPrice, $lineTotal];
    }

    private function resolveProductPrices(Product $product, ?\App\Models\User $user, PriceCalculatorService $priceCalculator): array
    {
        $price = (float) ($product->price ?? 0);
        $priceFloor = (float) ($product->price_floor ?? 0);
        $priceRoll = (float) ($product->price_roll ?? 0);
        $pricePromo = (float) ($product->price_promo ?? 0);

        if ($user && !$user->hasRole('admin') && $product->db_products_id) {
            $prices = $priceCalculator->calculatePrice($product, $user, (int) $product->db_products_id);
            $price = (float) ($prices[0] ?? $price);
            $priceFloor = (float) ($prices[1] ?? $priceFloor);
            $priceRoll = (float) ($prices[2] ?? $priceRoll);
            $pricePromo = (float) ($prices[3] ?? $pricePromo);
        }

        $base = 0.0;
        foreach ([$price, $priceFloor, $priceRoll] as $candidate) {
            if ($candidate > 0) {
                $base = $candidate;
                break;
            }
        }

        $fallback = $base > 0 ? $base : 0.01;

        return [
            $price > 0 ? $price : $fallback,
            $priceFloor > 0 ? $priceFloor : $fallback,
            $priceRoll > 0 ? $priceRoll : $fallback,
            $pricePromo > 0 ? $pricePromo : 0,
        ];
    }

    private function buildPdfPayload(array $itemsInput, \App\Models\User $user, float $shippingTotal, bool $preferInputPrices = false): array
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
                    'unit_price' => $unitPrice,
                    'line_total' => $lineTotal,
                ];
            })
            ->values();

        $itemsTotal = $items->sum(fn ($item) => $item['line_total']);
        $total = $itemsTotal + $shippingTotal;
        $rollDistribution = app(PdfRollDistributionService::class)->build($items);

        $dbProductIds = $items
            ->map(fn ($item) => (int) ($item['product']->db_products_id ?? 0))
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values();

        $facturantIds = [];
        $commercialIds = [];
        foreach ($dbProductIds as $dbProductId) {
            $pivot = DB::table('db_products_users')
                ->where('user_id', $user->id)
                ->where('db_product_id', $dbProductId)
                ->value('attributes');

            if (!$pivot) {
                continue;
            }

            $attrs = is_array($pivot) ? $pivot : json_decode($pivot, true);
            if (!is_array($attrs)) {
                continue;
            }

            if (!empty($attrs['fact'])) {
                $facturantIds[] = (int) $attrs['fact'];
            }

            if (!empty($attrs['com'])) {
                $commercialIds[] = (int) $attrs['com'];
            }
        }

        $facturantUsers = \App\Models\User::with('usersMeta')->whereIn('id', array_values(array_unique($facturantIds)))->get();
        $commercialUsers = \App\Models\User::with('usersMeta')->whereIn('id', array_values(array_unique($commercialIds)))->get();

        $mailRecipients = collect([$user])
            ->merge($facturantUsers)
            ->merge($commercialUsers)
            ->filter(fn ($u) => !empty($u?->email))
            ->unique(fn ($u) => strtolower((string) $u->email))
            ->values();

        return [
            'items' => $items,
            'items_total' => $itemsTotal,
            'shipping_total' => $shippingTotal,
            'total' => $total,
            'roll_distribution' => $rollDistribution,
            'user' => $user,
            'facturant' => $facturantUsers->first(),
            'commercial' => $commercialUsers->first(),
            'mail_recipients' => $mailRecipients,
        ];
    }

    private function sendOrderPdfMails(
        $recipients,
        string $pdfRelativePath,
        string $orderNumber,
        \App\Models\User $client,
        string $disk = 'public',
        ?string $attachmentName = null
    ): int
    {
        $sent = 0;
        $pdfAbsolutePath = Storage::disk($disk)->path($pdfRelativePath);
        $attachmentFilename = $attachmentName ?: "commande-{$orderNumber}.pdf";

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
}
