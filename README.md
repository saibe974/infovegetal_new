# Infovegetal

Application Laravel pour Infovégétal.

## Description

Ce dépôt contient une application Laravel (backend+ Inertia/Shadcn + frontend Vite/React/Tailwind).
Tu pourras via une commande Artisan `products:import`, importer des produits tests depuis un CSV situé par défaut dans `storage/imports/`.

## Pré-requis

- PHP 8.1+ (suivant la configuration du projet)
- Composer
- Node 18+ et npm / pnpm / yarn
- Une base de données configurée (MySQL, Postgres...)

## Installation

1. Clone le dépôt:

```
git clone https://github.com/saibe974/infovegetal_new.git
```

2. Installe les dépendances PHP:

```
composer install
```

3. Copie le `.env` et configure la base:

```
cp .env.example .env
```

    # Édite .env (DB, APP_URL, etc.)

4. Génère la clé:

```
php artisan key:generate
```

5. Installe les dépendances JS et lance Vite:

```
npm install
```

```
npm run dev
```

6. Lance les migrations:

```
php artisan migrate
```

## Importer le CSV de produits

Par défaut le CSV attendu se trouve dans `storage/imports/vegetal_produits_extrait.csv`.

La commande fournie :

```
php artisan products:import --dry-run
```

Options utiles:

- `--file` : chemin vers le fichier CSV (par défaut `storage/imports/vegetal_produits_extrait.csv`).
- `--dry-run` : ne fait pas de persistance, affiche ce qui serait inséré.
- `--batch=1000` : taille des lots pour l'upsert.

La commande fait un upsert sur la colonne `sku` et met à jour `name, description, img_link, price, active, attributes`.

## Tests

Le projet utilise Pest/PHPUnit (vérifie `phpunit.xml`/`tests/`). Lance les tests PHP :

```
php artisan test
```

## Développement frontend

- Lancer Vite en dev:

```
npm run dev
```

- Builder pour production:

```
npm run build
```

## Contribuer

- Ouvre une branche feature/description et crée une PR.
- Respecte la convention de commit et exécute `npm run lint` et `composer test` avant PR.

## Aide

Pour toute question ou problème, crée une issue dans le dépôt ou contacte l'équipe technique.
