<?php

namespace App\Http\Controllers;

use App\Http\Requests\FormProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Product::query()->orderFromRequest($request);
        $search = $request->get('q');

        if ($search) {
            // $query->where('name', 'like', '%'.$search.'%');
            $query->where('id', '=', $search)->orWhere(function ($q) use ($search) {
                $q->where('name', 'like', '%'.$search.'%');
            });
        }

        return Inertia::render('products/index', [
            'q' => $search,
            'collection' => Inertia::scroll(fn () => ProductResource::collection(
                $query->paginate(10)
            )),
            // return unique names only (one entry per name). Use MIN(id) as a representative id.
            'search' => Inertia::optional(fn () => ProductResource::collection(
                $query
                    // ->selectRaw('MIN(id) as id, name')
                    // ->groupBy('name')
                    // ->orderBy('name')
                    ->select('id', 'name')
                    ->limit(5)
                    ->get()
            )),
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(FormProductRequest $request)
    {
        $product = Product::create($request->validated());
        $this->handleFormRequest($product, $request);

        return redirect()->route('products.edit', $product)->with('success', 'Produit créé');
    }

    /**
     * Display the specified resource.
     */
    public function show(Product $product)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Product $product)
    {
        return Inertia::render('products/form', [
            'product' => new ProductResource($product),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(FormProductRequest $request, Product $product)
    {
        $product->update($request->validated());
        $this->handleFormRequest($product, $request);
        return redirect()->back()->with('success', 'Produit mis à jour');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Product $product)
    {
        $product->delete();
        return redirect()->back()->with('success', 'Produit supprimé');
    }

    private function handleFormRequest(Product $product, FormProductRequest $request)
    {
        // $image = $request->validated('image');
        // if ($image && $image instanceof UploadedFile) {
        //     $product->addMedia($image)->toMediaCollection('image');
        // }
    }
}
