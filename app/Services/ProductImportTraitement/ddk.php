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

    // Helpers de parsing
    $parsePrice = function ($value) {
        if ($value === null) {
            return null;
        }
        $search = array(',', ' ', '€', "\xc2\xa0");
        $replace = array('.', '', '', '');
        $val = str_replace($search, $replace, (string) $value);
        return is_numeric($val) ? (float) $val : null;
    };

    $parseQuantity = function ($value) {
        if ($value === null) {
            return null;
        }
        if (is_numeric($value)) {
            return (int) $value;
        }
        $val = (string) $value;
        // Format "X x Y" : extraction simple du nombre
        $numbers = [];
        preg_match_all('/\d+/', $val, $numbers);
        if (empty($numbers[0])) {
            return null;
        }
        // Retourner le premier nombre trouvé
        return (int) $numbers[0][0];
    };

    // Pour cond (qte-plaque = "1 x 18"): prendre le 2e nombre (18)
    $parseCondition = function ($value) {
        if ($value === null) {
            return null;
        }
        if (is_numeric($value)) {
            return (int) $value;
        }
        $val = (string) $value;
        $numbers = [];
        preg_match_all('/\d+/', $val, $numbers);
        if (count($numbers[0]) < 2) {
            // Si pas de format "X x Y", retourner le 1er nombre
            return !empty($numbers[0]) ? (int) $numbers[0][0] : null;
        }
        // Retourner le 2e nombre
        return (int) $numbers[0][1];
    };

    // Pour floor et roll (qte-etage = "5 x 18", qte-cc = "55 x 18"): prendre le 1er nombre
    $parseFirstNumber = function ($value) {
        if ($value === null) {
            return null;
        }
        if (is_numeric($value)) {
            return (int) $value;
        }
        $val = (string) $value;
        $numbers = [];
        preg_match_all('/\d+/', $val, $numbers);
        return !empty($numbers[0]) ? (int) $numbers[0][0] : null;
    };

    // Récupérer code et producteur depuis le CSV
    $ean13 = trim((string) ($resolve($mapped, $defaultsMap, 'ean13') ?? ''));
    $ref = trim((string) ($resolve($mapped, $defaultsMap, 'sku') ?? ''));
    $producteur = trim((string) ($resolve($mapped, $defaultsMap, 'producteur_name') ?? ''));

    if ($ean13 === '' || $ref === '') {
        return ['error' => 'Missing ean13 or ref', 'row' => $mapped];
    }

    // Construire le SKU au format : ean13_ref
    $skuParts = [];

    if ($ean13 !== '') {
        $skuParts[] = $ean13;
    }

    if ($ref !== '') {
        $skuParts[] = $ref;
    }

    $sku = implode('_', $skuParts);

    // Traiter la description pour extraire le nom latin
    $description = trim((string) ($resolve($mapped, $defaultsMap, 'description') ?? ''));
    $description = mb_strtolower($description);
    
    // Extraire le nom latin à partir de la description (comme format_rem de l'ancien système)
    $name = $description;
    if ($description !== '') {
        $parts = explode(' ', $description);
        $firstPart = explode('.', $parts[0]);
        $latin = trim($firstPart[0]);
        
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

   

    $imgLink = $resolve($mapped, $defaultsMap, 'img_link');
    $imgLink = $imgLink !== null ? trim((string) $imgLink) : null;

    // Récupérer les champs DDK spécifiques
    $pot = $resolve($mapped, $defaultsMap, 'pot');
    $pot = $pot !== null ? (is_numeric($pot) ? (int) $pot : null) : null;
    
    $height = $resolve($mapped, $defaultsMap, 'height');
    if ($height !== null) {
        $height = trim((string) $height);
        // Normaliser : extraire le format x ou x-y
        if (is_numeric($height)) {
            $height = (string) (int) $height;
        } elseif (preg_match('/(\\d+(?:-\\d+)?)/', $height, $m)) {
            $height = $m[1];
        } else {
            $height = null;
        }
    }
    
    // Parsing spécifique pour cond/floor/roll
    // cond (qte-plaque = "1 x 18"): nombre de produits par carton → 18 (2e nombre)
    // floor (qte-etage = "5 x 18"): nombre de cartons par étage → 5 (1er nombre)
    // roll (qte-cc = "55 x 18"): nombre total de cartons par roll → 55 (1er nombre)
    //   calculé comme: roll_total_cartons / floor_cartons = 55 / 5 = 11 étages par roll
    $condRaw = $resolve($mapped, $defaultsMap, 'cond');
    $floorRaw = $resolve($mapped, $defaultsMap, 'floor');
    $rollRaw = $resolve($mapped, $defaultsMap, 'roll');
    
    $cond = $parseCondition($condRaw);  // Prendre le 2e nombre pour "1 x 18" → 18
    $floorValue = $parseFirstNumber($floorRaw); // Prendre le 1er nombre pour "5 x 18" → 5
    $rollTotalCartons = $parseFirstNumber($rollRaw); // Prendre le 1er nombre pour "55 x 18" → 55
    
    // roll = nombre total de cartons par roll / nombre de cartons par étage
    $roll = ($floorValue && $rollTotalCartons) ? (int) ($rollTotalCartons / $floorValue) : null;
    $floor = $floorValue;

    $price = $parsePrice($resolve($mapped, $defaultsMap, 'price')) ?? 0;
    $priceFloor = $parsePrice($resolve($mapped, $defaultsMap, 'price_floor'));
    $priceRoll = $parsePrice($resolve($mapped, $defaultsMap, 'price_roll'));
    $pricePromo = $parsePrice($resolve($mapped, $defaultsMap, 'price_promo'));

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

    // Récupérer et traiter le producteur
    $producerId = null;
    if ($producteur !== '') {
        // Chercher ou créer le producteur
        try {
            $producerModel = \App\Models\Producer::firstOrCreate(
                ['name' => $producteur],
                ['name' => $producteur]
            );
            $producerId = $producerModel->id;
        } catch (\Throwable $e) {
            // Si la table n'existe pas encore, laisser null
        }
    }

    // Traiter le conditionnement : stocker directement les valeurs dans products
    // Plus besoin de créer un modèle Conditionnement externe

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
        'cond' => $cond,
        'floor' => $floor,
        'roll' => $roll,
    ];

    return $newRow;
}
