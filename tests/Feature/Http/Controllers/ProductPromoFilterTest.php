<?php

use App\Models\Product;
use App\Services\ProductCatalogQuery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

it('cycles between all products, promotions and products without promotions', function (): void {
    // A separate table isolates the predicate from catalogue visibility and pricing scopes.
    DB::statement('CREATE TEMPORARY TABLE promo_filter_cases (id INTEGER PRIMARY KEY, price_promo DECIMAL NULL, price_roll DECIMAL NULL)');

    try {
        DB::table('promo_filter_cases')->insert([
            ['id' => 1, 'price_promo' => 5, 'price_roll' => 10],
            ['id' => 2, 'price_promo' => 5, 'price_roll' => null],
            ['id' => 3, 'price_promo' => null, 'price_roll' => 10],
            ['id' => 4, 'price_promo' => 0, 'price_roll' => 10],
            ['id' => 5, 'price_promo' => 10, 'price_roll' => 10],
            ['id' => 6, 'price_promo' => null, 'price_roll' => null],
        ]);

        foreach ([
            [[], null, [1, 2, 3, 4, 5, 6]],
            [['promo' => '1'], true, [1, 2]],
            [['promo' => '0'], false, [3, 4, 5, 6]],
        ] as [$params, $expectedFilter, $expectedIds]) {
            $catalog = new ProductCatalogQuery(Request::create('/products', 'GET', $params));
            $query = Product::query()->from('promo_filter_cases');
            $catalog->applyFilters($query, $catalog->filters);

            expect($catalog->filters['promo'])->toBe($expectedFilter)
                ->and($query->orderBy('id')->pluck('id')->all())->toBe($expectedIds);
        }
    } finally {
        DB::statement('DROP TABLE promo_filter_cases');
    }
});
