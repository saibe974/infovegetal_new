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
   
    $sku = trim((string) ($resolve($mapped, $defaultsMap, 'sku') ?? ''));
    $name = trim((string) ($resolve($mapped, $defaultsMap, 'name') ?? ''));
    
    if ($sku === '' || $name === '') {
        return ['error' => 'Missing sku or name', 'row' => $row, 'mapped' => $mapped];
    }

    $description = $resolve($mapped, $defaultsMap, 'description');
    $description = $description !== null ? trim((string) $description) : null;

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

    $newRow = [
        'sku' => $sku,
        'name' => $name,
        'description' => $description,
        'img_link' => $imgLink !== null ? 'https://www.infovegetal.com/files/' . $imgLink : null,
        'price' => $price,
        'active' => $active,
        'category_products_id' => $productCategoryId,
		
    ];
    return $newRow;
}
