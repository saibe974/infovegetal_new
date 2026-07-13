# AVANCEMENT

Date de reference: 2026-07-13

## ÉTAT DU PROJET

🟢 Business Rules
🟢 LegacyMigrationMatrix
🟡 Runtime
🟢 Tests
🟡 Panier
⚪ Checkout
🟡 Snapshot

## Où en est le runtime

Le runtime panier/prix reste encore majoritairement legacy dans `CartController` et `PriceCalculatorService`.
Le moteur cible calcule deja les briques de domaine, les acteurs resolus et certains reversements.
Le prix standard est maintenant aussi repris via le moteur cible dans le service de prix, avec fallback legacy.
La base de calcul des paliers s aligne maintenant aussi sur ce prix standard cible.
Le flux reste mixte: calcul métier cible en preparation, affichage visible encore pilote par le legacy pour plusieurs paliers.

## Dernière Business Rule migrée

- BR-001: le prix standard commence a passer par le moteur cible dans `PriceCalculatorService`, avec fallback legacy conserve.
- BR-001: la base des paliers s aligne aussi sur ce prix standard cible.
- Legacy devenu supprimable: aucun pour l instant, le flux panier visible reste encore hybride.
- Tests ajoutés: `tests/Unit/Services/PriceCalculatorServiceTest.php`.

## Ce qui est encore legacy

- Le calcul visible du panier reste dans `CartController::getCartPricing` et `PriceCalculatorService::calculatePrice`.
- La construction de commande passe encore par `OrderSnapshotService::createFromPayload`.
- Les paliers carton, etage, roll et promo restent encore majoritairement pilotés par le legacy.
- Les bascules visibles BR-002 a BR-006 et BR-014 a BR-021 ne sont pas encore toutes prises par le runtime cible.

## Ce qui est maintenant fonctionnel

Le moteur calcule maintenant :

- la resolution des acteurs resolus pour un snapshot de commande;
- la conservation de ces acteurs dans les metadonnees du snapshot;
- le prix standard via le moteur cible quand le contexte est simple;
- une base de prix qui se propage deja dans la chaine des paliers;
- le reversement transporteur quand un transport a un `carrierId`;
- les calculs de transport et de reversement deja couverts par les tests du moteur de domaine.

## Sessions

### Session du 2026-07-13

Business Rules migrées

- BR-001

Legacy supprimé

- Aucun

Tests ajoutés

- Aucun nouveau test, validation syntaxique sur `PriceCalculatorService.php` et `tests/Unit/Services/PriceCalculatorServiceTest.php`.

Décisions prises

- Utiliser le moteur cible pour le prix standard quand le contexte le permet.
- Conserver le legacy comme filet de securite pour les cas non encore branches.
- Valider la parite et les seuils BR-001 par test unitaire deja vert.
- Propager cette base cible dans la chaine des paliers sans casser le legacy.

Prochaine étape

- Brancher BR-002 sur le seuil carton, puis passer au palier etage.

### Session du 2026-07-13

Business Rules migrées

- BR-052

Legacy supprimé

- Aucun

Tests ajoutés

- `tests/Feature/Domain/Sales/OrderSnapshotServiceTest.php`

Décisions prises

- Garder le legacy en runtime visible tant que la bascule panier/prix n est pas branchee.
- Utiliser `AVANCEMENT.md` comme journal officiel de reprise.

Prochaine étape

- Brancher progressivement le runtime cible sur le calcul visible du panier sans casser le legacy.

## Prochaine Business Rule

BR-002

Objectif

Appliquer le palier carton quand la quantite atteint le seuil carton.

Legacy

`CartController::getCartPricing()`
`PriceCalculatorService::calculatePrice()`

Nouveau moteur

`ProductSalesPriceCalculator`

Validation

Le panier affiche exactement le meme prix carton que le legacy au seuil carton.