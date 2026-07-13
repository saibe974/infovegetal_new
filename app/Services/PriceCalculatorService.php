<?php

namespace App\Services;

use App\Domain\Sales\DTO\ActorChain;
use App\Domain\Sales\DTO\LineCalculationInput;
use App\Domain\Sales\DTO\ProductPriceReference;
use App\Domain\Sales\DTO\ProductTaxContext;
use App\Domain\Sales\DTO\ResolvedConditionCollection;
use App\Domain\Sales\Enums\PriceSourceType;
use App\Domain\Sales\Enums\SalesMode;
use App\Domain\Sales\Services\ProductSalesPriceCalculator;
use App\Domain\Sales\ValueObjects\Currency;
use App\Domain\Sales\ValueObjects\Money;
use App\Domain\Sales\ValueObjects\Percentage;
use App\Domain\Sales\ValueObjects\Quantity;
use App\Models\User;
use App\Models\Product;
use Illuminate\Support\Collection;

class PriceCalculatorService
{
    /**
     * Calcule les prix pour un produit selon les paramètres utilisateur.
     * 
     * @param Product $product Le produit
     * @param User $user L'utilisateur
     * @param int $dbProductId L'ID du db_product
     * @return array [price, price_floor, price_roll, price_promo]
     */
    public function calculatePrice(Product $product, User $user, int $dbProductId): array
    {
        // Récupérer les attributs de l'utilisateur pour ce db_product
        $userAttributes = $this->getUserAttributes($user, $dbProductId);
        
        if (!$userAttributes) {
            // Pas d'attributs = retourner les prix de base
            return $this->roundPrices($this->ensureFallbackPrices(
                $this->resolveTargetStandardPrices($product)
            ));
        }

        // Si c'est le produit de l'utilisateur lui-même
        if (isset($product->user_id) && $product->user_id == $user->id) {
            return $this->roundPrices($this->ensureFallbackPrices(
                $this->resolveTargetStandardPrices($product)
            ));
        }

        // Prix spéciaux fixes (si p n'est pas -1, 0 ou 1)
            $priceMode = $this->normalizePriceMode($userAttributes['p'] ?? -1);
        if ($priceMode != -1 && $priceMode != 0 && $priceMode != 1) {
            $specialPrice = $this->getSpecialPrice($product, $priceMode);
            return $this->roundPrices([
                $specialPrice,
                $specialPrice,
                $specialPrice,
                0,
            ]);
        }

        // Calculer les prix de base en remontant la hiérarchie
        $basePrices = $this->calculateBasePrices($product, $user, $dbProductId);

        // Appliquer les marges et ajustements
        return $this->applyMargins($basePrices, $product, $userAttributes);
    }

    /**
     * Récupère les attributs de l'utilisateur pour un db_product.
     */
    protected function getUserAttributes(User $user, int $dbProductId): ?array
    {
        $dbProduct = $user->dbProducts()->where('db_product_id', $dbProductId)->first();
        
        if (!$dbProduct || !$dbProduct->pivot->attributes) {
            return null;
        }

        $attributes = is_string($dbProduct->pivot->attributes) 
            ? json_decode($dbProduct->pivot->attributes, true) 
            : $dbProduct->pivot->attributes;

        return is_array($attributes) ? $attributes : null;
    }

    /**
     * Récupère un prix spécial depuis le produit.
     */
    protected function getSpecialPrice(Product $product, string $priceField): float
    {
        // Le champ peut être un nom de colonne comme 'price_special_1', etc.
        return $product->{$priceField} ?? $product->price ?? 0;
    }

    /**
     * Calcule les prix de base en remontant la hiérarchie des utilisateurs.
     */
    protected function calculateBasePrices(Product $product, User $user, int $dbProductId): array
    {
        // Récupérer les ancêtres (parents) de l'utilisateur
        $ancestors = $user->ancestors()->get();
        $currentPrices = $this->resolveTargetStandardPrices($product);

        if ($ancestors->isEmpty()) {
            // Pas de parents = prix de base deja resolu
            return $currentPrices;
        }

        // Inverser pour partir de la racine
        $ancestors = $ancestors->reverse();

        foreach ($ancestors as $parent) {
            // Si c'est l'utilisateur root (id=1), garder les prix de base
            if ($parent->id == 1) {
                continue;
            }

            $parentAttributes = $this->getUserAttributes($parent, $dbProductId);
            
            if ($parentAttributes) {
                // Créer un produit temporaire avec les prix actuels
                $tempProduct = clone $product;
                $tempProduct->price = $currentPrices[0];
                $tempProduct->price_floor = $currentPrices[1];
                $tempProduct->price_roll = $currentPrices[2];
                $tempProduct->price_promo = $currentPrices[3];

                // Appliquer les marges du parent
                $currentPrices = $this->applyMargins($currentPrices, $tempProduct, $parentAttributes);
            }
        }

        return $currentPrices;
    }

    /**
     * Applique les marges et ajustements aux prix.
     */
    protected function applyMargins(array $prices, Product $product, array $attributes): array
    {
        // Extraire les paramètres
        $marge = $attributes['m'] ?? 0;           // marge en %
        $margeMin = $attributes['mm'] ?? 0;       // marge min par roll
        $ponderation = $attributes['pd'] ?? 0;    // coefficient de pondération
        $livraison = $attributes['l'] ?? 0;       // livraison
            $priceMode = $this->normalizePriceMode($attributes['p'] ?? -1); // 0=depart, 1=rendu
        
        // Marges par quantité
        $margeCarton = $attributes['mc'] ?? 0;    // marge par carton
        $margeEtage = $attributes['me'] ?? 0;     // marge par étage
        $margeRoll = $attributes['mr'] ?? 0;      // marge par roll

        $mpq = [
            $margeCarton,
            $margeEtage,
            $margeRoll,
            $margeRoll,
        ];

        // Calculer le nombre de produits par roll
        $pdtRoll = ($product->cond ?? 1) * ($product->floor ?? 1) * ($product->roll ?? 1);
        
        // Marge minimum par roll répartie
        $mmpr = $pdtRoll > 0 ? $margeMin / $pdtRoll : 0;
        
        // Livraison répartie
        $ml = $pdtRoll > 0 ? $livraison / $pdtRoll : 0;

        $result = [];

        foreach ($prices as $k => $price) {
            if ($price == 0) {
                $result[$k] = 0;
                continue;
            }

            // Ajouter marge par quantité (max entre mmpr et marge en %)
            $adjustedPrice = $price + max($mmpr, $mpq[$k] * $price / 100);

            // Ajouter livraison si prix rendu
            if ($priceMode == 1 && $livraison != 0) {
                $adjustedPrice += $ml;
            }

            // Appliquer pondération
            if ($ponderation != 0) {
                $adjustedPrice = $adjustedPrice / ((100 - $ponderation) / 100);
            }

            // Appliquer marge finale
            $adjustedPrice += $marge * $price / 100;

            $result[$k] = $adjustedPrice;
        }

        // Garantir 3 prix non nuls (carton, etage, roll)
        return $this->roundPrices($this->ensureFallbackPrices($result));
    }

    /**
     * Garantit un prix standard positif quand les prix de base sont absents.
     */
    protected function ensureFallbackPrices(array $prices): array
    {
        $fallback = 0.0;

        foreach ([$prices[0] ?? 0, $prices[1] ?? 0, $prices[2] ?? 0] as $candidate) {
            if ($candidate > 0) {
                $fallback = (float) $candidate;
                break;
            }
        }

        if ($fallback <= 0) {
            $fallback = 0.01;
        }

        if (($prices[0] ?? 0) <= 0) {
            $prices[0] = $fallback;
        }
        if (($prices[1] ?? 0) <= 0) {
            $prices[1] = $fallback;
        }
        if (($prices[2] ?? 0) <= 0) {
            $prices[2] = $fallback;
        }
        if (!array_key_exists(3, $prices)) {
            $prices[3] = 0;
        }

        return $prices;
    }

    /**
     * @return array{0: float|int, 1: float|int, 2: float|int, 3: float|int}
     */
    private function resolveTargetStandardPrices(Product $product): array
    {
        $legacyPrices = [
            (float) ($product->price ?? 0),
            (float) ($product->price_floor ?? 0),
            (float) ($product->price_roll ?? 0),
            (float) ($product->price_promo ?? 0),
        ];

        if (($product->price ?? 0) <= 0) {
            return $legacyPrices;
        }

        try {
            $targetPrice = $this->calculateTargetStandardPrice($product);
            if ($targetPrice > 0) {
                $legacyPrices[0] = $targetPrice;
            }
        } catch (\Throwable) {
            // Legacy fallback retained for compatibility while BR-001 is rolled out.
        }

        return $legacyPrices;
    }

    private function calculateTargetStandardPrice(Product $product): float
    {
        $calculator = new ProductSalesPriceCalculator();
        $priceMinor = (int) round(((float) ($product->price ?? 0)) * 100);

        $result = $calculator->calculate(new LineCalculationInput(
            lineId: (int) ($product->id ?? 1),
            priceReference: new ProductPriceReference(
                productId: (int) ($product->id ?? 1),
                dbProductId: (int) ($product->db_products_id ?? 0),
                priceSource: PriceSourceType::Standard,
                baseUnitPriceHt: new Money($priceMinor, Currency::EUR),
                weightingPercent: null,
            ),
            quantity: Quantity::fromInt(1),
            actorChain: new ActorChain(0, 0, null),
            conditions: new ResolvedConditionCollection([]),
            taxContext: new ProductTaxContext(Percentage::fromString('0')),
            salesMode: SalesMode::Depart,
        ));

        return ((float) $result->product->finalLineHt->minorAmount) / 100.0;
    }

        /**
         * Normalise les modes de prix (legacy numerique et alias explicites).
         */
        protected function normalizePriceMode(mixed $value)
        {
            if ($value === null || $value === '') {
                return 0; // Par défaut, considérer comme "price_depart"
            }

            if (is_int($value) || is_float($value)) {
                $intValue = (int) $value;
                return in_array($intValue, [-1, 0, 1], true) ? $intValue : (string) $value;
            }

            $raw = strtolower(trim((string) $value));

            if ($raw === 'price_depart' || $raw === 'depart' || $raw === 'departure') {
                return 0;
            }

            if (
                $raw === 'price_render'
                || $raw === 'price_rendu'
                || $raw === 'render'
                || $raw === 'rendered'
                || $raw === 'rendu'
            ) {
                return 1;
            }

            if ($raw === '-1' || $raw === '0' || $raw === '1') {
                return (int) $raw;
            }

            return (string) $value;
        }
    /**
     * Arrondit les prix à 2 décimales.
     */
    protected function roundPrices(array $prices): array
    {
        return array_map(function ($price) {
            return round($price * 100) / 100;
        }, $prices);
    }

    /**
     * Calcule les prix pour une collection de produits de manière optimisée.
     * 
     * @param Collection $products Collection de produits
     * @param User $user L'utilisateur
     * @return Collection Produits avec prix calculés
     */
    public function calculatePricesForCollection(Collection $products, User $user): Collection
    {
        // Précharger les attributs de l'utilisateur pour tous les db_products
        $userDbProducts = $user->dbProducts()->get();
        $attributesByDbId = [];
        
        foreach ($userDbProducts as $dbProduct) {
            $attributes = $dbProduct->pivot->attributes;
            if ($attributes) {
                $attrs = is_string($attributes) ? json_decode($attributes, true) : $attributes;
                if (is_array($attrs)) {
                    $attributesByDbId[$dbProduct->id] = $attrs;
                }
            }
        }

        // Précharger les ancêtres une seule fois
        $ancestors = $user->ancestors()->get();

        // Calculer les prix pour chaque produit
        return $products->map(function ($product) use ($user, $attributesByDbId, $ancestors) {
            $dbId = $product->db_products_id;
            
            if ($dbId && isset($attributesByDbId[$dbId])) {
                $prices = $this->calculatePrice($product, $user, $dbId);
                
                // Mettre à jour le prix principal du produit
                $product->price = $prices[0];
                $product->price_floor = $prices[1];
                $product->price_roll = $prices[2];
                $product->price_promo = $prices[3];
            }
            
            return $product;
        });
    }
}
