<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Infovegetal - Images</title>

         @php
            $theme = request()->query('theme') === 'dark' ? 'dark' : 'light';
        @endphp

        <style>
            body {
                margin: 0;
                font-family: Segoe UI, Arial, sans-serif;
                background: {{ $theme === 'dark' ? '#0f172a' : '#f8fafc' }};
                color: {{ $theme === 'dark' ? '#e2e8f0' : '#0f172a' }};
            }
            .wrap {
                padding: 16px;
            }
            .header {
                display: flex;
                gap: 12px;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
                flex-wrap: wrap;
            }
            .search {
                display: flex;
                gap: 8px;
            }
            input[type='text'] {
                padding: 8px 10px;
                min-width: 240px;
                border-radius: 8px;
                border: 1px solid {{ $theme === 'dark' ? '#334155' : '#cbd5e1' }};
                background: {{ $theme === 'dark' ? '#1e293b' : '#ffffff' }};
                color: inherit;
            }
            button {
                padding: 8px 12px;
                border-radius: 8px;
                border: 1px solid {{ $theme === 'dark' ? '#334155' : '#cbd5e1' }};
                background: {{ $theme === 'dark' ? '#1e293b' : '#ffffff' }};
                color: inherit;
                cursor: pointer;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                background: {{ $theme === 'dark' ? '#111827' : '#ffffff' }};
                border: 1px solid {{ $theme === 'dark' ? '#334155' : '#e2e8f0' }};
                border-radius: 10px;
                overflow: hidden;
            }
            th, td {
                text-align: left;
                padding: 10px;
                border-bottom: 1px solid {{ $theme === 'dark' ? '#1f2937' : '#f1f5f9' }};
                font-size: 14px;
            }
            th {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: .04em;
                opacity: .85;
            }
            .muted {
                opacity: .75;
            }
            .thumb {
                width: 56px;
                height: 56px;
                object-fit: cover;
                border-radius: 6px;
                border: 1px solid {{ $theme === 'dark' ? '#334155' : '#e2e8f0' }};
                background: {{ $theme === 'dark' ? '#1e293b' : '#f8fafc' }};
            }
            .pagination {
                margin-top: 12px;
            }
            .pagination nav > div:first-child {
                display: none;
            }
            .pagination a,
            .pagination span {
                font-size: 13px;
            }
        </style>
    </head>
    <body>
        <div class="wrap">
            <div class="header">
                <h1 style="margin:0; font-size: 20px;">Images manquantes</h1>
                <form method="GET" class="search">
                    <input type="hidden" name="theme" value="{{ $theme }}">
                    <input type="text" name="q" placeholder="Rechercher par nom ou SKU" value="{{ $q ?? '' }}">
                    <button type="submit">Rechercher</button>
                </form>
            </div>

            <p class="muted" style="margin: 0 0 10px 0;">
                {{ $products->total() }} produit(s) sans image locale
            </p>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Vignette</th>
                        <th>SKU</th>
                        <th>Nom</th>
                        <th>DB</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($products as $product)
                        <tr>
                            <td>{{ $product->id }}</td>
                            <td>
                                <img
                                    src="{{ $product->img_link }}"
                                    alt="{{ $product->name }}"
                                    class="thumb"
                                    loading="lazy"
                                    referrerpolicy="no-referrer"
                                >
                            </td>
                            <td>{{ $product->sku ?: '-' }}</td>
                            <td>{{ $product->name }}</td>
                            <td>{{ $product->dbProduct?->name ?: '-' }}</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="5" class="muted">Aucun produit trouvé.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>

            <div class="pagination">
                {{ $products->links() }}
            </div>
        </div>
    </body>
</html>