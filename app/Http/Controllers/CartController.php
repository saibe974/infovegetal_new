<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Spatie\LaravelPdf\Facades\Pdf;

class CartController extends Controller
{
    public function index()
    {
        $cart = Auth::user()->cart()->with('products')->firstOrCreate([]);
        return response()->json($cart->load('products'));
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
        $cart = Auth::user()->cart()->firstOrCreate([]);
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
        $cart = Auth::user()->cart()->firstOrCreate([]);

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
    public function destroy(Cart $cart)
    {
        //
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
        ]);

        // Récupérer les produits avec leurs détails
        $productIds = collect($data['items'])->pluck('id')->toArray();
        $products = Product::with(['category', 'tags'])->whereIn('id', $productIds)->get()->keyBy('id');

        // Construire les items avec les produits complets
        $items = collect($data['items'])->map(function ($item) use ($products) {
            return [
                'product' => $products[$item['id']],
                'quantity' => $item['quantity'],
            ];
        });

        // Calculer le total
        $total = $items->sum(function ($item) {
            return $item['product']->price * $item['quantity'];
        });

        $user = Auth::user();

        // Générer le PDF avec Spatie
        return Pdf::view('pdf.cart', [
            'items' => $items,
            'total' => $total,
            'user' => $user,
        ])
            ->format('a4')
            ->name('panier-' . now()->format('Y-m-d-His') . '.pdf')
            ->download();
    }
}
