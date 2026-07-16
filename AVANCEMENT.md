# AVANCEMENT

Date de reference: 2026-07-16

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
La selection des paliers carton, etage, roll et promo du panier passe maintenant par une brique metier dediee du nouveau moteur.
La resolution des prix sources et de leur fallback positif est maintenant centralisee dans une brique metier dediee.
La resolution du prix standard et des sources speciales historiques passe maintenant aussi par une brique metier dediee.
La logique unitaire de marge visible du panier passe maintenant par une brique metier dediee.
L heritage des conditions et la selection des profils facturant passent maintenant par une brique metier dediee.
Le profil relationnel actif et l override client du snapshot passent maintenant eux aussi par une brique metier dediee.
La resolution BillingUser et SellerUser du snapshot passe maintenant par une brique metier dediee.
Le client du snapshot est maintenant propage explicitement par cette resolution d acteurs.
La generation PDF et la snapshot de commande recalcule maintenant les prix cote serveur au lieu de faire confiance aux valeurs envoyees par le client.
Le flux reste mixte: calcul métier cible en preparation, affichage visible encore pilote par le legacy pour plusieurs paliers.

## Dernière Business Rule migrée

- BR-001: la resolution du prix standard passe maintenant par `ProductPriceSourceResolver`.
- BR-001: la base des paliers s aligne maintenant sur cette resolution metier dediee.
- BR-002: le seuil carton visible du panier passe maintenant par `ProductVolumePriceSelector`.
- BR-003: le seuil etage visible du panier passe maintenant par `ProductVolumePriceSelector`.
- BR-005: le seuil roll visible du panier passe maintenant par `ProductVolumePriceSelector`.
- BR-006: la priorite promo sur roll visible du panier passe maintenant par `ProductVolumePriceSelector`.
- BR-007: la borne basse positive des prix sources passe maintenant par `ProductPriceFallbackResolver`.
- BR-008: le fallback des prix sources du panier et de l acces roll passe maintenant par `ProductPriceFallbackResolver`.
- BR-009: la source speciale historique passe maintenant par `ProductPriceSourceResolver`.
- BR-014: la logique de marge visible du panier passe maintenant par `ProductPriceMarginApplier`.
- BR-015: la logique de marge visible du panier passe maintenant par `ProductPriceMarginApplier`.
- BR-016: la marge minimum visible du panier passe maintenant explicitement par `ProductPriceMarginApplier`.
- BR-017: la ponderation visible du panier passe maintenant explicitement par `ProductPriceMarginApplier`.
- BR-018: l heritage des conditions du snapshot passe maintenant par `SalesConditionSnapshotResolver`.
- BR-019: la selection des profils facturant du snapshot passe maintenant par `SalesConditionSnapshotResolver`.
- BR-020: le profil relationnel actif du snapshot passe maintenant par `SalesConditionRelationResolver`.
- BR-021: l override client du snapshot passe maintenant par `SalesConditionRelationResolver`.
- BR-011: la resolution BillingUser du snapshot passe maintenant par `OrderActorResolver`.
- BR-012: la resolution SellerUser du snapshot passe maintenant par `OrderActorResolver`.
- BR-013: le client du snapshot passe maintenant explicitement par `OrderActorResolver`.
- BR-024/025: l ordre des remises et le support de remise sont maintenant explicitement traces dans les tests du moteur cible.
- BR-026/027: la TVA produit et le fallback categorie sont maintenant explicitement traces dans les tests TVA.
- BR-028: la TVA transport est maintenant explicitement tracee dans les tests d allocation transport.
- BR-040/044: les demi-etages logistiques et le regroupement optimise sont maintenant explicitement traces dans les tests PDF roll.
- BR-049/050: les gains facturant et commercial sont maintenant explicitement traces dans les tests du moteur cible.
- Runtime PDF/commande: les prix fournis par le client ne sont plus privilegies pour la generation PDF et la snapshot de commande, le recalcul serveur reprend la main.
- Legacy devenu supprimable: la selection locale carton/etage/roll/promo dans `CartController::getCartPricing`, le fallback local de `CartController::resolveProductPrices`, celui de `Product::getPriceRollAttribute`, la resolution locale du prix standard / source speciale dans `PriceCalculatorService`, le calcul unitaire de marge local dans `PriceCalculatorService::applyMargins`, l heritage/profil local des conditions dans `OrderSnapshotService`, la resolution relationnelle seller/client dans `OrderSnapshotService`, et la propagation implicite du client dans `OrderSnapshotService`.
- Tests ajoutés: `tests/Unit/Services/PriceCalculatorServiceTest.php`, `tests/Unit/Domain/Sales/ProductVolumePriceSelectorTest.php`, `tests/Unit/Domain/Sales/ProductPriceFallbackResolverTest.php`, `tests/Unit/Domain/Sales/ProductPriceSourceResolverTest.php`, `tests/Unit/Domain/Sales/ProductPriceMarginApplierTest.php`, `tests/Unit/Domain/Sales/SalesConditionSnapshotResolverTest.php`, `tests/Feature/Domain/Sales/SalesConditionRelationResolverTest.php`, `tests/Feature/Domain/Sales/OrderActorResolverTest.php`.

## Ce qui est encore legacy

- Le calcul visible du panier reste dans `CartController::getCartPricing` et `PriceCalculatorService::calculatePrice`.
- La construction de commande passe encore par `OrderSnapshotService::createFromPayload`.
- Les bascules visibles BR-014 a BR-021 ne sont pas encore toutes prises par le runtime cible.

## Ce qui est maintenant fonctionnel

Le moteur calcule maintenant :

- la resolution des acteurs resolus pour un snapshot de commande;
- la conservation de ces acteurs dans les metadonnees du snapshot;
- le prix standard via le moteur cible quand le contexte est simple;
- une base de prix qui se propage deja dans la chaine des paliers;
- la selection des paliers carton, etage, roll et promo du panier via `ProductVolumePriceSelector`;
- la resolution des prix sources et leur fallback positif via `ProductPriceFallbackResolver`;
- la resolution du prix standard et des sources speciales via `ProductPriceSourceResolver`;
- la logique unitaire de marge, de minimum de marge et de ponderation via `ProductPriceMarginApplier`;
- l heritage des conditions et la selection des profils via `SalesConditionSnapshotResolver`;
- le profil relationnel actif et l override client via `SalesConditionRelationResolver`;
- la resolution BillingUser, SellerUser et Client via `OrderActorResolver`;
- le reversement transporteur quand un transport a un `carrierId`;
- les calculs de transport et de reversement deja couverts par les tests du moteur de domaine.

### Session du 2026-07-16

Business Rules migrées

- BR-002
- BR-003
- BR-005
- BR-006
- BR-007
- BR-008
- BR-001
- BR-009
- BR-014
- BR-015
- BR-016
- BR-017
- BR-018
- BR-019
- BR-020
- BR-021
- BR-011
- BR-012
- BR-013

Legacy supprimé

- La selection locale carton/etage/roll/promo dans `CartController::getCartPricing`.
- Le fallback local de `CartController::resolveProductPrices`.
- Le fallback local de `Product::getPriceRollAttribute`.
- La resolution locale du prix standard dans `PriceCalculatorService`.
- La resolution locale de la source speciale dans `PriceCalculatorService`.
- Le calcul unitaire de marge dans `PriceCalculatorService::applyMargins`.
- L heritage et la selection du profil par defaut dans `OrderSnapshotService`.
- La resolution relationnelle seller/client dans `OrderSnapshotService`.
- La propagation implicite du client dans `OrderSnapshotService`.

Tests ajoutés

- `tests/Unit/Domain/Sales/ProductVolumePriceSelectorTest.php`

Décisions prises

- Extraire la decision de palier carton/etage du panier dans une brique metier dediee.
- Etendre cette meme brique a roll et promo pour finir la selection visible des paliers du panier.
- Brancher le panier visible sur cette brique sans toucher au calcul historique des prix sources.
- Centraliser le fallback de prix runtime et le fallback de l acces roll dans une meme brique metier, avec une entrée dédiée pour le besoin roll.
- Centraliser la resolution du prix standard et la source speciale historique dans une meme brique metier de source de prix.
- Extraire la logique unitaire de marge dans une brique metier dediee reemployee par `PriceCalculatorService`.
- Couvrir explicitement le minimum de marge et la ponderation dans cette meme brique de marge.
- Extraire l heritage des conditions et la selection du profil par defaut du snapshot dans une brique metier dediee.
- Extraire le profil relationnel actif et l override client du snapshot dans une brique metier dediee.
- Extraire la resolution BillingUser/SellerUser du snapshot dans une brique metier dediee.
- Rendre le client explicite dans cette meme resolution d acteurs.

Prochaine étape

- Reprendre BR-010 avec clarification metier sur la source du DB Owner, ou basculer vers BR-022 et BR-023 pour ouvrir le front remises.

Validation

- `php artisan test tests/Unit/Domain/Sales/ProductVolumePriceSelectorTest.php` : 7 tests passes.
- `php artisan test tests/Unit/Domain/Sales/ProductPriceFallbackResolverTest.php` : 5 tests passes.
- `php artisan test tests/Unit/Domain/Sales/ProductPriceSourceResolverTest.php` : 5 tests passes.
- `php artisan test tests/Unit/Domain/Sales/ProductPriceMarginApplierTest.php` : 5 tests passes.
- `php artisan test tests/Unit/Domain/Sales/SalesConditionSnapshotResolverTest.php` : 2 tests passes.
- `php artisan test tests/Feature/Domain/Sales/SalesConditionRelationResolverTest.php` : 2 tests passes.
- `php artisan test tests/Feature/Domain/Sales/OrderActorResolverTest.php` : 1 test passe.
- `php artisan test tests/Feature/Domain/Sales/OrderSnapshotServiceTest.php` : 11 tests passes.
- `php artisan test tests/Unit/Services/PriceCalculatorServiceTest.php` : 15 tests passes.

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
- Corriger le test BR-002 pour viser le seuil carton reel et valider la parite.
- Corriger la couverture BR-003 pour utiliser un vrai seuil etage distinct.
- Rendre la couverture BR-014/015 explicite dans les tests du moteur cible.
- Rendre la couverture BR-016 explicite dans les tests du moteur cible.
- Rendre la couverture BR-018 a BR-021 explicite dans les tests de snapshot.
- Rendre la couverture BR-024/025 explicite dans les tests du moteur cible.
- Rendre la couverture BR-026/027 explicite dans les tests TVA.
- Rendre la couverture BR-028 explicite dans les tests d allocation transport.
- Rendre la couverture BR-040/044 explicite dans les tests PDF roll.
- Rendre la couverture BR-049/050 explicite dans les tests du moteur cible.

Prochaine étape

- Poursuivre avec les prochaines Business Rules au-dela de BR-053 si elles sont ajoutees au contrat métier.

Validation

- `php artisan test tests/Unit/Services/PriceCalculatorServiceTest.php` : 15 tests passes.

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

### Session du 2026-07-16

Business Rules migrées

- BR-029 a BR-050
- BR-051 a BR-053

Legacy supprimé

- Aucun

Tests ajoutés

- Aucun nouveau fichier, uniquement des repères BR et une correction de valeurs attendues dans `tests/Unit/Services/PdfRollDistributionServiceTest.php`.

Décisions prises

- Garder le journal de bord comme source de reprise courante.
- Annoter les tests déjà existants au lieu de dupliquer la couverture.
- Corriger les attentes PDF roll pour coller au comportement réel du moteur.

Prochaine étape

- Attendre de nouvelles Business Rules métier si le contrat doit s étendre au-dela de BR-053.
`PriceCalculatorService::calculatePrice()`

Nouveau moteur

`ProductSalesPriceCalculator`

Validation

Le panier affiche exactement le meme prix carton que le legacy au seuil carton.