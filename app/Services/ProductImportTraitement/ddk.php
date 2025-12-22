<?php
/*----------------------------------*\

	traitement spécifique DB DDK

\*----------------------------------*/

use Symfony\Component\String\Slugger\SluggerInterface;

function importProducts_ddk($params = array(), $resolve)
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

    // Récupérer code et producteur depuis le CSV
    $barcode = trim((string) ($mapped['codebarre'] ?? ''));
    $code = trim((string) ($resolve($mapped, $defaultsMap, 'ref') ?? ''));
    $producteur = trim((string) ($resolve($mapped, $defaultsMap, 'producteur') ?? ''));

    // Construire le SKU au format : code_producteur
    $skuParts = [];

    if ($barcode !== '') {
        $skuParts[] = $barcode;
    }

    if ($code !== '') {
        $skuParts[] = $code;
    }

    if ($producteur !== '') {
        $skuParts[] = $producteur;
    }

    $sku = implode('_', $skuParts);

    // Traiter la description pour extraire le nom latin
    $description = trim((string) ($resolve($mapped, $defaultsMap, 'description') ?? ''));
    
    // Extraire le nom latin à partir de la description (comme format_rem de l'ancien système)
    $name = $description;
    if ($description !== '') {
        $parts = explode(' ', $description);
        $firstPart = explode('.', $parts[0]);
        $latin = strtolower(trim($firstPart[0]));
        
        // Gestion des cas spéciaux et abréviations
        if ($latin == 'arr' || $latin == 'arrangement') {
            $latin = 'compo-arrangements';
        }
        
        $abbreviations = [
            'anth' => 'anthurium',
            'chrys' => 'chrysanthemum',
            'hydr' => 'hydrangea',
            'spath' => 'spatiphyllium',
            'hyac' => 'hyacinthus',
            'phal' => 'phalaenopsis',
            'lys' => 'lilium',
            'kalan' => 'kalanchoe',
            'drac' => 'dracaena',
            'orchidee' => 'orchidée',
            'brom' => 'bromeliacea',
            'strel' => 'strelitzia',
        ];
        
        if (isset($abbreviations[$latin])) {
            $latin = $abbreviations[$latin];
        }
        
        $name = trim($latin);
    }

    if ($sku === '' || $name === '') {
        return ['error' => 'Missing sku or name', 'row' => $mapped];
    }

    $imgLink = $resolve($mapped, $defaultsMap, 'img_link');
    $imgLink = $imgLink !== null ? trim((string) $imgLink) : null;

    // Récupérer les champs DDK spécifiques
    $pot = $resolve($mapped, $defaultsMap, 'pot');
    $hauteur = $resolve($mapped, $defaultsMap, 'hauteur');
    $qte_plaque = $resolve($mapped, $defaultsMap, 'qte_plaque');
    $qte_etage = $resolve($mapped, $defaultsMap, 'qte_etage');
    $qte_cc = $resolve($mapped, $defaultsMap, 'qte_cc');

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
        'db_products_id' => 23, // ddk
    ];
    return $newRow;
}
