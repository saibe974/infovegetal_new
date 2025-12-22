<?php
/*----------------------------------*\

	traitement spécifique DB peplant

\*----------------------------------*/

use Symfony\Component\String\Slugger\SluggerInterface;

function importProducts_peplant($params = array(), $resolve)
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

    // Récupérer barcode, ref et leverancier depuis le CSV
    // Note: barcode est mappé vers 'sku' pour le split, donc on accède directement à $mapped['barcode']
    $barcode = trim((string) ($mapped['barcode'] ?? ''));
    $ref = trim((string) ($resolve($mapped, $defaultsMap, 'ref_peplant') ?? ''));
    $leverancier = trim((string) ($resolve($mapped, $defaultsMap, 'leverancier_peplant') ?? '1000'));

    // Construire le SKU au format : barcode_ref_leverancier
    $skuParts = [];

    if ($barcode !== '') {
        $skuParts[] = $barcode;
    }

    if ($ref !== '') {
        $skuParts[] = $ref;
    }

    if ($leverancier !== '') {
        $skuParts[] = $leverancier;
    }

    $sku = implode('_', $skuParts);

    $name = trim((string) ($resolve($mapped, $defaultsMap, 'name') ?? ''));
    $name = mb_strtolower($name); // Convertir en minuscules
    $name = preg_replace('/\s+/', ' ', $name); // Nettoyer les espaces multiples

    if ($sku === '' || $name === '') {
        return ['error' => 'Missing sku or name', 'row' => $mapped];
    }

    $description = $resolve($mapped, $defaultsMap, 'description');
    $description = $description !== null ? trim((string) $description) : null;

    $imgLink = $resolve($mapped, $defaultsMap, 'img_link');
    $imgLink = $imgLink !== null ? trim((string) $imgLink) : null;

    $priceVal = $resolve($mapped, $defaultsMap, 'price');
    $search = array(',', ' ', '€', "\xc2\xa0");
    $replace = array('.', '', '', '');
    $priceVal = str_replace($search, $replace, (string) $priceVal);
    $price = (isset($priceVal) && is_numeric($priceVal)) ? (float) $priceVal : 0;

    $activeVal = $resolve($mapped, $defaultsMap, 'active');
    $active = isset($activeVal) ? (int) $activeVal : 1;

    // Résoudre la catégorie via slug dans defaultsMapCategories
    $catVal = $resolve($mapped, $defaultsMap, 'category_products_name');
    $slugger = new \Symfony\Component\String\Slugger\AsciiSlugger();
    $catSlug = $slugger->slug((string)$catVal)->lower()->toString();
    $productCategoryId = isset($defaultsMapCategories[$catSlug]) ? (int) $defaultsMapCategories[$catSlug] : 51;

    if (!in_array($productCategoryId, $validCategoryIds, true)) {
        $productCategoryId = 51;
    }

    $newRow = [
        'sku' => $sku,
        'name' => $name,
        'description' => $description,
        'img_link' => $imgLink,
        'price' => $price,
        'active' => $active,
        'category_products_id' => $productCategoryId,
        'db_products_id' => 22, // peplant
    ];
    return $newRow;
}
