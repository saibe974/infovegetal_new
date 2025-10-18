<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Resources\ProductCategoryResource;
use Inertia\Inertia;
use App\Models\ProductCategory;

class ProductCategoryController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $search = $request->get('q');
        // $query = ProductCategory::orderFromRequest(request());
        // if ($search) {
        //     $query->where('name', 'like', '%' . $search . '%');
        // }

        return Inertia::render('products/categories-index', [
            'q' => $search,
            'collection' => Inertia::scroll(fn() => ProductCategoryResource::collection(
                ProductCategory::orderFromRequest($request)->paginate(10)
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
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
