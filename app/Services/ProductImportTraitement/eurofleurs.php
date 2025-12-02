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

    // Récupérer EAN depuis le CSV (s'il existe dans le mapping)
    $ean = trim((string) ($resolve($mapped, $defaultsMap, 'ean') ?? ''));

    // Si l'EAN est absent ou égal à '-', on le génère à partir de l'id
    if ($ean === '' || $ean === '-') {
        $idVal = $resolve($mapped, $defaultsMap, 'id');
        if ($idVal !== null) {
            $generatedEan = generateEAN13FromId($idVal);
            if ($generatedEan !== null) {
                $ean = $generatedEan;
            }
        }
    }

    // Récupérer la "ref" logique (dans ton defaultsMap: "ref" => "id")
    $ref = trim((string) ($resolve($mapped, $defaultsMap, 'ref') ?? ''));

    // Construire le SKU au format : ean_ref_21000
    // - si pas d'EAN ou pas de ref, on évite de mettre des "__"
    $skuParts = [];

    if ($ean !== '' && $ean !== '-') {
        $skuParts[] = $ean;
    }

    if ($ref !== '') {
        $skuParts[] = $ref;
    }

    $skuParts[] = '21000';

    $sku = implode('_', $skuParts);

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
