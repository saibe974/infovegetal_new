<?php

namespace App\Http\Controllers;

use App\Http\Requests\FormProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Artisan;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Illuminate\Support\Facades\Gate;

class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
    //    $product = Product::with('category')->find(1);
    //    dd($product->category->name);
        $query = Product::with('category')->orderFromRequest($request);
        $search = $request->get('q');

        if ($search) {
            $query->where('id', '=', $search)->orWhere(function ($q) use ($search) {
                $q->where('name', 'like', '%' . $search . '%');
            });
        }

        return Inertia::render('products/index', [
            'q' => $search,
            'collection' => Inertia::scroll(fn() => ProductResource::collection(
                $query->paginate(10)
            ))
        ]);
    }

    /**
     * Handle CSV upload import. Expects a multipart file named 'file'.
     */
    public function import(Request $request)
    {
        // Gate::authorize('manage-products');

        dd($request);
/*
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $path = $request->file('file')->store('imports');

        // Call the existing artisan command with the stored file path
        // The command expects a --file option path relative to project root or absolute
        $fullPath = storage_path('app/' . $path);
        dd($fullPath);
        Artisan::call('products:import', ['--file' => $fullPath]);

        return redirect()->back()->with('success', 'Import lancé');*/
    }

    /**
     * Export products as CSV.
     */
    public function export(Request $request)
    {
    Gate::authorize('manage-products');

        $filename = 'products_export_' . date('Ymd_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () {
            $handle = fopen('php://output', 'w');
            // header
            fputcsv($handle, ['id', 'sku', 'name', 'category', 'description', 'price', 'active']);

            Product::with('category')->chunk(100, function ($products) use ($handle) {
                foreach ($products as $p) {
                    fputcsv($handle, [
                        $p->id,
                        $p->sku,
                        $p->name,
                        $p->category?->name,
                        $p->description,
                        $p->price,
                        $p->active ? 1 : 0,
                    ]);
                }
            });

            fclose($handle);
        };

        return new StreamedResponse($callback, 200, $headers);
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
