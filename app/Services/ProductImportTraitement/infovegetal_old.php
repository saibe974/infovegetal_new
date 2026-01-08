<?php
/*----------------------------------*\

	traitement spécifique DB infovegetal_old

\*----------------------------------*/

function importProducts_infovegetal_old($params = array(), $resolve)
{
   $params = array_merge([
       'mapped' => [],
       'defaultsMap' => [],
       'processed' => 0,
       'errors' => 0,
       'reportHandle' => null,
       'updateProgress' => function () {},
       'currentIndex' => 0,
       'validCategoryIds' => [],
	   'defaultsMapCategories' => [],
    ], $params);    

    extract($params);

    $db = $resolve($mapped, $defaultsMap, 'db_products_id');
    $db = $db !== null ? trim((string) $db) : '';
    // if ($db === '13') {
    //     return ['skip' => true];
    // }
   
    // $sku = trim((string) ($resolve($mapped, $defaultsMap, 'sku') ?? ''));
    $ean13 = trim((string) ($resolve($mapped, $defaultsMap, 'ean13') ?? ''));
    $ref = trim((string) ($resolve($mapped, $defaultsMap, 'ref') ?? ''));

    
    if ($ean13 === '' || $ref === '') {
        return ['error' => 'Missing sku', 'row' => $mapped, 'mapped' => $mapped];
    }

    $sku = $ean13 . '_' . $ref;

    $name = trim((string) ($resolve($mapped, $defaultsMap, 'name') ?? ''));
    $name = mb_strtolower($name);
    $name = preg_replace('/\s+/', ' ', $name);

    $description = $resolve($mapped, $defaultsMap, 'description');
    $description = $description !== null ? trim((string) $description) : null;
    $description = mb_strtolower($description);

    $imgLink = $resolve($mapped, $defaultsMap, 'img');
    $imgLink = $imgLink !== null ? trim((string) $imgLink) : null;

    $priceVal = $resolve($mapped, $defaultsMap, 'price');
    $price = (isset($priceVal) && is_numeric($priceVal)) ? (float) $priceVal : 0;

    $activeVal = $resolve($mapped, $defaultsMap, 'active');
    $active = isset($activeVal) ? (int) $activeVal : 1;

    $catVal = $resolve($mapped, $defaultsMap, 'category_products_id');
    $productCategoryId = (isset($catVal) && is_numeric($catVal)) ? (int) $catVal : 51;

    if (!in_array($productCategoryId, $validCategoryIds, true)) {
        $productCategoryId = 51;
    }

    $dbProductId = null;
    $dbInt = is_numeric($db) ? (int) $db : 0;
    switch ($dbInt) {
        case 3: $dbProductId = 5; break;
        case 2: $dbProductId = 4; break;
        case 12: $dbProductId = 3; break;
        case 13: $dbProductId = 3; break;
    }

    $newRow = [
        'sku' => $sku,
        'name' => $name,
        'description' => $description,
        'img_link' => $imgLink !== null ? 'https://www.infovegetal.com/files/' . $imgLink : null,
        'price' => $price,
        'active' => $active,
        'category_products_id' => $productCategoryId,
        'db_products_id' => $dbProductId,
        'ref' => $ref,
        'ean13' => null,
        'pot' => null,
        'height' => null,
        'price_floor' => null,
        'price_roll' => null,
        'producer_id' => null,
        'cond' => null,
        'floor' => null,
        'roll' => null,
    ];
    return $newRow;
}
