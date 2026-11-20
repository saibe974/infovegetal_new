<?php

use App\Models\Product;
use App\Services\ProductCatalogQuery;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

it('normalizes the requested initial', function (mixed $input, ?string $expected): void {
    expect(ProductCatalogQuery::normalizeLetter($input))->toBe($expected);
})->with([
    ['a', 'A'],
    ['Z', 'Z'],
    ['é', 'E'],
    ['#', '#'],
    ['3', '#'],
    ['', null],
    ['ab', null],
    [null, null],
    [['a'], null],
]);

it('filters products by initial and lists the available initials', function (): void {
    // A separate table isolates the predicate from catalogue visibility and pricing scopes.
    DB::statement('CREATE TEMPORARY TABLE letter_filter_cases (id INTEGER PRIMARY KEY, name VARCHAR(255) NULL)');

    try {
        DB::table('letter_filter_cases')->insert([
            ['id' => 1, 'name' => 'Abelia'],
            ['id' => 2, 'name' => 'acer'],
            ['id' => 3, 'name' => 'Buxus'],
            ['id' => 4, 'name' => '3 plants mix'],
            ['id' => 5, 'name' => 'Érable'],
        ]);

        $base = fn () => Product::query()->from('letter_filter_cases as products');

        foreach ([
            [['letter' => 'a'], [1, 2]],
            [['letter' => 'B'], [3]],
            [['letter' => '#'], DB::connection()->getDriverName() === 'sqlite' ? [4, 5] : [4]],
            [[], [1, 2, 3, 4, 5]],
        ] as [$params, $expectedIds]) {
            $catalog = new ProductCatalogQuery(Request::create('/products', 'GET', $params));
            $query = $base();
            $catalog->applyFilters($query, $catalog->filters);

            expect($query->orderBy('id')->pluck('id')->all())->toBe($expectedIds);
        }

        $catalog = new ProductCatalogQuery(Request::create('/products', 'GET', ['letter' => 'B']));
        $options = ProductCatalogQuery::letterOptions($base(), $catalog->filters, $catalog->applyFilters(...));

        expect($options)->toBe(['A', 'B', 'E', '#']);
    } finally {
        DB::statement('DROP TABLE letter_filter_cases');
    }
});
