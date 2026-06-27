# Architecture commandes immuables (snapshot)

## Objectif

Garantir qu'une commande historique ne soit jamais recalculee avec les regles, prix, marges, transport ou mappings actuels.

## Decision cible

- Le panier (`carts`, `cart_product`) reste un aggregate operationnel (brouillon/courant/traitement).
- Les donnees analytiques et financieres reposent uniquement sur des snapshots immuables:
	- `order_headers`
	- `order_lines`

## Tables introduites

### `order_headers`

- Liens metier: `cart_id`, `client_user_id`, `billing_user_id`, `seller_user_id`, `db_product_id`
- Identite commande: `order_number`, `order_date`, `status`, `currency`
- Totaux figes: `items_total_ht`, `shipping_total_ht`, `total_ht`, `total_tva`, `total_ttc`
- Conditions: `conditions_snapshot` (defaults + override + resolved)
- Meta technique: `meta`

### `order_lines`

- Liens: `order_header_id`, `product_id`, `db_product_id`
- Snapshot produit: `product_name`, `product_ref`, `product_ean`, `producer_id`, `cond`, `floor`, `roll`, `product_snapshot`
- Quantitatif et financier: `quantity`, `purchase_price`, `selling_price`, `transport_price`, `margin_amount`, `margin_percent`
- Totaux ligne figes: `line_total_ht`, `line_total_tva`, `line_total_ttc`, `tva_rate`
- Meta technique: `meta`

## Service de snapshot

`App\Services\OrderSnapshotService`:

- Construit une commande immutable a partir du payload valide au moment de la commande.
- Resolve les acteurs (client, facturant, commercial) a partir du pivot `db_product_user`.
- Fige les conditions commerciales (defaults/profiles + override vendeur) via:
	- `db_product_billing_user`
	- `billing_user_seller_user`
- Calcule et fige, par ligne:
	- prix achat
	- prix vente
	- part transport
	- marge valeur/%
	- TVA et TTC

## Point d'integration

Le snapshot est cree a la validation commande dans:

- `CartController::placeOrder()`
- `CartController::generatePdfTcpdf()`

Avec garde d'idempotence par `cart_id` (pas de duplication snapshot si deja cree).

## Requetes KPI

`App\Services\OrderKpiService` fournit des aggregates read-only:

- synthese mensuelle (CA HT/TVA/TTC, panier moyen)
- top clients
- top commerciaux
- top DB produits

## Strategie de migration historique

### Option recommandee (safe)

1. Migrer schema (nouvelles tables) sans toucher aux tables panier.
2. Activer la creation snapshot pour les nouvelles commandes.
3. Lancer un script de backfill optionnel pour les anciennes commandes `carts.status in (processing, processed)`:
	 - copier les totaux existants
	 - reconstruire au mieux les lignes depuis `cart_product`
	 - marquer `meta.source = backfill_best_effort`
4. Basculer progressivement le reporting/dashboard sur `order_headers`/`order_lines` uniquement.

### Pourquoi ne pas etendre `carts`

- `carts` melange etat courant et historique, ce qui favorise le recalcul implicite.
- Les snapshots normalisent la lecture analytique et evitent les regressions metier.

## Invariant metier a respecter

- Aucune logique dashboard ne lit des donnees dynamiques produits/pivots pour une commande passee.
- Toute lecture historique part des snapshots uniquement.
