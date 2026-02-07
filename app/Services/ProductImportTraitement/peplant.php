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

    // Helpers
    $parsePrice = function ($value) {
        $search = array(',', ' ', '€', "\xc2\xa0");
        $replace = array('.', '', '', '');
        $val = str_replace($search, $replace, (string) ($value ?? ''));
        return (isset($val) && is_numeric($val)) ? (float) $val : null;
    };

    // EMBALLAGE format attendu: "cond*floor*roll" (ex: "4*21*1")
    $parseEmballage = function ($value) {
        if ($value === null) {
            return [null, null, null];
        }
        $raw = trim((string) $value);
        if ($raw === '') {
            return [null, null, null];
        }
        $parts = preg_split('/\*/', $raw);
        $nums = array_map(function ($p) {
            $p = trim($p);
            return ($p !== '' && is_numeric($p)) ? (int) $p : null;
        }, $parts);
        // Normaliser à 3 éléments
        $cond = $nums[2] ?? null;
        $floor = $nums[1] ?? null;
        $roll = $nums[0] ?? null;
        return [$cond, $floor, $roll];
    };

    // Champs de base
    $ean13 = trim((string) ($resolve($mapped, $defaultsMap, 'ean13') ?? ''));
    $ref = trim((string) ($resolve($mapped, $defaultsMap, 'sku') ?? ''));

    if ($ean13 === '' || $ref === '') {
        return ['error' => 'Missing ean13 or ref', 'row' => $mapped];
    }

    $sku = $ean13 . '_' . $ref;

    $name = trim((string) ($resolve($mapped, $defaultsMap, 'name') ?? ''));
    $name = mb_strtolower($name);
    $name = preg_replace('/\s+/', ' ', $name);

  

    $description = $resolve($mapped, $defaultsMap, 'description');
    $description = $description !== null ? trim((string) $description) : null;
    $description = mb_strtolower($description);

    $imgLink = $resolve($mapped, $defaultsMap, 'img_link');
    $imgLink = $imgLink !== null ? trim((string) $imgLink) : null;

    // Catégorie via slug
    $catVal = $resolve($mapped, $defaultsMap, 'category_products_name');
    $slugger = new \Symfony\Component\String\Slugger\AsciiSlugger();
    $catSlug = $slugger->slug((string)$catVal)->lower()->toString();
    $productCategoryId = isset($defaultsMapCategories[$catSlug]) ? (int) $defaultsMapCategories[$catSlug] : 51;
    if (!in_array($productCategoryId, $validCategoryIds, true)) {
        $productCategoryId = 51;
    }

    // Prix
    $price = $parsePrice($resolve($mapped, $defaultsMap, 'price')) ?? 0;
    $priceFloor = $parsePrice($resolve($mapped, $defaultsMap, 'prix_etage'));
    $priceRoll = $parsePrice($resolve($mapped, $defaultsMap, 'prix_roll'));
    $pricePromo = $parsePrice($resolve($mapped, $defaultsMap, 'prix_promo'));

    // Quantités cond/floor/roll depuis EMBALLAGE
    list($cond, $floor, $roll) = $parseEmballage($resolve($mapped, $defaultsMap, 'cond'));

    // Pot
    $potRaw = $resolve($mapped, $defaultsMap, 'pot');
    if ($potRaw !== null) {
        $potStr = str_replace([',', ' '], ['.', ''], (string) $potRaw);
        $pot = is_numeric($potStr) ? (int) round((float) $potStr) : null;
    } else {
        $pot = null;
    }

    // Height
    $height = $resolve($mapped, $defaultsMap, 'haut');
    if ($height === null) {
        $height = $resolve($mapped, $defaultsMap, 'height');
    }
    if ($height !== null) {
        $height = trim((string) $height);
        // Valider le format x ou x-y, sinon nettoyer
        if (!preg_match('/^\d+(-\d+)?$/', $height)) {
            // Essayer d'extraire le format valide
            if (preg_match('/(\d+(?:-\d+)?)/', $height, $m)) {
                $height = $m[1];
            } else {
                $height = null;
            }
        }
    }

    $activeVal = $resolve($mapped, $defaultsMap, 'active');
    $active = isset($activeVal) ? (int) $activeVal : 1;

    $newRow = [
        'sku' => $sku,
        'name' => $name,
        'description' => $description,
        'img_link' => $imgLink,
        'price' => $price,
        'active' => $active,
        'category_products_id' => $productCategoryId,
        'db_products_id' => isset($params['db_products_id']) ? (int)$params['db_products_id'] : null,
        // Nouveaux champs
        'ean13' => $ean13,
        'ref' => $ref,
        'pot' => $pot,
        'height' => $height,
        'price_floor' => $priceFloor,
        'price_roll' => $priceRoll,
        'price_promo' => $pricePromo,
        'cond' => $cond,
        'floor' => $floor,
        'roll' => $roll,
    ];
    return $newRow;
}
