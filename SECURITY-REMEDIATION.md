# Correctifs de sécurité locaux — 4 novembre 2026

## Périmètre

Laravel 12 uniquement. Aucun push, déploiement, accès à la production, migration de schéma sur une base persistante ou reprise des données réelles. Le dépôt était propre au début du travail. Les nouvelles écritures de documents et imports sont privées ; les anciens fichiers encore présents dans le stockage public sont bloqués par Apache. La reprise des données est préparée et testée, pas appliquée à la base réelle.

## Lot 1 : Apache Laragon

- `C:/laragon/etc/apache2/sites-enabled/00-default.conf` refuse les accès au vhost par défaut sur les ports 80 et 443, au lieu de servir `D:/clients`.
- Le vhost du projet conserve `DocumentRoot D:/clients/infovegetal.new/public`. Ses règles interdisent les documents/imports et extensions exécutables dans la jonction Windows `public/storage`, désactivent ses `.htaccess` et interdisent les chemins sensibles.
- Le fichier actif est maintenant `C:/laragon/etc/apache2/sites-enabled/infovegetal.new.test.conf`. Le préfixe `auto.` a été retiré pour éviter sa régénération par Laragon, conformément à sa [documentation](https://laragon.org/docs/pretty-urls).
- `public/.htaccess` ajoute les refus de `/storage/imports`, `/storage/commandes`, des documents personnels et des extensions exécutables sous `/storage`, ainsi que `.env` et `.git`.

Sauvegardes initiales : `%TEMP%/infovegetal-security-apache-20261104-001431/`, avec copie durable dans `ops/laragon/backup-before-20261104/`. Les configurations corrigées sont dans `ops/laragon/`.

Vérifications HEAD sans lecture de secret : `.env`, `.git/HEAD` et locks refusés par le hostname prévu, localhost, 127.0.0.1 et un hostname inconnu ; témoin public 200 sur le bon vhost ; témoins d'import et de script `*.php.txt` 403 ; ancienne URL personnelle 403 ; favicon de `infovegetal.neo.test` 200. Syntaxe Apache valide. Les témoins ont été supprimés. Le port 443 écouté par Laragon est aussi protégé par défaut ; aucun vhost HTTPS du projet n'a été créé.

Le projet utilise PHP 8.3.26 via FastCGI, confirmé par un témoin temporaire retournant `X-Diagnostic-PHP`. Les autres sites gardent leur gestionnaire mod_php 8.5.11. Le header générique `Server` peut encore annoncer PHP 8.5.11 et ne mesure donc pas le runtime du projet. Composer utilise PHP 8.3.26. La CI utilise PHP 8.4 ; le script de déploiement référence PHP 8.3, mais la version réelle de production reste à confirmer. PhpSpreadsheet 1.30.x exige PHP < 8.5.

Retour arrière : retirer le vhost manuel, restaurer les deux configurations sauvegardées sous leurs noms originaux, vérifier `httpd -t`, puis relancer Apache avec ses arguments Laragon. Cela réintroduit les anciennes expositions ; réserver cette opération à un environnement isolé.

## Lot 2 : documents et uploads

Les nouveaux documents et exports de commande sont écrits sur le disque `local`, racine `storage/app/private`, et servis par `OrderFileController` avec les contrôles métier existants. Le contrôleur accepte les anciennes références `public` pendant la reprise, mais leurs URL statiques sont refusées. La route automatique du disque privé est désactivée. La règle d'accès administrateur aux PDF de commande n'a pas changé.

Les imports sont privés sous `imports/{owner_id}/{uuid}.{extension}` : CSV, TSV, XLS, XLSX uniquement, avec contrôle du contenu côté serveur, maximum 100 Mio et morceaux de 2 Mio maximum. Un transfert comporte propriétaire, longueur, position et expiration d'une heure. Chaque opération valide son identifiant et son propriétaire ; les positions incohérentes et les morceaux d'un autre utilisateur sont refusés. Une réponse finale perdue peut être redemandée sans créer un second fichier. Les endpoints d'import et de rapport vérifient aussi le propriétaire du fichier. Les transferts incomplets de l'ancien protocole doivent être recommencés.

elFinder autorise seulement JPEG/PNG/GIF/WebP jusqu'à 10 Mio. Création/édition de texte, extraction d'archive et montage réseau sont désactivés. Les médias volontairement publics restent publics. Les extensions de scripts sont refusées par le serveur, indépendamment du contrôle MIME.

### Reprise locale préparée

Sauvegarder la base et les fichiers, puis suspendre les imports et générations de documents pendant la reprise. Ne pas lancer simultanément une reprise et des écritures applicatives. La commande refuse `--apply` hors des environnements `local` et `testing`.

```powershell
php artisan security:privatize-files --run=local-security
php artisan security:privatize-files --run=local-security --apply
php artisan security:privatize-files --run=local-security --apply --rollback
```

La simulation inventorie sans afficher de nom ni de contenu. L'application crée un journal privé `storage/app/private/security-migration/{run}.json`, copie les fichiers en streaming, vérifie SHA-256, met à jour les références `files`/médias historiques de commandes et retire uniquement les sources publiques vérifiées. Sont concernés : `imports`, `commandes`, les sous-dossiers personnels `commandes` et les médias portant `source=cart-tcpdf`. Les logos et images produit sont exclus. Les fichiers orphelins de ces dossiers sont mis à l'abri sans leur attribuer un propriétaire.

Une relance avec le même identifiant reprend le même inventaire. Employer un nouvel identifiant pour un nouveau lot. Une destination différente ou une référence modifiée provoque un arrêt sans écrasement. Le retour arrière vérifie les empreintes, restaure les références et conserve la copie privée ; il ne retire pas les interdictions HTTP. Conserver les journaux privés. Les historiques sans attribution restent à examiner via la procédure historique `orders:migrate-files`, sans élargir automatiquement leurs droits.

Tests ciblés : utilisateur autorisé/non autorisé, fichiers interdits, taille, identifiants, positions, morceaux d'un autre utilisateur, protocole FilePond réel, reprise répétée, intégrité, conflits, retour arrière et préservation des images publiques, y compris voisines d'un document historique MediaLibrary.

Retour arrière du code : après sauvegarde, remettre les références avec la commande de rollback si une reprise a été appliquée, puis retirer uniquement le diff de ce lot. Ne pas restaurer le code ancien avant les références. Conserver les protections HTTP tant que des documents restent sur le disque public.

## Lot 3 : dépendances

Les mises à jour Composer sont ciblées avec `--minimal-changes`, sans scripts Artisan. Seulement sept packages changent dans le lock : Laravel 12.71.0, CommonMark 2.10.7, Excel 3.1.70, PhpSpreadsheet 1.30.7 et Symfony HTTP Foundation/Mime/YAML 7.4.22. Audit Composer final : zéro avis et zéro package abandonné. `composer.json` conserve Laravel `^12.0`.

Versions npm notamment corrigées : Vite 7.3.7, Axios 1.21.0, follow-redirects 1.16.2, shell-quote 1.12.0, Puppeteer 25.16.0, shadcn 4.23.0. shadcn est un CLI non importé par l'application ; il passe en dépendance de développement. Aucun générateur n'a été exécuté ; le CLI affiche bien sa version. Ni `--ignore-platform-reqs` ni `npm audit fix --force` n'ont été utilisés. L'installation npm a utilisé `npm ci --ignore-scripts`.

Audit npm final : 18 packages signalés, 16 modérés et 2 faibles, aucun élevé/critique. `npm audit --omit=dev --package-lock-only` : zéro. Les deux avis sous-jacents restants concernent minimatch < 11.0.1 et deepmerge 4.2.0–4.3.1. Aucun override majeur n'est forcé sur les outils qui attendent l'ancienne API de minimatch.

Liste restante : `@eslint-community/eslint-utils`, `@eslint/config-array`, `@eslint/eslintrc`, `@shadcn/registry`, `@ts-morph/common`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `@typescript-eslint/type-utils`, `@typescript-eslint/typescript-estree`, `@typescript-eslint/utils`, `deepmerge`, `eslint`, `eslint-config-prettier`, `eslint-plugin-react`, `minimatch`, `shadcn`, `ts-morph`, `typescript-eslint`.

Retour arrière : restaurer uniquement `composer.lock`, `package.json`, `package-lock.json` de ce lot puis réinstaller avec `composer install --no-scripts` et `npm ci --ignore-scripts`. Cela réintroduit les avis corrigés ; conserver les protections d'accès.

## Référence et vérifications

Les tests utilisent une copie temporaire sans `.env` réel, SQLite `:memory:`, aucune URL de base ni configuration en cache. Les exécutions de suites doivent être séquentielles car `Storage::fake` partage ses dossiers par défaut.

Référence initiale : 578 succès, 2 échecs, 2 723 assertions sous PHP 8.3.26.

Résultat final sur 590 tests :

| Environnement | Succès | Échecs | Dépréciations | Assertions | Durée |
|---|---:|---:|---:|---:|---:|
| PHP 8.3.26, 512 Mio | 588 | 2 | 0 | 2 785 | 31,79 s |
| PHP 8.4.15, 512 Mio | 585 | 2 | 3 | 2 785 | 28,57 s |

Les dix nouveaux tests de sécurité passent. Les deux échecs sont les mêmes que dans la référence. Les tests ont été rejoués séquentiellement après une première interférence entre deux exécutions partageant les dossiers `Storage::fake`. Le contrôle final `git diff --check` passe, et Pint a été appliqué aux seuls fichiers PHP du correctif.

- `CarrierZonesImportTest.php:47` attend `Zones importées.` tandis que la locale de test renvoie `Zones imported.`. Aucune assertion neutralisée.
- `OrderDocumentServiceTest.php:49` attend 404 pour l'administrateur sur le PDF de commande ; `OrderAccessRegressionTest` exige explicitement 200. Le contrôleur conserve ce dernier comportement en attendant une décision métier.
- PHP 8.4 signale aussi trois dépréciations préexistantes dans `tests/Unit/Services/OrderCsvServiceTest.php` : appels de `str_getcsv` sans argument `escape` explicite. La première exécution PHP 8.4, à 128 Mio, a manqué de mémoire sur un test XLSX avec images ; la vérification suivante utilise 512 Mio, comme le PHP 8.3 habituel. Aucun plafond applicatif n'est modifié.
- Types TypeScript et build Vite réussis dans la copie, avec `--configLoader runner` pour contourner une restriction de lecture du sandbox. Le gros chunk déjà signalé reste un sujet de performance distinct.

## Inventaire des fichiers

- Lot 1 : configurations locales Apache, copies et sauvegardes `ops/laragon/`, `public/.htaccess`.
- Lot 2 : services `OrderDocumentService`, `OrderCsvService`, `FileUploadService`, `ChunkUploadService`, `ImportUploadPolicy` ; contrôleurs `OrderFileController`, `UploadController` ; middleware `EnsureImportOwner` ; routes produits/utilisateurs ; configurations filesystems/elFinder/uploads ; commande `PrivatizeFiles` ; tests associés. La documentation locale existante `docs/order-files-storage.md` a aussi été mise à jour, mais ce dossier est ignoré par Git ; ce compte rendu à la racine est révisable avec le code.
- Lot 3 : `composer.lock`, `package.json`, `package-lock.json`.
