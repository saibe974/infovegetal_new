<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\Product;
use App\Models\CategoryProducts;
use App\Models\Tag;

class SearchController extends Controller
{
    public function propositions(Request $request)
    {
        $context = $request->string('context')->toString();
        $q = trim($request->string('q')->toString());
        if (strlen($q) < 2) {
            return response()->json(['propositions' => []]);
        }

        $limit = (int)($request->integer('limit') ?: 10);
        $items = [];

        switch ($context) {
            case 'products':
                $items = Product::query()
                    ->where('name', 'like', "%$q%")
                    ->limit($limit)
                    ->pluck('name')
                    ->all();
                break;
            case 'categories':
                $items = CategoryProducts::query()
                    ->where('name', 'like', "%$q%")
                    ->limit($limit)
                    ->pluck('name')
                    ->all();
                break;
            case 'tags':
                $items = Tag::query()
                    ->where('name', 'like', "%$q%")
                    ->limit($limit)
                    ->pluck('name')
                    ->all();
                break;
            default:
                // fallback: rechercher sur les 3
                $products = Product::query()->where('name', 'like', "%$q%")
                    ->limit($limit)->pluck('name')->all();
                $categories = CategoryProducts::query()->where('name', 'like', "%$q%")
                    ->limit($limit)->pluck('name')->all();
                $tags = Tag::query()->where('name', 'like', "%$q%")
                    ->limit($limit)->pluck('name')->all();
                $items = array_values(array_unique(array_merge($products, $categories, $tags)));
                $items = array_slice($items, 0, $limit);
                break;
        }

        return response()->json(['propositions' => $items]);
    }
}
