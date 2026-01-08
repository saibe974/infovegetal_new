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

    // Helpers
    $parsePrice = function ($value) {
        $search = array(',', ' ', '€', "\xc2\xa0");
        $replace = array('.', '', '', '');
        $val = str_replace($search, $replace, (string) ($value ?? ''));
        return (isset($val) && is_numeric($val)) ? (float) $val : null;
    };

    // EAN13 (générer si manquant)
    $ean13 = trim((string) ($resolve($mapped, $defaultsMap, 'ean13') ?? ''));
    if ($ean13 === '' || $ean13 === '-') {
        $idVal = $resolve($mapped, $defaultsMap, 'id');
        if ($idVal !== null) {
            $generatedEan = generateEAN13FromId($idVal);
            if ($generatedEan !== null) {
                $ean13 = $generatedEan;
            }
        }
    }

    // ref (depuis id)
    $ref = trim((string) ($resolve($mapped, $defaultsMap, 'sku') ?? ''));

    // SKU = ean13_ref
    if ($ean13 === '' || $ref === '') {
        return ['error' => 'Missing ean13 or ref', 'row' => $mapped];
    }
    $sku = $ean13 . '_' . $ref;

    // Texte
    $name = trim((string) ($resolve($mapped, $defaultsMap, 'name') ?? ''));
    $name = mb_strtolower($name);

    $description = $resolve($mapped, $defaultsMap, 'description');
    $description = $description !== null ? trim((string) $description) : null;
    $description = $description !== null ? mb_strtolower($description) : null;

    // Média
    $imgLink = $resolve($mapped, $defaultsMap, 'img_link');
    $imgLink = $imgLink !== null ? trim((string) $imgLink) : null;

    // Catégorie
    $catVal = $resolve($mapped, $defaultsMap, 'category_products_name');
    $slugger = new \Symfony\Component\String\Slugger\AsciiSlugger();
    $catSlug = $slugger->slug((string)$catVal)->lower()->toString();
    $productCategoryId = isset($defaultsMapCategories[$catSlug]) ? (int) $defaultsMapCategories[$catSlug] : 51;
    if (!in_array($productCategoryId, $validCategoryIds, true)) {
        $productCategoryId = 51;
    }

    // Prix
    $price = $parsePrice($resolve($mapped, $defaultsMap, 'price')) ?? 0;            // prix_plaque
    $priceFloor = $parsePrice($resolve($mapped, $defaultsMap, 'price_floor'));     // prix_etage
    $priceRoll = $parsePrice($resolve($mapped, $defaultsMap, 'price_roll'));       // prix_cc
    $pricePromo = $parsePrice($resolve($mapped, $defaultsMap, 'price_promo'));

    // Quantités
    $cond = $resolve($mapped, $defaultsMap, 'cond');   // pcs_pal
    $cond = ($cond !== null && $cond !== '' && is_numeric($cond)) ? (int) $cond : null;
    $floor = $resolve($mapped, $defaultsMap, 'floor'); // pal_par_etage
    $floor = ($floor !== null && $floor !== '' && is_numeric($floor)) ? (int) $floor : null;
    $roll = $resolve($mapped, $defaultsMap, 'roll');   // pal_par_cc
    $roll = ($roll !== null && $roll !== '' && is_numeric($roll)) ? (int) $roll : null;

    // Autres champs
    $potRaw = $resolve($mapped, $defaultsMap, 'pot');
    if ($potRaw !== null) {
        $potStr = str_replace([',', ' '], ['.', ''], (string) $potRaw);
        $pot = is_numeric($potStr) ? (int) round((float) $potStr) : null;
    } else {
        $pot = null;
    }
    $height = $resolve($mapped, $defaultsMap, 'height');
    $height = $height !== null ? trim((string) $height) : null;

    $producerId = $resolve($mapped, $defaultsMap, 'producer_id');
    $producerId = ($producerId !== null && is_numeric($producerId)) ? (int) $producerId : null;
    $tvaId = $resolve($mapped, $defaultsMap, 'tva_id');
    $tvaId = ($tvaId !== null && is_numeric($tvaId)) ? (int) $tvaId : null;

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
        'ref' => $ref,
        'ean13' => $ean13,
        'pot' => $pot,
        'height' => $height,
        'price_floor' => $priceFloor,
        'price_roll' => $priceRoll,
        'price_promo' => $pricePromo,
        'producer_id' => $producerId,
        'tva_id' => $tvaId,
        'cond' => $cond,
        'floor' => $floor,
        'roll' => $roll,
    ];
    return $newRow;
}

/**
 * Génère un EAN-13 basé sur l'ID produit.
 * Format : 40 00627 + ID (complété à 5 chiffres) + clé de contrôle
 *
 * @param string|int $id
 * @return string|null  EAN complet ou null si ID invalide
 */
function generateEAN13FromId($id): ?string
{
    // Convertir en string et nettoyer
    $id = trim((string) $id);

    // ID doit être numérique
    if ($id === '' || !ctype_digit($id)) {
        return null;
    }

    // Compléter à 5 chiffres (zéros à gauche)
    $idPadded = str_pad($id, 5, '0', STR_PAD_LEFT);

    // 12 premiers chiffres
    $ean12 = '40' . '00627' . $idPadded; // 40 00627 XXXXX

    // Calcul de la clé de contrôle EAN-13
    $sum = 0;
    for ($i = 0; $i < 12; $i++) {
        $digit = (int) $ean12[$i];
        // positions impaires (index 0,2,4,...) poids 1
        // positions paires (index 1,3,5,...) poids 3
        $sum += ($i % 2 === 0) ? $digit : $digit * 3;
    }

    $check = (10 - ($sum % 10)) % 10;

    return $ean12 . $check;
}
