# LegacyMigrationMatrix

Date de reference: 2026-07-12
Portee: migration progressive du moteur de calcul historique Infovegetal vers le moteur runtime cible.
References officielles:
- Business rules: BusinessRules.md
- Matrice de migration: LegacyMigrationMatrix.md

## Statuts
- ⚪ Pas commence
- 🟡 En cours
- 🟢 Migre
- 🔵 Valide en production
- ⚫ Legacy supprime

## Priorites metier
- P0: Le moteur ne peut pas fonctionner sans cette regle.
- P1: Fonctionnalite commerciale cle.
- P2: Administration, historisation, audit.
- P3: Comptabilite et reversements.

## Couverture de tests (valeurs)
- 0 %
- En cours
- Complète

## Runtime (valeurs)
- Legacy
- Shadow
- Nouveau moteur

## Conventions de tracabilite
- Chaque ligne de matrice doit referencer au moins une BR-XXX.
- Chaque PR ne doit migrer qu une ou deux lignes de cette matrice.
- Chaque test ajoute doit declarer ses BR-XXX cibles.
- Chaque methode metier principale peut declarer ses BR-XXX si cela apporte de la valeur.

Convention recommandee pour les tests:

```php
/**
 * Business Rules:
 * BR-001
 * BR-008
 */
```

Convention recommandee pour les methodes metier cle:

```php
/**
 * BR-001
 * BR-014
 */
public function calculate(...)
```

## Reponse instantanee
Question: Le calcul du prix rendu est-il encore effectue par le legacy ou par le nouveau moteur ?
- Reponse actuelle: majoritairement legacy en runtime checkout.
- Lignes concernees: Transport - mode rendu, Transport - cout incorpore, Transport - cout residuel.
- Statut courant: 🟡 En cours.

## Matrice de migration

| Regle metier | Business Rules | Description | Code legacy actuel | Nouveau moteur | Statut | Priorite metier | Depend de | Valeur utilisateur | Tests | Peut supprimer le legacy ? | Couverture de tests | Runtime |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Produit - prix standard | BR-001 | Prix unitaire de base applique au client | Aucun en runtime panier | ProductPriceSourceResolver + ProductSalesPriceCalculator | 🟢 Migre | P0 | Resolution acteurs, conditions | Le client voit un prix de base correct | tests/Unit/Services/PriceCalculatorServiceTest.php<br>tests/Unit/Domain/Sales/ProductPriceSourceResolverTest.php<br>tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php | Oui | Complète | Nouveau moteur |
| Produit - prix carton | BR-002 | Palier carton selon quantite | Aucun en runtime panier | ProductVolumePriceSelector | 🟢 Migre | P0 | Prix standard | Le client paie le bon prix des volumes carton | tests/Unit/Services/PriceCalculatorServiceTest.php<br>tests/Unit/Domain/Sales/ProductVolumePriceSelectorTest.php | Oui | Complète | Nouveau moteur |
| Produit - prix etage | BR-003 | Palier etage selon quantite | Aucun en runtime panier | ProductVolumePriceSelector | 🟢 Migre | P0 | Prix carton | Le client paie le bon prix des volumes etage | tests/Unit/Services/PriceCalculatorServiceTest.php<br>tests/Unit/Domain/Sales/ProductVolumePriceSelectorTest.php | Oui | Complète | Nouveau moteur |
| Produit - prix demi-etage | BR-004 | Palier intermediaire optionnel | Non explicite | A definir metier avant implementation | ⚪ Pas commence | P1 | Prix carton | Le client beneficie d un palier intermediaire juste | A creer | Non | 0 % | Legacy |
| Produit - prix roll | BR-005 | Palier roll selon quantite | Aucun en runtime panier | ProductVolumePriceSelector | 🟢 Migre | P0 | Prix etage | Le client paie correctement les gros volumes | tests/Unit/Services/PriceCalculatorServiceTest.php<br>tests/Unit/Domain/Sales/ProductVolumePriceSelectorTest.php | Oui | Complète | Nouveau moteur |
| Produit - prix promotion | BR-006 | Promo prioritaire sur roll | Aucun en runtime panier | ProductVolumePriceSelector | 🟢 Migre | P1 | Prix roll | Le client voit bien la promo appliquee | tests/Unit/Services/PriceCalculatorServiceTest.php<br>tests/Unit/Domain/Sales/ProductVolumePriceSelectorTest.php | Oui | Complète | Nouveau moteur |
| Produit - prix minimum | BR-007 | Borne basse prix positif | Aucun en runtime panier | ProductPriceFallbackResolver | 🟢 Migre | P0 | Fallback prix | Evite les lignes a 0 involontaires | tests/Unit/Services/PriceCalculatorServiceTest.php<br>tests/Unit/Domain/Sales/ProductPriceFallbackResolverTest.php | Oui | Complète | Nouveau moteur |
| Produit - fallback prix | BR-008 | Fallback entre sources de prix | Aucun en runtime panier | ProductPriceFallbackResolver | 🟢 Migre | P0 | Prix standard | Le panier reste calculable meme avec donnees incompletes | tests/Unit/Services/PriceCalculatorServiceTest.php<br>tests/Unit/Domain/Sales/ProductPriceFallbackResolverTest.php | Oui | Complète | Nouveau moteur |
| Produit - prix speciaux legacy | BR-009 | Source prix historique speciale | Aucun en runtime panier | ProductPriceSourceResolver | 🟢 Migre | P1 | Fallback prix | Les accords historiques restent respectes pendant migration | tests/Unit/Services/PriceCalculatorServiceTest.php<br>tests/Unit/Domain/Sales/ProductPriceSourceResolverTest.php | Oui | Complète | Nouveau moteur |
| Acteurs - DB Owner | BR-010 | Proprietaire economique base produit | Legacy implicite | ActorChain + ExpectedSettlementBuilder | 🟡 En cours | P1 | Resolution acteurs | Clarifie qui porte la base economique | tests/Unit/Domain/Sales/ExpectedSettlementBuilderTest.php | Non | En cours | Shadow |
| Acteurs - BillingUser | BR-011 | Acteur qui facture le client | Aucun en runtime snapshot | OrderActorResolver | 🟢 Migre | P0 | Client, DB Owner | Le client et le facturant voient un flux coherent | tests/Feature/Domain/Sales/OrderSnapshotServiceTest.php<br>tests/Feature/Domain/Sales/OrderActorResolverTest.php | Oui | Complète | Nouveau moteur |
| Acteurs - SellerUser | BR-012 | Acteur commercial de la relation | Aucun en runtime snapshot | OrderActorResolver | 🟢 Migre | P1 | BillingUser | Le commercial est rattache sans ambiguite | tests/Feature/Domain/Sales/OrderSnapshotServiceTest.php<br>tests/Feature/Domain/Sales/OrderActorResolverTest.php | Oui | Complète | Nouveau moteur |
| Acteurs - Client | BR-013 | Beneficiaire du prix final | Aucun en runtime snapshot | OrderActorResolver | 🟢 Migre | P0 | BillingUser | Le client obtient un total final stable | tests/Feature/Domain/Sales/OrderSnapshotServiceTest.php<br>tests/Feature/Domain/Sales/OrderActorResolverTest.php | Oui | Complète | Nouveau moteur |
| Conditions - marge facturant | BR-014 | Marge facturant sur base DB | Aucun en runtime panier | ProductPriceMarginApplier | 🟢 Migre | P1 | Prix standard, BillingUser | Le facturant voit son gain conforme | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php<br>tests/Unit/Domain/Sales/ProductPriceMarginApplierTest.php | Oui | Complète | Nouveau moteur |
| Conditions - marge commercial | BR-015 | Marge commercial sur base DB | Aucun en runtime panier | ProductPriceMarginApplier | 🟢 Migre | P1 | Marge facturant, SellerUser | Le commercial voit son gain brut reel | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php<br>tests/Unit/Domain/Sales/ProductPriceMarginApplierTest.php | Oui | Complète | Nouveau moteur |
| Conditions - marge minimum mm | BR-016 | Minimum de marge reparti | Aucun en runtime panier | ProductPriceMarginApplier | 🟢 Migre | P1 | Prix roll | La marge minimale est respectee | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php<br>tests/Unit/Domain/Sales/ProductPriceMarginApplierTest.php | Oui | Complète | Nouveau moteur |
| Conditions - ponderation pd | BR-017 | Coefficient historique de ponderation | Aucun en runtime panier | ProductPriceMarginApplier | 🟢 Migre | P1 | Prix standard | Le prix suit les regles historiques attendues | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php<br>tests/Unit/Domain/Sales/ProductPriceMarginApplierTest.php | Oui | Complète | Nouveau moteur |
| Conditions - heritage | BR-018 | Heritage des conditions commerciales | Aucun en runtime snapshot | SalesConditionSnapshotResolver | 🟢 Migre | P1 | Resolution acteurs | Les conditions sont coherentes sur la chaine commerciale | tests/Feature/Domain/Sales/OrderSnapshotServiceTest.php<br>tests/Unit/Domain/Sales/SalesConditionSnapshotResolverTest.php | Oui | Complète | Nouveau moteur |
| Conditions - profils | BR-019 | Profils de conditions facturant | Aucun en runtime snapshot | SalesConditionSnapshotResolver | 🟢 Migre | P1 | Heritage | Le facturant applique rapidement la bonne politique | tests/Feature/Domain/Sales/OrderSnapshotServiceTest.php<br>tests/Unit/Domain/Sales/SalesConditionSnapshotResolverTest.php | Oui | Complète | Nouveau moteur |
| Conditions - profil actif relation | BR-020 | Profil effectif facturant-commercial | Aucun en runtime snapshot | SalesConditionRelationResolver | 🟢 Migre | P1 | Profils | Le bon profil est applique sans erreur | tests/Feature/Domain/Sales/OrderSnapshotServiceTest.php<br>tests/Feature/Domain/Sales/SalesConditionRelationResolverTest.php | Oui | Complète | Nouveau moteur |
| Conditions - override client | BR-021 | Surcharge client prioritaire | Aucun en runtime snapshot | SalesConditionRelationResolver | 🟢 Migre | P1 | Profil actif relation | Les accords client specifiques sont respectes | tests/Feature/Domain/Sales/OrderSnapshotServiceTest.php<br>tests/Feature/Domain/Sales/SalesConditionRelationResolverTest.php | Oui | Complète | Nouveau moteur |
| Remise pourcentage | BR-022 | Remise % sur sous-total commercial | Legacy heterogene | ProductSalesPriceCalculator | 🟡 En cours | P1 | Marge commercial | Le client voit la remise % negociee | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php | Non | En cours | Shadow |
| Remise montant fixe | BR-023 | Remise euro unite ou ligne | Legacy heterogene | ProductSalesPriceCalculator | 🟡 En cours | P1 | Remise pourcentage | Le client voit la remise fixe negociee | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php | Non | En cours | Shadow |
| Ordre d application remises | BR-024 | Ordre strict des remises | Legacy implicite | ProductSalesPriceCalculator (ordre explicite) | 🟡 En cours | P1 | Remise % et fixe | Le total est previsible et explicable | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php | Non | En cours | Shadow |
| Acteur supportant la remise | BR-025 | Remise supportee par gain commercial | Legacy implicite | ProductSalesPriceCalculator + ExpectedSettlementBuilder | 🟡 En cours | P1 | Marge commercial, remises | Le commercial voit son net reel | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php | Non | En cours | Shadow |
| TVA produit | BR-026 | Taux TVA produit prioritaire | app/Services/OrderSnapshotService.php::resolveTvaRate | ProductVatResolver | 🟡 En cours | P0 | Calcul panier | Le client voit une TVA produit correcte | tests/Unit/Domain/Sales/ProductVatResolverTest.php | Non | En cours | Shadow |
| TVA categorie | BR-027 | Fallback TVA categorie | Legacy incomplet | ProductVatResolver | 🟡 En cours | P0 | TVA produit | Le calcul TVA reste possible sans taux produit | tests/Unit/Domain/Sales/ProductVatResolverTest.php | Non | En cours | Shadow |
| TVA transport | BR-028 | TVA sur transport facture | app/Http/Controllers/CartController.php::computeShippingFromRollDistribution | TransportAllocationCalculator | 🟡 En cours | P0 | Transport depart/rendu | Le total TVA inclut correctement le transport | tests/Unit/Domain/Sales/TransportAllocationCalculatorTest.php | Non | En cours | Shadow |
| Transport - depart | BR-029 | Transport facture via grille | app/Http/Controllers/CartController.php::computeShippingFromRollDistribution | Service de tarification transport + TransportAllocationCalculator | ⚪ Pas commence | P0 | Zone, minimum, transporteur | Le client voit un transport depart juste | A creer | Non | 0 % | Legacy |
| Transport - rendu | BR-030 | Transport avec part incorporee et residuelle | app/Http/Controllers/CartController.php::computeShippingFromRollDistribution<br>app/Support/RenderedTransportCalculator.php | TransportPricingPreparationService + TransportAllocationCalculator | 🟡 En cours | P0 | Cout reel/incorpore/residuel | Le client ne paie pas deux fois le transport | tests/Unit/RenderedTransportCalculatorTest.php<br>tests/Unit/Domain/Sales/TransportPricingPreparationServiceTest.php | Non | En cours | Shadow |
| Transport - cout reel | BR-031 | Cout economique total transport | app/Support/RenderedTransportCalculator.php | TransportPricingPreparationService (cible) | 🟡 En cours | P0 | Logistique rolls | Le cout logistique reel est pris en compte | tests/Unit/RenderedTransportCalculatorTest.php | Non | En cours | Shadow |
| Transport - cout incorpore | BR-032 | Part transport deja dans prix produit | app/Http/Controllers/CartController.php::computeShippingFromRollDistribution | TransportPricingPreparationService | 🟡 En cours | P0 | Prix rendu | Evite la double facturation transport | tests/Unit/Domain/Sales/TransportPricingPreparationServiceTest.php | Non | En cours | Shadow |
| Transport - cout residuel | BR-033 | Difference cout reel - incorpore | app/Support/RenderedTransportCalculator.php | TransportPricingPreparationService + Allocation | 🟡 En cours | P0 | Cout reel, cout incorpore | Le client paie uniquement le residuel | tests/Unit/RenderedTransportCalculatorTest.php | Non | En cours | Shadow |
| Transport - minimum | BR-034 | Minimum monetaire transport | app/Http/Controllers/CartController.php::pickZoneTariff | Service de tarification transport (cible) | 🟡 En cours | P0 | Transport depart, zone | Le cout minimum est coherent avec la politique transport | tests/Unit/Http/Controllers/CartControllerTransportPricingTest.php | Non | En cours | Legacy |
| Transport - zone | BR-035 | Tarification par zone | app/Http/Controllers/CartController.php::pickZoneTariff,parseTariffRange | Service de tarification transport (cible) | 🟡 En cours | P0 | Choix transporteur | Le client paie selon sa zone de livraison | tests/Unit/Http/Controllers/CartControllerTransportPricingTest.php | Non | En cours | Legacy |
| Transport - transporteur applicable | BR-036 | Transporteur applicable au contexte | app/Http/Controllers/CartController.php::buildPdfPayload | Resolution transport metier (cible) | 🟡 En cours | P1 | Acteurs, zone | Le bon transporteur est utilise pour le calcul | tests/Unit/Http/Resources/ProductResourceTransportTest.php | Non | En cours | Legacy |
| Transport - choix transporteur | BR-037 | Choix coherent avec regles autorisees | Regle dispersee | Validation metier transport (cible) | 🟡 En cours | P1 | Transporteur applicable | Le client choisit un transporteur valide | tests/Feature/Http/Controllers/ProductControllerTransportChoiceTest.php | Non | En cours | Legacy |
| Logistique - cartons | BR-038 | Conversion en cartons | app/Services/PdfRollDistributionService.php::firstTri | Service logistique metier (cible) | 🟡 En cours | P0 | Conditionnements produit | Le transport est base sur des volumes reels | tests/Unit/Services/PdfRollDistributionServiceTest.php | Non | En cours | Legacy |
| Logistique - etages | BR-039 | Organisation en etages | app/Services/PdfRollDistributionService.php::buildFullEtage,binpack | Service logistique metier (cible) | 🟡 En cours | P0 | Cartons | Le calcul de remplissage est realiste | tests/Unit/Services/PdfRollDistributionServiceTest.php | Non | En cours | Legacy |
| Logistique - demi-etages | BR-040 | Niveau intermediaire logistique | Non explicite | A formaliser metier avant migration | ⚪ Pas commence | P1 | Etages | La logistique partielle est correctement representee | A creer | Non | 0 % | Legacy |
| Logistique - rolls | BR-041 | Regroupement final en rolls | app/Services/PdfRollDistributionService.php::build,binpack | Service logistique metier (cible) | 🟡 En cours | P0 | Etages | Le nombre de rolls est exact | tests/Unit/Services/PdfRollDistributionServiceTest.php | Non | En cours | Legacy |
| Logistique - remplissage | BR-042 | Taux d occupation des rolls | app/Services/PdfRollDistributionService.php::binpack<br>app/Http/Controllers/CartController.php::tariffToFillRatio | Input transport roll occupancy (cible) | 🟡 En cours | P0 | Rolls | Le transport rendu reflete l occupation reelle | tests/Unit/Http/Controllers/CartControllerTransportPricingTest.php | Non | En cours | Legacy |
| Logistique - multi-producteurs | BR-043 | Segmentation par producteur/base | app/Services/PdfRollDistributionService.php::buildSupplierTri | Service logistique metier (cible) | 🟡 En cours | P1 | Rolls | Le calcul reste juste sur paniers mixtes | tests/Unit/Services/PdfRollDistributionServiceTest.php | Non | En cours | Legacy |
| Logistique - regroupement | BR-044 | Regroupement optimisant expedition | app/Services/PdfRollDistributionService.php::binpack | Service logistique metier (cible) | 🟡 En cours | P1 | Multi-producteurs | Cout logistique potentiellement reduit | tests/Unit/Services/PdfRollDistributionServiceTest.php | Non | En cours | Legacy |
| Commande - calcul panier | BR-045 | Total panier produit + transport | app/Http/Controllers/CartController.php::getCartPricing,buildPdfPayload,computeShippingFromRollDistribution | OrderSalesChainCalculator (runtime cible) | 🟡 En cours | P0 | Prix, TVA, transport | Le client voit le bon total avant validation | tests/Unit/Http/Controllers/CartControllerTransportPricingTest.php | Non | En cours | Legacy |
| Commande - calcul commande | BR-046 | Total commande HT/TVA/TTC valide | app/Services/OrderSnapshotService.php::createFromPayload | OrderCalculationBreakdownAssembler + CustomerInvoiceProjector | 🟡 En cours | P0 | Calcul panier | La commande validee est fidele au panier | tests/Unit/Domain/Sales/OrderCalculationBreakdownAssemblerTest.php<br>tests/Unit/Domain/Sales/CustomerInvoiceProjectorTest.php | Non | En cours | Shadow |
| Commande - snapshot | BR-047 | Historisation immutable des montants | app/Services/OrderSnapshotService.php::createFromPayload | SalesCalculationSnapshotBuilder | 🟡 En cours | P2 | Calcul commande | Les historiques ne changent plus dans le temps | tests/Unit/Domain/Sales/SalesCalculationSnapshotBuilderTest.php | Non | En cours | Shadow |
| Commande - audit | BR-048 | Tracabilite explicable du calcul | Legacy partiel via snapshots actuels | SalesCalculationSnapshotBuilder | 🟡 En cours | P2 | Snapshot | Le support peut expliquer un montant rapidement | tests/Unit/Domain/Sales/SalesCalculationSnapshotBuilderTest.php | Non | En cours | Shadow |
| Flux financiers - gains facturant | BR-049 | Gain net/gross facturant | app/Services/OrderSnapshotService.php (marge derivee) | ProductSalesPriceCalculator + ExpectedSettlementBuilder | 🟡 En cours | P1 | Marges, remises | Le facturant connait sa marge reelle | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php | Non | En cours | Shadow |
| Flux financiers - gains commercial | BR-050 | Gain commercial apres remises | Legacy implicite | ProductSalesPriceCalculator + ExpectedSettlementBuilder | 🟡 En cours | P1 | Marges, remises | Le commercial voit son gain reel | tests/Unit/Domain/Sales/ProductSalesPriceCalculatorTest.php | Non | En cours | Shadow |
| Reversements - DB Owner | BR-051 | Reversement vers DB Owner | Legacy non centralise | ExpectedSettlementBuilder | 🟡 En cours | P3 | Gains facturant | Le DB Owner connait le montant qui lui revient | tests/Unit/Domain/Sales/ExpectedSettlementBuilderTest.php | Non | En cours | Shadow |
| Reversements - transporteur | BR-052 | Reversement cout transport | Legacy non centralise | ExpectedSettlementBuilder (cible a completer) | 🟡 En cours | P3 | Cout reel transport | Le cout transport est affecte au bon acteur | tests/Unit/Domain/Sales/ExpectedSettlementBuilderTest.php | Non | En cours | Shadow |
| Reversements - commercial | BR-053 | Reversement commercial selon net | Legacy non centralise | ExpectedSettlementBuilder | 🟡 En cours | P3 | Gains commercial | Le commercial recoit un reversement coherent | tests/Unit/Domain/Sales/ExpectedSettlementBuilderTest.php | Non | En cours | Shadow |

## Cartographie runtime legacy encore active
- CartController::getCartPricing
- CartController::resolveProductPrices
- CartController::buildPdfPayload
- CartController::computeShippingFromRollDistribution
- PriceCalculatorService::calculatePrice
- OrderSnapshotService::createFromPayload

## Regle PR (obligatoire)
Une PR ne doit jamais migrer plus de deux lignes de cette matrice.
Chaque PR doit:
1. Selectionner 1 ou 2 lignes.
2. Implementer totalement ces lignes.
3. Ajouter les tests associes.
4. Mettre a jour LegacyMigrationMatrix et BusinessRules.
5. Lister les methodes legacy devenues inutiles.

## Rapport de fin de lot (obligatoire)
1. Business Rules maintenant couvertes (BR-XXX).
2. Fichiers legacy concernes.
3. Methodes legacy devenues inutiles.
4. Appels runtime a remplacer.
5. Tests ajoutes.
6. Risques de regression.
7. Differences restantes avec le legacy.

## Definition de termine (ligne de matrice)
Une ligne n est terminee que si:
- la BR est documentee dans BusinessRules.md,
- la ligne de matrice est a jour,
- l implementation est faite,
- les tests sont verts,
- le runtime utilise le nouveau calcul,
- le legacy equivalent est supprimable.

## Phase de conception
Phase de conception cloturee. A partir de maintenant, toute evolution part exclusivement de BusinessRules.md et LegacyMigrationMatrix.md.
