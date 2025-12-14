<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\CategoryProducts;
use App\Models\Tag;

class SearchController extends Controller
{
    public function propositions(Request $request)
    {
        $context = $request->string('context')->toString();
        $search = trim($request->string('q')->toString());
        if ($search === '' || mb_strlen($search) < 2) {
            return response()->json(['propositions' => []]);
        }

        $limit = (int)($request->integer('limit') ?: 10);

        if ($context === 'products') {
            $query = Product::with(['category','tags'])->orderFromRequest($request);

            $normalized = trim($search);
            $tokens = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $isSingleNumeric = count($tokens) === 1 && ctype_digit($tokens[0]);

            $query->where(function ($q) use ($tokens, $isSingleNumeric) {
                if ($isSingleNumeric) {
                    $q->where('id', '=', (int) $tokens[0]);
                }
                $q->orWhere(function ($qq) use ($tokens) {
                    foreach ($tokens as $t) {
                        $qq->where('name', 'like', '%' . $t . '%');
                    }
                });
            });

            $items = ProductController::getSearchPropositions($query, $search);
            return response()->json(['propositions' => array_slice($items, 0, $limit)]);
        }

        // Fallback simple pour catégories et tags (pas de helper dédié fourni)
        if ($context === 'categories') {
            $items = CategoryProducts::query()
                ->where('name', 'like', "%$search%")
                ->limit($limit)
                ->pluck('name')
                ->all();
            return response()->json(['propositions' => $items]);
        }

        if ($context === 'tags') {
            $items = Tag::query()
                ->where('name', 'like', "%$search%")
                ->limit($limit)
                ->pluck('name')
                ->all();
            return response()->json(['propositions' => $items]);
        }

        // Contexte inconnu: renvoyer vide
        return response()->json(['propositions' => []]);
    }
}
