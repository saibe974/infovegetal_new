# Infovegetal

Application Laravel 12 + Inertia + React/TypeScript + Vite.

- Authentification via Laravel Fortify
- UI React (Radix UI, Tailwind CSS v4)
- Import/Export CSV produits avec traitement en file (Queue/Job) et suivi de progression

## Installation rapide

Prérequis: PHP >= 8.2, Composer, Node.js >= 18, une base de données configurée dans `.env`.

0) Cloner le dépôt et configurer .env
```env
APP_NAME=Infovegetal
```
...

1) Dépendances et clé d’application

```cmd
composer install
```

```cmd
php artisan key:generate
```

2) Migrations et seeders

```cmd
php artisan migrate
```

```cmd
php artisan db:seed
```

3) Frontend

```cmd
php artisan wayfinder:generate --with-form
```

```cmd
npm install
```

5) Lancer l’application

```cmd
php artisan serve
```

```cmd
npm run dev
```

Commandes utiles :
- pour lier le storage :
```cmd
php artisan storage:link
```
