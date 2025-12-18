# Infovegetal Copilot Instructions
- Laravel 12 backend with Fortify auth, Spatie Permission, and Inertia/React/TypeScript/Tailwind front-end; follow the onboarding steps in [README.md](README.md) before coding.
- Route helpers come from Wayfinder output under resources/js/wayfinder; regenerate after touching routes with `php artisan wayfinder:generate --with-form` to keep TS imports compiling.

## Architecture & Domains
- Public catalog and product detail pages live under [resources/js/pages/products](resources/js/pages/products) while admin CRUD routes are nested under `products.admin.*` in [routes/web.php](routes/web.php).
- Authorization uses `role:admin` gates on admin routes, so tests and seeders must assign that role (Spatie) before hitting controller actions.
- `Product` search/order logic relies on the reusable sorter scope in [app/Models/Traits/HasSortable.php](app/Models/Traits/HasSortable.php); prefer this trait when adding list endpoints to ensure consistent `sort`/`dir` request handling.
- Category management depends on the nested-set aware model in [app/Models/CategoryProducts.php](app/Models/CategoryProducts.php); keep left/right values intact when writing migrations or reorder handlers.

## Upload & Import Flow
- All uploads go through the single [app/Http/Controllers/UploadController.php](app/Http/Controllers/UploadController.php) entry: FilePond-style chunk traffic is detected via `Upload-*` headers and routed to [app/Services/ChunkUploadService.php](app/Services/ChunkUploadService.php), simple form posts fall back to [app/Services/FileUploadService.php](app/Services/FileUploadService.php).
- Both services persist files on the local `uploads` disk, attach them to the authenticated user, and seed a cache key `import:{id}` with `status`, `path`, and metadata; do not bypass this cache priming, because imports look up file paths there.
- Chunk assembly writes temporary pieces under `storage/app/chunks/{uploadId}` and merged CSVs under `storage/app/uploads`; always delete temp directories with `cleanupTempChunks()` if you introduce new early-return paths.

## Product Import Pipeline
- The admin import endpoints in [app/Http/Controllers/ProductController.php](app/Http/Controllers/ProductController.php) first stash `db_products_id` in cache, then call `ProductImportService::run()` to split the uploaded CSV into chunk files under `storage/app/imports/tmp/{id}`.
- [app/Services/ProductImportService.php](app/Services/ProductImportService.php) normalizes headers with `AsciiSlugger`, enforces presence of `sku`/`name`, and upserts products in batches of 100; progress, `next_offset`, `has_more`, and report URLs are all written to `Cache::put("import:{id}")`.
- Front-end chunk processing should call `products.admin.import.process` once, then poll `products.admin.import.progress` while repeatedly hitting `products.admin.import.process_chunk` until `has_more` is false; cancellation toggles the `import:{id}:cancel` flag and is respected mid-loop.
- Error rows are appended to `storage/app/imports/reports/{id}.csv`; `report` URLs disappear automatically when no errors remain, so UI must treat `null` as success.
- Source-specific mappings live in [app/Models/DbProducts.php](app/Models/DbProducts.php): `champs` maps CSV headers to canonical keys, `categories` stores slug→ID lookups, and `traitement` names a PHP file inside [app/Services/ProductImportTraitement](app/Services/ProductImportTraitement) that exposes `importProducts_{name}()` (see [app/Services/ProductImportTraitement/peplant.php](app/Services/ProductImportTraitement/peplant.php) for building composite SKUs and category slugs).
- Keep cache TTLs high enough (currently one hour) or imports will lose state between chunks; prefer Redis/memcached drivers in deployment.

## Data & Front-end Conventions
- `Product` includes `attributes` (JSON) and `price` casts in [app/Models/Product.php](app/Models/Product.php); respect these casts when mass-assigning or mutating via factories.
- Admin grids expect eager-loaded `category` and `tags` (see `index()` in ProductController), so new queries should use `with()` to avoid N+1 issues before sending data to Inertia resources like [app/Http/Resources/ProductResource.php](app/Http/Resources/ProductResource.php).
- Inertia bootstraps from [resources/js/app.tsx](resources/js/app.tsx) and resolves screens from `resources/js/pages`; keep filenames matching the route component name (e.g., `products/index`), otherwise the resolver will fail at runtime.
- Timeline/sticky UI elements rely on Radix UI, dnd-kit, and shadcn utilities already registered in [package.json](package.json); reuse these primitives rather than introducing new UI kits.

## Developer Workflows
- Preferred dev loop: `composer dev` starts `php artisan serve`, `php artisan queue:listen --tries=1`, and `npm run dev` concurrently; use `composer dev:ssr` when testing the SSR bridge (`npm run build:ssr` + `php artisan inertia:start-ssr`).
- Run `composer test` (wraps `php artisan test`) before shipping backend changes; frontend linting/formatting lives behind `npm run lint`, `npm run format`, and `npm run types`.
- Remember `php artisan storage:link` whenever uploads, imports, or media previews break, and keep `storage/app/imports/archive` tidy if you change file retention policies.
- Queue workers are still required for other jobs (see [app/Jobs/ImportProductsJob.php](app/Jobs/ImportProductsJob.php) legacy implementation), so scripts and docs should mention `queue:listen` even if the new import service runs synchronously.
