<?php

namespace App\Services;

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
            return $this->roundPrices([
                $product->price ?? 0,
                $product->price_floor ?? 0,
                $product->price_roll ?? 0,
                $product->price_promo ?? 0,
            ]);
        }

        // Si c'est le produit de l'utilisateur lui-même
        if (isset($product->user_id) && $product->user_id == $user->id) {
            return $this->roundPrices([
                $product->price ?? 0,
                $product->price_floor ?? 0,
                $product->price_roll ?? 0,
                $product->price_promo ?? 0,
            ]);
        }

        // Prix spéciaux fixes (si p n'est pas -1, 0 ou 1)
        $priceMode = $userAttributes['p'] ?? -1;
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
    protected function getSpecialPrice(Product $product, $priceField): float
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

        if ($ancestors->isEmpty()) {
            // Pas de parents = prix de base du produit
            return [
                $product->price ?? 0,
                $product->price_floor ?? 0,
                $product->price_roll ?? 0,
                $product->price_promo ?? 0,
            ];
        }

        // Remonter la hiérarchie en partant de la racine
        $currentPrices = [
            $product->price ?? 0,
            $product->price_floor ?? 0,
            $product->price_roll ?? 0,
            $product->price_promo ?? 0,
        ];

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
        $priceMode = $attributes['p'] ?? -1;      // 0=départ, 1=rendu
        
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
        $fallback = 0.0;
        foreach ([$result[0] ?? 0, $result[1] ?? 0, $result[2] ?? 0, $prices[0] ?? 0, $prices[1] ?? 0, $prices[2] ?? 0] as $candidate) {
            if ($candidate > 0) {
                $fallback = (float) $candidate;
                break;
            }
        }
        if ($fallback <= 0) {
            $fallback = 0.01;
        }

        if (($result[0] ?? 0) <= 0) {
            $result[0] = $fallback;
        }
        if (($result[1] ?? 0) <= 0) {
            $result[1] = $fallback;
        }
        if (($result[2] ?? 0) <= 0) {
            $result[2] = $fallback;
        }

        return $this->roundPrices($result);
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
