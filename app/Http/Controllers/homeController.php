<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Client\Request as ClientRequest;
use Illuminate\Http\Request;
use App\Http\Controllers\ProductController;

class homeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Product::with(['category', 'tags'])->orderFromRequest($request);
        $search = $request->get('q');

        // if ($search) {
        //     $normalized = trim($search);
        //     $tokens = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        //     $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);

        //     $query->where(function ($q) use ($tokens, $isSingleNumeric) {
        //         // Si un seul terme numérique, tenter l'ID exact
        //         if ($isSingleNumeric) {
        //             $q->where('id', '=', (int) $tokens[0]);
        //         }

        //         // Et toujours proposer une recherche sur le nom qui contient tous les termes
        //         $q->orWhere(function ($qq) use ($tokens) {
        //             foreach ($tokens as $t) {
        //                 $qq->where('name', 'like', '%' . $t . '%');
        //             }
        //         });
        //     });
        // }

        return inertia('home', [
            'q' => $search,
            'collection' => inertia()->scroll(fn() => ProductResource::collection(
                (clone $query)->paginate(10)
            )),
            'searchPropositions' => inertia()->optional(fn() => ProductController::getSearchPropositions(clone $query, $search)),
        ]);
    }

    public function documentation(Request $request)
    {
        
        return inertia('documentation', []);
    }

    public function legalNotices(Request $request)
    {
        
        return inertia('legals/legal-notices', []);
    }

    public function saleConditions(Request $request)
    {
        
        return inertia('legals/sale-conditions', []);
    }

    public function ourPolicy(Request $request)
    {
        
        return inertia('legals/our-policy', []);
    }
}
