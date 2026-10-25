# Cycle des commandes

## Parcours

- `current` : panier enregistré, modifiable par son propriétaire.
- `processing` : commande transmise, produits préparés par les facturants et commerciaux affectés.
- `delivering` : bon de livraison établi et quantités expédiées figées.
- `delivered` : livraison confirmée ; signalements et facturation possibles.
- `closed` : factures et avoirs émis, aucun signalement en attente.
- `processed` : statut historique conservé sans le convertir artificiellement en livraison ou facture.

Un brouillon devient la commande : son identifiant et son numéro restent identiques. Les deux points d'entrée de commande utilisent cette règle. L'ajout à une commande déjà transmise et son retour au panier sont interdits. Le client peut préparer une nouvelle commande pendant le traitement de la précédente.

La soumission, l'instantané commercial et la consommation du coupon sont transactionnels. Une clé de soumission évite de créer deux commandes lors d'une nouvelle tentative du navigateur. Le panier est vidé après la réponse de succès ; les autres onglets reçoivent l'événement de soumission. Une erreur conserve le panier.

## Préparation et livraison

`OrderWorkflowService` conserve la préparation dans `carts.workflow`, séparément de l'instantané commercial initial (`order_headers` / `order_lines`). Les droits sur chaque ligne viennent du facturant et du commercial affectés au moment de la soumission, par base produits. Les modifications passent par un verrou de commande et une révision pour refuser les écrasements concurrents.

Les lignes d'origine conservent leurs prix et quantités commandées. Une quantité préparée à zéro retire le produit de l'expédition sans effacer son historique. Les produits ajoutés doivent être disponibles, achetables par le client et appartenir à une base déjà gérée par l'intervenant sur cette commande ; leur prix est calculé avec les services existants. Le transport enregistré est conservé : la préparation ne relance pas une cotation transport. Les remises initiales sont réparties sur les lignes ; les remises par base restent affectées à leur base. Les calculs de TVA et les totaux figurent dans chaque document.

La première version conserve une seule expédition et une seule confirmation de livraison pour toute la commande. Les livraisons séparées restent hors périmètre. Chaque facturant émet néanmoins sa facture pour ses propres lignes.

## Signalements et commentaires

Le client signale une quantité manquante ou abîmée après livraison. Un facturant ou commercial affecté à la ligne valide ou refuse, avec une explication. Les quantités des signalements en attente et validés ne peuvent pas dépasser la quantité expédiée. Une décision traitée ne peut pas être rejouée.

Tous les commentaires et décisions sont visibles par les intervenants autorisés. Les commentaires initiaux du client sont préservés ; les nouveaux commentaires enregistrent l'auteur, son rôle, la date et éventuellement le produit concerné.

## Documents et numérotation

Les documents `order_documents` contiennent une copie des lignes, coordonnées, commentaires et montants au moment de l'émission. Le PDF est téléchargeable depuis le suivi de commande, par les intervenants autorisés, pour transmission au client. Il n'existe pas de route de modification ou de suppression d'un document émis.

Avant facturation, les écarts validés réduisent les quantités facturées. Après facturation, les nouveaux écarts validés produisent un avoir rattaché à la facture initiale. Un nouvel avoir ne reprend pas les quantités déjà créditées. La clôture vérifie tous les signalements, les factures de chaque facturant et les avoirs restant à émettre.

Le modèle de numérotation appartient au facturant, pour tous ses clients. Variables : `%date%` (`AAAAMMJJ`), `%annee%`, `%ref_client%`, `%n°commande%` (alias `%numero_commande%`), `%compteur%` (six chiffres minimum, sans remise à zéro automatique). Le modèle par défaut est `%annee%-%compteur%`. Une référence client manquante, une variable inconnue ou un numéro déjà utilisé bloque l'émission. Le compteur est verrouillé et consommé dans la même transaction que la facture. Un changement de modèle ne renumérote aucun document existant.

Les indicateurs commerciaux existants continuent à lire les instantanés de commande initiaux ; cette évolution ne les transforme pas en journal de facturation.

## Installation et contrôles

Migration : `php artisan migrate --path=database/migrations/2026_10_25_120000_add_order_workflow.php`.

Tests métier : `php artisan test --compact tests/Feature/Http/Controllers/OrderWorkflowTest.php`.

Contrôles navigateur : `node tests/Browser/order-workflow.mjs` (Chrome/Puppeteer ; chemin configurable avec `PUPPETEER_EXECUTABLE_PATH`).
