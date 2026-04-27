<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="csrf-token" content="{{ csrf_token() }}">
        <title>Infovegetal - Images</title>

         @php
            $theme = request()->query('theme') === 'dark' ? 'dark' : 'light';
            $currentSort = $sort ?? 'name';
            $currentDir = $dir ?? 'asc';
            $nextDbDir = $currentSort === 'db' && $currentDir === 'asc' ? 'desc' : 'asc';
            $dbSortIcon = $currentSort === 'db' ? ($currentDir === 'asc' ? '↑' : '↓') : '↕';
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
            .toolbar {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
                margin: 8px 0 12px;
            }
            .btn-sm {
                padding: 5px 8px;
                font-size: 12px;
            }
            .status {
                font-size: 12px;
                opacity: .85;
            }
            .progress {
                width: 100%;
                height: 8px;
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
            .sort-link {
                color: inherit;
                text-decoration: none;
            }
            .sort-link:hover {
                text-decoration: underline;
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
            tr.is-processing {
                outline: 1px solid {{ $theme === 'dark' ? '#334155' : '#cbd5e1' }};
                background: {{ $theme === 'dark' ? '#0b1220' : '#f8fafc' }};
            }
            tr.is-ok {
                background: {{ $theme === 'dark' ? '#0f2a1f' : '#ecfdf5' }};
            }
            tr.is-error {
                background: {{ $theme === 'dark' ? '#3a1616' : '#fef2f2' }};
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
                <!-- <h1 style="margin:0; font-size: 20px;">Images manquantes</h1> -->
                <form method="GET" class="search">
                    <input type="hidden" name="theme" value="{{ $theme }}">
                    <input type="hidden" name="sort" value="{{ $currentSort }}">
                    <input type="hidden" name="dir" value="{{ $currentDir }}">
                    <input type="text" name="q" placeholder="Rechercher par nom ou SKU" value="{{ $q ?? '' }}">
                    <button type="submit">Rechercher</button>
                </form>
            </div>

            <p class="muted" style="margin: 0 0 10px 0;">
                {{ $products->total() }} produit(s) sans image locale
            </p>

            <div class="toolbar">
                <button type="button" id="btn-batch-download">Tout telecharger (page)</button>
                <button type="button" id="btn-batch-thumbnail">Creer vignettes (page)</button>
                <button type="button" id="btn-batch-compare">Comparer (page)</button>
                <span class="status" id="batch-status">Pret</span>
            </div>
            <progress class="progress" id="batch-progress" max="100" value="0"></progress>

            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Vignette</th>
                        <th>SKU</th>
                        <th>Nom</th>
                        <th>
                            <a
                                href="{{ request()->fullUrlWithQuery(['sort' => 'db', 'dir' => $nextDbDir]) }}"
                                class="sort-link"
                                title="Trier par DB"
                            >
                                DB {{ $dbSortIcon }}
                            </a>
                        </th>
                        <th>Actions</th>
                        <th>Etat</th>
                    </tr>
                </thead>
                <tbody>
                    @forelse ($products as $product)
                        <tr data-product-id="{{ $product->id }}" data-product-img-link="{{ $product->img_link }}">
                            <td>{{ $product->id }}</td>
                            <td>
                                <img
                                    src="{{ $product->img_link }}"
                                    alt="{{ $product->name }}"
                                    class="thumb"
                                    loading="lazy"
                                    referrerpolicy="no-referrer"
                                    onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2256%22><rect width=%2256%22 height=%2256%22 fill=%22%23cbd5e1%22/><text x=%2228%22 y=%2232%22 font-size=%2210%22 text-anchor=%22middle%22 fill=%22%2364748b%22>NO IMG</text></svg>'"
                                >
                            </td>
                            <td>{{ $product->sku ?: '-' }}</td>
                            <td>{{ $product->name }}</td>
                            <td>{{ $product->dbProduct?->name ?: '-' }}</td>
                            <td>
                                <button type="button" class="btn-sm js-action" data-action="download">Upload</button>
                                <button type="button" class="btn-sm js-action" data-action="thumbnail">Vignette</button>
                                <button type="button" class="btn-sm js-action" data-action="compare">Comparer</button>
                                <button type="button" class="btn-sm js-action" data-action="removeMissingImgLink">Suppr. img_link</button>
                            </td>
                            <td class="status js-row-status">-</td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="7" class="muted">Aucun produit trouvé.</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>

            <div class="pagination">
                {{ $products->links() }}
            </div>
        </div>
        <script>
            (() => {
                const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                const endpointByAction = {
                    download: '/admin/media-manager/images/action/download',
                    thumbnail: '/admin/media-manager/images/action/thumbnail',
                    compare: '/admin/media-manager/images/action/compare',
                    removeMissingImgLink: '/admin/media-manager/images/action/remove-missing-img-link',
                };

                const statusEl = document.getElementById('batch-status');
                const progressEl = document.getElementById('batch-progress');

                const setBatchStatus = (text) => {
                    if (statusEl) statusEl.textContent = text;
                };

                const setRowState = (row, state, text) => {
                    row.classList.remove('is-processing', 'is-ok', 'is-error');
                    if (state) row.classList.add(state);
                    const status = row.querySelector('.js-row-status');
                    if (status) status.textContent = text || '-';
                };

                const callAction = async (row, action) => {
                    const id = Number(row.dataset.productId || 0);
                    if (!id || !endpointByAction[action]) return { ok: false, message: 'Action invalide' };

                    setRowState(row, 'is-processing', 'Traitement...');

                    const response = await fetch(endpointByAction[action], {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                            'X-CSRF-TOKEN': token,
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                        body: JSON.stringify({ id }),
                    });

                    const payload = await response.json().catch(() => ({ ok: false, message: 'Reponse invalide' }));
                    if (!response.ok) {
                        return { ok: false, message: payload?.message || 'Erreur serveur' };
                    }

                    return payload;
                };

                const runBatch = async (action) => {
                    const rows = Array.from(document.querySelectorAll('tr[data-product-id]'));
                    if (!rows.length) return;

                    let ok = 0;
                    let fail = 0;
                    progressEl.value = 0;
                    progressEl.max = rows.length;

                    for (let i = 0; i < rows.length; i += 1) {
                        const row = rows[i];
                        setBatchStatus(`${action} ${i + 1}/${rows.length}...`);

                        try {
                            const result = await callAction(row, action);
                            if (result.ok) {
                                ok += 1;
                                setRowState(row, 'is-ok', result.message || 'OK');
                                if (result.thumb_url) {
                                    const img = row.querySelector('.thumb');
                                    if (img) img.src = result.thumb_url;
                                }
                                if (action === 'download' || action === 'removeMissingImgLink') {
                                    row.remove();
                                }
                            } else {
                                fail += 1;
                                setRowState(row, 'is-error', result.message || 'Erreur');
                            }
                        } catch (e) {
                            fail += 1;
                            setRowState(row, 'is-error', 'Erreur reseau');
                        }

                        progressEl.value = i + 1;
                    }

                    setBatchStatus(`Termine: ${ok} OK, ${fail} erreur(s)`);
                };

                document.querySelectorAll('.js-action').forEach((btn) => {
                    btn.addEventListener('click', async () => {
                        const row = btn.closest('tr[data-product-id]');
                        if (!row) return;

                        const action = btn.dataset.action;
                        setBatchStatus(`Action ${action}...`);
                        try {
                            const result = await callAction(row, action);
                            if (result.ok) {
                                setRowState(row, 'is-ok', result.message || 'OK');
                                if (result.thumb_url) {
                                    const img = row.querySelector('.thumb');
                                    if (img) img.src = result.thumb_url;
                                }
                                if (action === 'download' || action === 'removeMissingImgLink') {
                                    row.remove();
                                }
                                setBatchStatus(result.message || 'OK');
                            } else {
                                setRowState(row, 'is-error', result.message || 'Erreur');
                                setBatchStatus(result.message || 'Erreur');
                            }
                        } catch (e) {
                            setRowState(row, 'is-error', 'Erreur reseau');
                            setBatchStatus('Erreur reseau');
                        }
                    });
                });

                document.getElementById('btn-batch-download')?.addEventListener('click', () => runBatch('download'));
                document.getElementById('btn-batch-thumbnail')?.addEventListener('click', () => runBatch('thumbnail'));
                document.getElementById('btn-batch-compare')?.addEventListener('click', () => runBatch('compare'));
            })();
        </script>
    </body>
</html>