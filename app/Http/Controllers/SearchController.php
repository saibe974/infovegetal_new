<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;
use App\Models\CategoryProducts;
use App\Models\Tag;
use App\Models\User;

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
            $items = ProductController::getSearchPropositions($query, $search);
            return response()->json(['propositions' => array_slice($items, 0, $limit)]);
        }

        if ($context === 'users') {
            $query = User::query();

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

            // Dédupliquer et normaliser les propositions comme pour les produits
            $clonedQuery = clone $query;
            $clonedQuery->getQuery()->orders = null; // Supprime les ORDER BY
            $propositions = $clonedQuery
                ->selectRaw('MIN(id) as id, name, MIN(created_at) as created_at')
                ->groupBy('name')
                ->pluck('name');

            $clean = function (string $str): string {
                $str = mb_strtolower($str);
                $str = preg_replace('/[^\p{L}\s-]/u', ' ', $str);
                $str = trim(preg_replace('/\s+/', ' ', $str));
                return $str;
            };

            $cleaned = $propositions
                ->map(fn($name) => $clean($name))
                ->filter(fn($name) => !empty($name))
                ->unique()
                ->values();

            $items = $cleaned->all();

            usort($items, function ($a, $b) use ($search) {
                $lowerSearch = mb_strtolower($search);
                $pa = (
                    !preg_match('/[-\s]/', $a) && str_starts_with($a, $lowerSearch)
                ) ? 1 : (
                    str_starts_with($a, $lowerSearch) ? 2 : (
                    str_contains($a, $lowerSearch) ? 3 : 4
                ));

                $pb = (
                    !preg_match('/[-\s]/', $b) && str_starts_with($b, $lowerSearch)
                ) ? 1 : (
                    str_starts_with($b, $lowerSearch) ? 2 : (
                    str_contains($b, $lowerSearch) ? 3 : 4
                ));

                if ($pa !== $pb) return $pa <=> $pb;

                $la = mb_strlen($a);
                $lb = mb_strlen($b);
                if ($la !== $lb) return $la <=> $lb;

                return strnatcmp($a, $b);
            });

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
