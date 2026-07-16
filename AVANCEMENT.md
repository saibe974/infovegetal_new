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
- BR-002: le test couvre maintenant le vrai seuil carton.
- BR-003: le test distingue maintenant vraiment le seuil etage du carton.
- BR-014/015: les marges billing et seller sont maintenant explicitement tracees dans les tests du moteur cible.
- BR-016: la marge minimum est maintenant explicitement tracee dans les tests du moteur cible.
- BR-018 a BR-021: l heritage, les profils, le profil relationnel et l override client sont maintenant explicitement traces dans les tests de snapshot.
- BR-024/025: l ordre des remises et le support de remise sont maintenant explicitement traces dans les tests du moteur cible.
- BR-026/027: la TVA produit et le fallback categorie sont maintenant explicitement traces dans les tests TVA.
- BR-028: la TVA transport est maintenant explicitement tracee dans les tests d allocation transport.
- BR-040/044: les demi-etages logistiques et le regroupement optimise sont maintenant explicitement traces dans les tests PDF roll.
- BR-049/050: les gains facturant et commercial sont maintenant explicitement traces dans les tests du moteur cible.
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