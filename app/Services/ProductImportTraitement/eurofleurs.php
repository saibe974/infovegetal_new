<?php
/*----------------------------------*\

	traitement spécifique DB eurofleurs

\*----------------------------------*/

use Symfony\Component\String\Slugger\SluggerInterface;

function importProducts_eurofleurs($params = array(), $resolve)
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

    // Concaténer ean et identifiant mappé (sku) pour le SKU
    // Remarque: le CSV Eurofleurs a une colonne "id" (pas "ref").
    // On utilise d'abord la clé logique 'sku' (qui doit être mappée vers 'id' ou 'ref' dans DbProducts->champs),
    // puis on retombe sur 'ref' ou 'id' si nécessaire.
    $ean = trim((string) ($resolve($mapped, $defaultsMap, 'ean') ?? ''));
    $base = trim((string) (
        $resolve($mapped, $defaultsMap, 'sku')
        ?? $resolve($mapped, $defaultsMap, 'ref')
        ?? $resolve($mapped, $defaultsMap, 'id')
        ?? ''
    ));
    $sku = ($ean !== '' && $ean !== '-')
        ? ($base !== '' ? ($ean . '_' . $base) : $ean)
        : $base;
    
    $name = trim((string) ($resolve($mapped, $defaultsMap, 'name') ?? ''));

    if ($sku === '' || $name === '') {
        return ['error' => 'Missing sku or name', 'row' => $mapped];
    }

    $description = $resolve($mapped, $defaultsMap, 'description');
    $description = $description !== null ? trim((string) $description) : null;

    $imgLink = $resolve($mapped, $defaultsMap, 'img_link');
    $imgLink = $imgLink !== null ? trim((string) $imgLink) : null;

    $priceVal = $resolve($mapped, $defaultsMap, 'price');
    $price = (isset($priceVal) && is_numeric($priceVal)) ? (float) $priceVal : 0;

    $activeVal = $resolve($mapped, $defaultsMap, 'active');
    $active = isset($activeVal) ? (int) $activeVal : 1;

    // Résoudre la catégorie via slug dans defaultsMapCategories
    $catVal = $resolve($mapped, $defaultsMap, 'product_category_name');
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
    ];
    return $newRow;
}

