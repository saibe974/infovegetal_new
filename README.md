# Infovegetal

Application Laravel 12 + Inertia + React/TypeScript + Vite.

- Authentification via Laravel Fortify
- UI React (Radix UI, Tailwind CSS v4)
- Import/Export CSV produits avec traitement en file (Queue/Job) et suivi de progression

## Installation rapide

Prérequis: PHP >= 8.2, Composer, Node.js >= 18, une base de données configurée dans `.env`.

0) Cloner le dépôt et entrer dans le dossier

```cmd
git clone https://github.com/saibe974/infovegetal_new.git
```

```cmd
cd infovegetal_new
```

1) Dépendances et clé d’application

```cmd
composer install
```

```cmd
copy .env.example .env
```

```cmd
php artisan key:generate
```

2) Configurer `.env` (DB, MAIL, etc.). Pour l’import CSV, activez une file:

```env
QUEUE_CONNECTION=database
```

3) Migrations et (si queue database) table de file

```cmd
php artisan queue:table
```

```cmd
php artisan migrate
```

4) Frontend

```cmd
npm install
```

```cmd
npm run dev
```

5) Lancer l’application et la file

```cmd
php artisan serve
```

Pour les import assurez-vous que le worker de queue tourne.
```cmd
php artisan queue:work
```



Build de prod:

```cmd
npm run build
```

Tests (optionnel):

```cmd
php artisan test
```
