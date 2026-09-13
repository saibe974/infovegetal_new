import { MissingImagesFailuresDetails } from '@/components/media/missing-images-failures-details';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { StickyBar } from '@/components/ui/sticky-bar';
import { withAppLayout } from '@/layouts/app-layout';
import {
    getPreferenceScope,
    getStoredDisplayPreferences,
    persistCartConfirmationPreference,
} from '@/lib/display-preferences';
import { useI18n } from '@/lib/i18n';
import type { BreadcrumbItem, SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    CheckCircle2,
    Download,
    ExternalLink,
    GitCompareArrows,
    ImageOff,
    Loader2,
    Pause,
    Play,
    RefreshCw,
    Search,
    Square,
    Trash2,
} from 'lucide-react';
import {
    type FormEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Media library', href: '/admin/media-manager' },
    { title: 'Missing images', href: '/products/images' },
];

type Option = { id: number; name: string };
type MissingImage = {
    id: number;
    sku: string | null;
    ref: string | null;
    name: string;
    source_url: string;
    db_name: string | null;
    category_name: string | null;
    local_url: string | null;
    thumb_url: string | null;
    missing_reason: 'no_media' | 'missing_file' | 'ok';
};
type Filters = {
    q: string;
    db_products_id: number | null;
    category_products_id: number | null;
};
type ItemsResponse = {
    items: MissingImage[];
    next_cursor: number | null;
    has_more: boolean;
    total: number | null;
};
type ActionResponse = {
    ok: boolean;
    message?: string;
    downloaded?: boolean;
    http_status?: number | null;
    same?: boolean;
    reason?: string | null;
    thumb_url?: string | null;
    product?: MissingImage;
};
type RunFailure = { id: number; message: string; product?: MissingImage };
type CompareOutcome = 'identical' | 'different' | 'no_remote' | 'error';
type CompareOutcomeFilter = 'all' | CompareOutcome | 'refreshed';
type CompareResult = {
    id: number;
    name: string;
    sku: string | null;
    ref: string | null;
    source_url: string;
    local_url: string | null;
    thumb_url: string | null;
    db_name: string | null;
    category_name: string | null;
    outcome: CompareOutcome;
    message: string;
    refreshed?: boolean;
};
type CompareItemsResponse = {
    items: Array<{ id: number }>;
    next_cursor: number | null;
    has_more: boolean;
    total: number | null;
};
type CompareState = {
    version: 1;
    status: RunStatus;
    filters: Filters;
    cursor: number;
    pending: number[];
    total: number | null;
    processed: number;
    identical: number;
    different: number;
    no_remote: number;
    error: number;
    refreshed: number;
    img_links_removed: number;
    results: CompareResult[];
};
type MissingImageConfirmationRequest =
    | {
          kind: 'removeMissingImageLink';
          failure: RunFailure;
      }
    | {
          kind: 'removeSingleItemMissingImageLink';
          item: MissingImage;
      }
    | {
          kind: 'removeAllMissingImageLinks';
          failures: RunFailure[];
      };
type RunStatus =
    | 'idle'
    | 'running'
    | 'paused'
    | 'cancelling'
    | 'completed'
    | 'stopped';
type RunState = {
    version: 1;
    status: RunStatus;
    filters: Filters;
    cursor: number;
    pending: number[];
    total: number | null;
    processed: number;
    downloaded: number;
    failed: number;
    failures: RunFailure[];
};
type MissingImagesPageProps = { dbProducts: Option[]; categories: Option[] };

const STORAGE_KEY = 'infovegetal:missing-images:run:v1';
const COMPARE_STORAGE_KEY = 'infovegetal:missing-images:compare:v1';
const COMPARE_RESULT_LIMIT = 300;
const EMPTY_FILTERS: Filters = {
    q: '',
    db_products_id: null,
    category_products_id: null,
};
const emptyRun = (filters: Filters = EMPTY_FILTERS): RunState => ({
    version: 1,
    status: 'idle',
    filters: { ...filters },
    cursor: 0,
    pending: [],
    total: null,
    processed: 0,
    downloaded: 0,
    failed: 0,
    failures: [],
});

function sameFilters(first: Filters, second: Filters): boolean {
    return (
        first.q === second.q &&
        first.db_products_id === second.db_products_id &&
        first.category_products_id === second.category_products_id
    );
}

function restoreRun(): RunState {
    if (typeof window === 'undefined') return emptyRun();
    try {
        const parsed = JSON.parse(
            localStorage.getItem(STORAGE_KEY) || 'null',
        ) as RunState | null;
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.pending))
            return emptyRun();
        if (parsed.status === 'cancelling' || parsed.status === 'stopped')
            return emptyRun();
        return {
            ...parsed,
            status: parsed.status === 'running' ? 'paused' : parsed.status,
            pending: parsed.pending.filter(
                (id) => Number.isInteger(id) && id > 0,
            ),
            failures: Array.isArray(parsed.failures) ? parsed.failures : [],
        };
    } catch {
        return emptyRun();
    }
}

const emptyCompare = (filters: Filters = EMPTY_FILTERS): CompareState => ({
    version: 1,
    status: 'idle',
    filters: { ...filters },
    cursor: 0,
    pending: [],
    total: null,
    processed: 0,
    identical: 0,
    different: 0,
    no_remote: 0,
    error: 0,
    refreshed: 0,
    img_links_removed: 0,
    results: [],
});

function restoreCompare(): CompareState {
    if (typeof window === 'undefined') return emptyCompare();
    try {
        const parsed = JSON.parse(
            localStorage.getItem(COMPARE_STORAGE_KEY) || 'null',
        ) as CompareState | null;
        if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.pending))
            return emptyCompare();
        if (parsed.status === 'cancelling' || parsed.status === 'stopped')
            return emptyCompare();
        return {
            ...parsed,
            status: parsed.status === 'running' ? 'paused' : parsed.status,
            pending: parsed.pending.filter(
                (id) => Number.isInteger(id) && id > 0,
            ),
            results: Array.isArray(parsed.results) ? parsed.results : [],
            refreshed: Number.isInteger(parsed.refreshed)
                ? parsed.refreshed
                : 0,
            img_links_removed: Number.isInteger(parsed.img_links_removed)
                ? parsed.img_links_removed
                : 0,
        };
    } catch {
        return emptyCompare();
    }
}

function compareOutcome(result: ActionResponse): {
    outcome: CompareOutcome;
    message: string;
} {
    if (!result.ok) {
        if (
            result.reason === 'remote_unreachable' ||
            result.reason === 'invalid_url'
        ) {
            return {
                outcome: 'no_remote',
                message: result.message || 'Image distante inaccessible',
            };
        }
        return {
            outcome: 'error',
            message: result.message || 'Comparaison impossible',
        };
    }

    return result.same
        ? {
              outcome: 'identical',
              message: result.message || 'Images identiques',
          }
        : {
              outcome: 'different',
              message: result.message || 'Images différentes',
          };
}

function csrfToken(): string {
    return (
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
            ?.content || ''
    );
}

function filtersQuery(
    filters: Filters,
    after: number,
    limit: number,
    withTotal = false,
): string {
    const params = new URLSearchParams({
        after: String(after),
        limit: String(limit),
    });
    if (filters.q.trim()) params.set('q', filters.q.trim());
    if (filters.db_products_id)
        params.set('db_products_id', String(filters.db_products_id));
    if (filters.category_products_id)
        params.set(
            'category_products_id',
            String(filters.category_products_id),
        );
    if (withTotal) params.set('with_total', '1');
    return params.toString();
}

async function fetchItems(
    filters: Filters,
    after: number,
    limit: number,
    withTotal = false,
    signal?: AbortSignal,
): Promise<ItemsResponse> {
    const response = await fetch(
        `/products/images/items?${filtersQuery(filters, after, limit, withTotal)}`,
        {
            headers: { Accept: 'application/json' },
            signal,
        },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload)
        throw new Error(
            payload?.message || 'Impossible de charger les images.',
        );
    return payload as ItemsResponse;
}

async function fetchCompareItems(
    filters: Filters,
    after: number,
    limit: number,
    withTotal = false,
    signal?: AbortSignal,
): Promise<CompareItemsResponse> {
    const response = await fetch(
        `/products/images/compare-items?${filtersQuery(filters, after, limit, withTotal)}`,
        {
            headers: { Accept: 'application/json' },
            signal,
        },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload)
        throw new Error(
            payload?.message || 'Impossible de charger la comparaison.',
        );
    return payload as CompareItemsResponse;
}

async function postAction(
    path: string,
    id: number,
    extra: Record<string, unknown> = {},
    signal?: AbortSignal,
): Promise<ActionResponse> {
    const response = await fetch(path, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': csrfToken(),
            'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ id, ...extra }),
        signal,
    });
    const payload = await response
        .json()
        .catch(() => ({ ok: false, message: 'Réponse invalide' }));
    if (!response.ok) throw new Error(payload?.message || 'Erreur serveur');
    return payload as ActionResponse;
}

function withHttpStatus(message: string, httpStatus?: number | null): string {
    if (typeof httpStatus !== 'number') {
        return message;
    }

    const normalizedMessage = message.replace(/\s*\(\d{3}\)\s*$/, '');

    return `erreur ${httpStatus} : ${normalizedMessage}`;
}

function ImagePreview({ src, label }: { src: string | null; label: string }) {
    const [broken, setBroken] = useState(false);
    useEffect(() => setBroken(false), [src]);

    return (
        <div className="min-w-0 flex-1">
            <p className="mb-1 text-center text-xs font-medium text-muted-foreground">
                {label}
            </p>
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                {src && !broken ? (
                    <img
                        src={src}
                        alt={label}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain"
                        onError={() => setBroken(true)}
                    />
                ) : (
                    <ImageOff className="h-8 w-8 text-muted-foreground/60" />
                )}
            </div>
        </div>
    );
}

export default withAppLayout<MissingImagesPageProps>(
    breadcrumbs,
    true,
    ({ dbProducts, categories }) => {
        const { t } = useI18n();
        const { appearancePreferences } = usePage<SharedData>().props;
        const [run, setRun] = useState<RunState>(restoreRun);
        const restoredFilters = run.filters;
        const [draftFilters, setDraftFilters] = useState<Filters>(() => ({
            ...restoredFilters,
        }));
        const [filters, setFilters] = useState<Filters>(() => ({
            ...restoredFilters,
        }));
        const [items, setItems] = useState<MissingImage[]>([]);
        const [cursor, setCursor] = useState(0);
        const [hasMore, setHasMore] = useState(false);
        const [total, setTotal] = useState<number | null>(null);
        const [loading, setLoading] = useState(true);
        const [loadError, setLoadError] = useState<string | null>(null);
        const [actionStates, setActionStates] = useState<
            Record<number, string>
        >({});
        const [failureActions, setFailureActions] = useState<
            Record<number, 'retry' | 'remove'>
        >({});
        const [isBulkRemovingFailures, setIsBulkRemovingFailures] =
            useState(false);
        const [refreshKey, setRefreshKey] = useState(0);
        const [showCompletionSummary, setShowCompletionSummary] =
            useState(false);
        const [globalCardDismissed, setGlobalCardDismissed] = useState(false);
        const [isGlobalCardSticky, setIsGlobalCardSticky] = useState(false);
        const [confirmMissingImageLink, setConfirmMissingImageLink] = useState(
            () =>
                getStoredDisplayPreferences(
                    getPreferenceScope(Boolean(appearancePreferences)),
                ).confirmations.removeMissingImageLink,
        );
        const [confirmMissingImageLinks, setConfirmMissingImageLinks] =
            useState(
                () =>
                    getStoredDisplayPreferences(
                        getPreferenceScope(Boolean(appearancePreferences)),
                    ).confirmations.removeMissingImageLinks,
            );
        const [confirmationRequest, setConfirmationRequest] =
            useState<MissingImageConfirmationRequest | null>(null);
        const [compare, setCompare] = useState<CompareState>(restoreCompare);
        const [compareError, setCompareError] = useState<string | null>(null);
        const [compareCardDismissed, setCompareCardDismissed] = useState(false);
        const [compareOutcomeFilter, setCompareOutcomeFilter] =
            useState<CompareOutcomeFilter>('different');
        const [compareRowStates, setCompareRowStates] = useState<
            Record<number, string>
        >({});
        const [isBulkDownloadingDiff, setIsBulkDownloadingDiff] =
            useState(false);
        const [isBulkRemovingLinks, setIsBulkRemovingLinks] = useState(false);
        const runRef = useRef(run);
        const filtersRef = useRef(filters);
        const compareRef = useRef(compare);
        const runnerActiveRef = useRef(false);
        const runnerGenerationRef = useRef(0);
        const compareRunnerActiveRef = useRef(false);
        const compareRunnerGenerationRef = useRef(0);
        const compareAbortRef = useRef<AbortController | null>(null);
        const browseAbortRef = useRef<AbortController | null>(null);
        const completionTimersRef = useRef<Map<number, number>>(new Map());
        const completionEffectInitializedRef = useRef(false);

        useEffect(() => {
            const stored = getStoredDisplayPreferences(
                getPreferenceScope(Boolean(appearancePreferences)),
            ).confirmations;
            setConfirmMissingImageLink(stored.removeMissingImageLink);
            setConfirmMissingImageLinks(stored.removeMissingImageLinks);
        }, [appearancePreferences]);

        const commitRun = useCallback((next: RunState) => {
            runRef.current = next;
            setRun(next);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }, []);

        const commitCompare = useCallback((next: CompareState) => {
            compareRef.current = next;
            setCompare(next);
            localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
        }, []);

        useEffect(() => {
            filtersRef.current = filters;
        }, [filters]);

        const loadBrowse = useCallback(
            async (reset: boolean, selectedFilters: Filters, pageSize = 48) => {
                if (reset) browseAbortRef.current?.abort();
                const controller = new AbortController();
                browseAbortRef.current = controller;
                setLoading(true);
                setLoadError(null);
                try {
                    const after = reset ? 0 : cursor;
                    const response = await fetchItems(
                        selectedFilters,
                        after,
                        pageSize,
                        reset,
                        controller.signal,
                    );
                    setItems((current) => {
                        if (reset) return response.items;
                        const known = new Set(current.map((item) => item.id));
                        return [
                            ...current,
                            ...response.items.filter(
                                (item) => !known.has(item.id),
                            ),
                        ];
                    });
                    setCursor(response.next_cursor ?? after);
                    setHasMore(response.has_more);
                    if (response.total !== null) setTotal(response.total);
                } catch (error) {
                    if ((error as Error).name !== 'AbortError')
                        setLoadError(
                            error instanceof Error
                                ? error.message
                                : 'Erreur de chargement',
                        );
                } finally {
                    if (!controller.signal.aborted) setLoading(false);
                }
            },
            [cursor],
        );

        useEffect(() => {
            void loadBrowse(true, filters);
            return () => browseAbortRef.current?.abort();
            // refreshKey force volontairement le rechargement après un traitement.
        }, [filters, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

        useEffect(() => {
            const timers = completionTimersRef.current;

            return () => {
                timers.forEach((timer) => window.clearTimeout(timer));
                timers.clear();
            };
        }, []);

        const markItemCompleted = useCallback(
            (id: number, updateBrowseTotal = true) => {
                setActionStates((current) => ({
                    ...current,
                    [id]: 'completed',
                }));
                if (updateBrowseTotal) {
                    setTotal((current) =>
                        current === null ? null : Math.max(0, current - 1),
                    );
                }

                const previousTimer = completionTimersRef.current.get(id);
                if (previousTimer) window.clearTimeout(previousTimer);

                const timer = window.setTimeout(() => {
                    setItems((current) =>
                        current.filter((item) => item.id !== id),
                    );
                    setActionStates((current) => {
                        const next = { ...current };
                        delete next[id];
                        return next;
                    });
                    completionTimersRef.current.delete(id);
                }, 900);

                completionTimersRef.current.set(id, timer);
            },
            [],
        );

        const resetCompare = useCallback((dismissCard: boolean) => {
            compareRunnerGenerationRef.current += 1;
            compareRef.current = emptyCompare();
            setCompare(emptyCompare());
            localStorage.removeItem(COMPARE_STORAGE_KEY);
            setCompareError(null);
            setCompareOutcomeFilter('different');
            setCompareRowStates({});
            setIsBulkDownloadingDiff(false);
            setIsBulkRemovingLinks(false);
            setCompareCardDismissed(dismissCard);
        }, []);

        const resetAll = useCallback((dismissCard: boolean) => {
            const resetFilters = { ...EMPTY_FILTERS };
            const resetRun = emptyRun(resetFilters);
            const resetCompareState = emptyCompare(resetFilters);

            runnerGenerationRef.current += 1;
            compareRunnerGenerationRef.current += 1;
            runRef.current = resetRun;
            compareRef.current = resetCompareState;
            filtersRef.current = resetFilters;
            setRun(resetRun);
            setCompare(resetCompareState);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(COMPARE_STORAGE_KEY);
            setDraftFilters(resetFilters);
            setFilters(resetFilters);
            setItems([]);
            setCursor(0);
            setHasMore(false);
            setTotal(null);
            setActionStates({});
            setFailureActions({});
            setLoadError(null);
            setShowCompletionSummary(false);
            setGlobalCardDismissed(dismissCard);
            setCompareError(null);
            setCompareOutcomeFilter('different');
            setCompareRowStates({});
            setIsBulkDownloadingDiff(false);
            setIsBulkRemovingLinks(false);
            setCompareCardDismissed(dismissCard);

            completionTimersRef.current.forEach((timer) =>
                window.clearTimeout(timer),
            );
            completionTimersRef.current.clear();
        }, []);

        useEffect(() => {
            if (loading || !hasMore || items.length >= 36) return;
            void loadBrowse(false, filters, 12);
        }, [filters, hasMore, items.length, loadBrowse, loading]);

        const executeRunner = useCallback(async () => {
            if (runnerActiveRef.current) return;
            runnerActiveRef.current = true;
            const generation = runnerGenerationRef.current;
            try {
                while (runRef.current.status === 'running') {
                    let current = runRef.current;
                    if (current.pending.length === 0) {
                        let page: ItemsResponse;
                        try {
                            page = await fetchItems(
                                current.filters,
                                current.cursor,
                                25,
                                current.total === null,
                            );
                            if (generation !== runnerGenerationRef.current)
                                break;
                        } catch (error) {
                            if (generation !== runnerGenerationRef.current)
                                break;
                            commitRun({ ...runRef.current, status: 'paused' });
                            setLoadError(
                                error instanceof Error
                                    ? error.message
                                    : 'Traitement interrompu',
                            );
                            break;
                        }
                        current = runRef.current;
                        if (current.status === 'cancelling') break;
                        if (page.items.length === 0) {
                            if (
                                page.has_more &&
                                page.next_cursor !== null &&
                                page.next_cursor > current.cursor
                            ) {
                                commitRun({
                                    ...current,
                                    cursor: page.next_cursor,
                                    total: current.total ?? page.total,
                                });
                                continue;
                            }

                            commitRun({
                                ...current,
                                status: 'completed',
                                pending: [],
                            });
                            window.setTimeout(
                                () => setRefreshKey((value) => value + 1),
                                900,
                            );
                            break;
                        }
                        commitRun({
                            ...current,
                            cursor: page.next_cursor ?? current.cursor,
                            pending: page.items.map((item) => item.id),
                            total: current.total ?? page.total,
                        });
                        current = runRef.current;
                    }

                    if (current.status !== 'running') break;

                    const batch = current.pending.slice(0, 2);
                    const results = await Promise.all(
                        batch.map(async (id) => {
                            try {
                                return {
                                    id,
                                    result: await postAction(
                                        '/products/images/action/download',
                                        id,
                                    ),
                                };
                            } catch (error) {
                                return {
                                    id,
                                    result: {
                                        ok: false,
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : 'Erreur réseau',
                                    } as ActionResponse,
                                };
                            }
                        }),
                    );

                    if (generation !== runnerGenerationRef.current) break;

                    const latest = runRef.current;
                    const failures = [...latest.failures];
                    let downloaded = latest.downloaded;
                    for (const { id, result } of results) {
                        if (result.ok) {
                            if (result.downloaded !== false) downloaded += 1;
                            markItemCompleted(
                                id,
                                sameFilters(latest.filters, filtersRef.current),
                            );
                        } else {
                            const existing = failures.findIndex(
                                (failure) => failure.id === id,
                            );
                            const failure = {
                                id,
                                message: withHttpStatus(
                                    result.message || 'Échec du téléchargement',
                                    result.http_status,
                                ),
                                product: result.product,
                            };
                            if (existing >= 0) failures[existing] = failure;
                            else failures.push(failure);
                            setActionStates((currentStates) => ({
                                ...currentStates,
                                [id]: failure.message,
                            }));
                        }
                    }
                    commitRun({
                        ...latest,
                        pending: latest.pending.filter(
                            (id) => !batch.includes(id),
                        ),
                        processed: latest.processed + results.length,
                        downloaded,
                        failed: failures.length,
                        failures,
                    });
                }
            } finally {
                runnerActiveRef.current = false;
                if (runRef.current.status === 'cancelling') {
                    resetAll(true);
                } else if (runRef.current.status === 'running') {
                    void executeRunner();
                }
            }
        }, [commitRun, markItemCompleted, resetAll]);

        useEffect(() => {
            if (run.status === 'running') void executeRunner();
        }, [run.status, executeRunner]);

        const executeCompareRunner = useCallback(async () => {
            if (compareRunnerActiveRef.current) return;
            compareRunnerActiveRef.current = true;
            const generation = compareRunnerGenerationRef.current;
            const controller = new AbortController();
            compareAbortRef.current = controller;
            try {
                while (compareRef.current.status === 'running') {
                    let current = compareRef.current;
                    if (current.pending.length === 0) {
                        let page: CompareItemsResponse;
                        try {
                            page = await fetchCompareItems(
                                current.filters,
                                current.cursor,
                                48,
                                current.total === null,
                                controller.signal,
                            );
                            if (
                                generation !==
                                compareRunnerGenerationRef.current
                            )
                                break;
                        } catch (error) {
                            if (
                                generation !==
                                compareRunnerGenerationRef.current
                            )
                                break;
                            commitCompare({
                                ...compareRef.current,
                                status: 'paused',
                            });
                            setCompareError(
                                error instanceof Error
                                    ? error.message
                                    : 'Comparaison interrompue',
                            );
                            break;
                        }
                        current = compareRef.current;
                        if (current.status === 'cancelling') break;
                        if (page.items.length === 0) {
                            if (
                                page.has_more &&
                                page.next_cursor !== null &&
                                page.next_cursor > current.cursor
                            ) {
                                commitCompare({
                                    ...current,
                                    cursor: page.next_cursor,
                                    total: current.total ?? page.total,
                                });
                                continue;
                            }

                            commitCompare({
                                ...current,
                                status: 'completed',
                                pending: [],
                            });
                            break;
                        }
                        commitCompare({
                            ...current,
                            cursor: page.next_cursor ?? current.cursor,
                            pending: page.items.map((item) => item.id),
                            total: current.total ?? page.total,
                        });
                        current = compareRef.current;
                    }

                    if (current.status !== 'running') break;

                    const batch = current.pending.slice(0, 4);
                    const results = await Promise.all(
                        batch.map(async (id) => {
                            try {
                                return {
                                    id,
                                    result: await postAction(
                                        '/products/images/action/compare',
                                        id,
                                        {},
                                        controller.signal,
                                    ),
                                };
                            } catch (error) {
                                return {
                                    id,
                                    result: {
                                        ok: false,
                                        message:
                                            error instanceof Error
                                                ? error.message
                                                : 'Erreur réseau',
                                        reason: 'error',
                                    } as ActionResponse,
                                };
                            }
                        }),
                    );

                    if (generation !== compareRunnerGenerationRef.current)
                        break;

                    const latest = compareRef.current;
                    const nextResults = [...latest.results];
                    let identical = latest.identical;
                    let different = latest.different;
                    let noRemote = latest.no_remote;
                    let errors = latest.error;
                    for (const { id, result } of results) {
                        const classified = compareOutcome(result);
                        if (classified.outcome === 'identical') identical += 1;
                        else if (classified.outcome === 'different')
                            different += 1;
                        else if (classified.outcome === 'no_remote')
                            noRemote += 1;
                        else errors += 1;
                        const product = result.product;
                        nextResults.unshift({
                            id,
                            name: product?.name ?? `Produit #${id}`,
                            sku: product?.sku ?? null,
                            ref: product?.ref ?? null,
                            source_url: product?.source_url ?? '',
                            local_url: product?.local_url ?? null,
                            thumb_url: product?.thumb_url ?? null,
                            db_name: product?.db_name ?? null,
                            category_name: product?.category_name ?? null,
                            outcome: classified.outcome,
                            message: classified.message,
                        });
                    }
                    commitCompare({
                        ...latest,
                        pending: latest.pending.filter(
                            (id) => !batch.includes(id),
                        ),
                        processed: latest.processed + results.length,
                        identical,
                        different,
                        no_remote: noRemote,
                        error: errors,
                        results: nextResults.slice(0, COMPARE_RESULT_LIMIT),
                    });
                }
            } finally {
                compareRunnerActiveRef.current = false;
                if (compareRef.current.status === 'cancelling') {
                    resetCompare(true);
                } else if (compareRef.current.status === 'running') {
                    void executeCompareRunner();
                }
            }
        }, [commitCompare, resetCompare]);

        useEffect(() => {
            if (compare.status === 'running') void executeCompareRunner();
        }, [compare.status, executeCompareRunner]);

        useEffect(() => {
            if (!completionEffectInitializedRef.current) {
                completionEffectInitializedRef.current = true;
                return;
            }

            if (run.status !== 'completed' || run.failures.length > 0) {
                setShowCompletionSummary(false);
                return;
            }

            setShowCompletionSummary(true);
            const timer = window.setTimeout(
                () => setShowCompletionSummary(false),
                1800,
            );

            return () => window.clearTimeout(timer);
        }, [run.failures.length, run.status]);

        const applyFilters = (event: FormEvent) => {
            event.preventDefault();
            if (
                runRef.current.status === 'running' ||
                runRef.current.status === 'paused' ||
                runRef.current.status === 'cancelling' ||
                compareRef.current.status === 'running' ||
                compareRef.current.status === 'paused' ||
                compareRef.current.status === 'cancelling'
            )
                return;

            const nextFilters = {
                ...draftFilters,
                q: draftFilters.q.trim(),
            };

            setTotal(null);
            setFilters(nextFilters);
            commitRun(emptyRun(nextFilters));
            resetCompare(true);
            setShowCompletionSummary(false);
            setGlobalCardDismissed(false);
        };
        const startRun = () => {
            setLoadError(null);
            setDraftFilters({ ...filters });
            setGlobalCardDismissed(false);
            runnerGenerationRef.current += 1;
            commitRun({
                ...emptyRun(filters),
                status: 'running',
                total,
            });
        };
        const requestCancellation = () => {
            const current = runRef.current;
            if (current.status === 'paused' || !runnerActiveRef.current) {
                resetAll(true);
                return;
            }

            if (current.status === 'running') {
                commitRun({ ...current, status: 'cancelling' });
            }
        };
        const startCompareRun = () => {
            setCompareError(null);
            setCompareCardDismissed(false);
            setCompareOutcomeFilter('different');
            compareRunnerGenerationRef.current += 1;
            commitCompare({
                ...emptyCompare(filters),
                status: 'running',
            });
        };
        const requestCompareCancellation = () => {
            compareAbortRef.current?.abort();
            resetCompare(true);
        };
        const applyCompareRefresh = async (id: number): Promise<boolean> => {
            try {
                const response = await postAction(
                    '/products/images/action/refresh',
                    id,
                );
                if (!response.ok) {
                    throw new Error(
                        response.message || 'Remplacement impossible',
                    );
                }
                const latest = compareRef.current;
                commitCompare({
                    ...latest,
                    refreshed: latest.refreshed + 1,
                    results: latest.results.map((candidate) =>
                        candidate.id === id
                            ? {
                                  ...candidate,
                                  refreshed: true,
                                  message:
                                      response.message || 'Image remplacee',
                                  local_url:
                                      response.product?.local_url ??
                                      candidate.local_url,
                                  thumb_url:
                                      response.product?.thumb_url ??
                                      candidate.thumb_url,
                              }
                            : candidate,
                    ),
                });
                return true;
            } catch (error) {
                setCompareRowStates((current) => ({
                    ...current,
                    [id]: error instanceof Error ? error.message : 'Erreur',
                }));
                return false;
            }
        };
        const refreshSingleCompareResult = async (result: CompareResult) => {
            if (compareRowStates[result.id] === 'download') return;
            setCompareRowStates((current) => ({
                ...current,
                [result.id]: 'download',
            }));
            await applyCompareRefresh(result.id);
            setCompareRowStates((current) => {
                const next = { ...current };
                if (next[result.id] === 'download') {
                    delete next[result.id];
                }
                return next;
            });
        };
        const bulkRefresh = async (outcomes: CompareOutcome[]) => {
            if (isBulkDownloadingDiff || isBulkRemovingLinks) return;
            const targets = compareRef.current.results.filter(
                (result) =>
                    outcomes.includes(result.outcome) && !result.refreshed,
            );
            if (targets.length === 0) return;
            setIsBulkDownloadingDiff(true);
            setCompareRowStates((current) => {
                const next = { ...current };
                for (const target of targets) {
                    next[target.id] = 'download';
                }
                return next;
            });
            for (const target of targets) {
                await applyCompareRefresh(target.id);
            }
            setCompareRowStates((current) => {
                const next = { ...current };
                for (const target of targets) {
                    delete next[target.id];
                }
                return next;
            });
            setIsBulkDownloadingDiff(false);
            setCompareOutcomeFilter('refreshed');
        };
        const bulkRemoveLinks = async (outcomes: CompareOutcome[]) => {
            if (isBulkRemovingLinks || isBulkDownloadingDiff) return;
            const targets = compareRef.current.results.filter(
                (result) =>
                    outcomes.includes(result.outcome) && !result.refreshed,
            );
            if (targets.length === 0) return;
            setIsBulkRemovingLinks(true);
            setCompareRowStates((current) => {
                const next = { ...current };
                for (const target of targets) {
                    next[target.id] = 'remove';
                }
                return next;
            });
            for (const target of targets) {
                try {
                    const response = await postAction(
                        '/products/images/action/remove-missing-img-link',
                        target.id,
                        { force: true },
                    );
                    if (!response.ok) {
                        throw new Error(
                            response.message || 'Suppression impossible',
                        );
                    }
                    const latest = compareRef.current;
                    commitCompare({
                        ...latest,
                        img_links_removed: latest.img_links_removed + 1,
                        results: latest.results.filter(
                            (candidate) => candidate.id !== target.id,
                        ),
                    });
                } catch (error) {
                    setCompareRowStates((current) => ({
                        ...current,
                        [target.id]:
                            error instanceof Error ? error.message : 'Erreur',
                    }));
                }
            }
            setCompareRowStates((current) => {
                const next = { ...current };
                for (const target of targets) {
                    if (next[target.id] === 'remove') {
                        delete next[target.id];
                    }
                }
                return next;
            });
            setIsBulkRemovingLinks(false);
        };
        const runIndividualAction = async (
            item: MissingImage,
            action: 'download' | 'remove',
        ) => {
            setActionStates((current) => ({ ...current, [item.id]: action }));
            try {
                const path =
                    action === 'download'
                        ? '/products/images/action/download'
                        : '/products/images/action/remove-missing-img-link';
                const result = await postAction(path, item.id);
                if (!result.ok)
                    throw new Error(result.message || 'Action impossible');
                markItemCompleted(item.id);
            } catch (error) {
                setActionStates((current) => ({
                    ...current,
                    [item.id]:
                        error instanceof Error ? error.message : 'Erreur',
                }));
                return;
            }
        };

        const requestSingleItemRemoval = (item: MissingImage) => {
            if (!confirmMissingImageLink) {
                void runIndividualAction(item, 'remove');
                return;
            }

            setConfirmationRequest({
                kind: 'removeSingleItemMissingImageLink',
                item,
            });
        };

        const removeResolvedFailure = useCallback(
            (id: number, downloaded: boolean) => {
                const current = runRef.current;
                const failures = current.failures.filter(
                    (failure) => failure.id !== id,
                );
                commitRun({
                    ...current,
                    failures,
                    failed: failures.length,
                    downloaded: current.downloaded + (downloaded ? 1 : 0),
                });
            },
            [commitRun],
        );

        const retryFailure = async (failure: RunFailure) => {
            setFailureActions((current) => ({
                ...current,
                [failure.id]: 'retry',
            }));

            try {
                const result = await postAction(
                    '/products/images/action/download',
                    failure.id,
                );
                if (!result.ok) {
                    const current = runRef.current;
                    const failures = current.failures.map((candidate) =>
                        candidate.id === failure.id
                            ? {
                                  ...candidate,
                                  message: withHttpStatus(
                                      result.message ||
                                          'Échec du téléchargement',
                                      result.http_status,
                                  ),
                                  product: result.product ?? candidate.product,
                              }
                            : candidate,
                    );
                    commitRun({
                        ...current,
                        failures,
                        failed: failures.length,
                    });
                    return;
                }

                removeResolvedFailure(failure.id, result.downloaded !== false);
                markItemCompleted(
                    failure.id,
                    sameFilters(runRef.current.filters, filtersRef.current),
                );
            } catch (error) {
                const current = runRef.current;
                const failures = current.failures.map((candidate) =>
                    candidate.id === failure.id
                        ? {
                              ...candidate,
                              message:
                                  error instanceof Error
                                      ? error.message
                                      : 'Erreur réseau',
                          }
                        : candidate,
                );
                commitRun({ ...current, failures, failed: failures.length });
            } finally {
                setFailureActions((current) => {
                    const next = { ...current };
                    delete next[failure.id];
                    return next;
                });
            }
        };

        const executeRemoveFailureImgLink = async (failure: RunFailure) => {
            setFailureActions((current) => ({
                ...current,
                [failure.id]: 'remove',
            }));

            try {
                const result = await postAction(
                    '/products/images/action/remove-missing-img-link',
                    failure.id,
                    { force: true },
                );
                if (!result.ok)
                    throw new Error(result.message || 'Suppression impossible');

                removeResolvedFailure(failure.id, false);
                markItemCompleted(
                    failure.id,
                    sameFilters(runRef.current.filters, filtersRef.current),
                );
            } catch (error) {
                const current = runRef.current;
                const failures = current.failures.map((candidate) =>
                    candidate.id === failure.id
                        ? {
                              ...candidate,
                              message:
                                  error instanceof Error
                                      ? error.message
                                      : 'Erreur réseau',
                          }
                        : candidate,
                );
                commitRun({ ...current, failures, failed: failures.length });
            } finally {
                setFailureActions((current) => {
                    const next = { ...current };
                    delete next[failure.id];
                    return next;
                });
            }
        };

        const executeRemoveAllFailureImgLinks = async (
            pendingFailures: RunFailure[],
        ) => {
            setIsBulkRemovingFailures(true);
            setFailureActions((current) => {
                const next = { ...current };
                for (const failure of pendingFailures) {
                    next[failure.id] = 'remove';
                }

                return next;
            });

            try {
                for (const failure of pendingFailures) {
                    try {
                        const result = await postAction(
                            '/products/images/action/remove-missing-img-link',
                            failure.id,
                            { force: true },
                        );

                        if (!result.ok) {
                            throw new Error(
                                result.message || 'Suppression impossible',
                            );
                        }

                        removeResolvedFailure(failure.id, false);
                        markItemCompleted(
                            failure.id,
                            sameFilters(
                                runRef.current.filters,
                                filtersRef.current,
                            ),
                        );
                    } catch (error) {
                        const current = runRef.current;
                        const failures = current.failures.map((candidate) =>
                            candidate.id === failure.id
                                ? {
                                      ...candidate,
                                      message:
                                          error instanceof Error
                                              ? error.message
                                              : 'Erreur réseau',
                                  }
                                : candidate,
                        );
                        commitRun({
                            ...current,
                            failures,
                            failed: failures.length,
                        });
                    } finally {
                        setFailureActions((current) => {
                            const next = { ...current };
                            delete next[failure.id];

                            return next;
                        });
                    }
                }
            } finally {
                setIsBulkRemovingFailures(false);
            }
        };

        const removeFailureImgLink = (failure: RunFailure) => {
            if (!confirmMissingImageLink) {
                void executeRemoveFailureImgLink(failure);

                return;
            }

            setConfirmationRequest({
                kind: 'removeMissingImageLink',
                failure,
            });
        };

        const removeAllFailureImgLinks = () => {
            const pendingFailures = runRef.current.failures.filter(
                (failure) => !failureActions[failure.id],
            );

            if (pendingFailures.length === 0) {
                return;
            }

            if (!confirmMissingImageLinks) {
                void executeRemoveAllFailureImgLinks(pendingFailures);

                return;
            }

            setConfirmationRequest({
                kind: 'removeAllMissingImageLinks',
                failures: pendingFailures,
            });
        };

        const handleConfirmDialogCancel = () => {
            setConfirmationRequest(null);
        };

        const handleConfirmDialogConfirm = () => {
            const request = confirmationRequest;
            if (!request) {
                return;
            }

            setConfirmationRequest(null);

            if (request.kind === 'removeMissingImageLink') {
                void executeRemoveFailureImgLink(request.failure);

                return;
            }

            if (request.kind === 'removeSingleItemMissingImageLink') {
                void runIndividualAction(request.item, 'remove');

                return;
            }

            void executeRemoveAllFailureImgLinks(request.failures);
        };

        const progress =
            run.total && run.total > 0
                ? Math.min(100, Math.round((run.processed / run.total) * 100))
                : 0;
        const controllableRun =
            run.status === 'running' || run.status === 'paused';
        const activeRun = controllableRun || run.status === 'cancelling';
        const hasImagesToProcess = total === null || total > 0;
        const runDbName = run.filters.db_products_id
            ? (dbProducts.find(
                  (option) => option.id === run.filters.db_products_id,
              )?.name ?? `Base #${run.filters.db_products_id}`)
            : 'Toutes les bases';
        const runCategoryName = run.filters.category_products_id
            ? (categories.find(
                  (option) => option.id === run.filters.category_products_id,
              )?.name ?? `Catégorie #${run.filters.category_products_id}`)
            : 'Toutes les catégories';
        const compareControllable =
            compare.status === 'running' || compare.status === 'paused';
        const compareActive =
            compareControllable || compare.status === 'cancelling';
        const compareProgress =
            compare.total && compare.total > 0
                ? Math.min(
                      100,
                      Math.round((compare.processed / compare.total) * 100),
                  )
                : 0;
        const compareHasWork =
            compare.total === null || compare.total > compare.processed;
        const compareVisibleResults = compare.results.filter((result) => {
            if (compareOutcomeFilter === 'all') return true;
            if (compareOutcomeFilter === 'refreshed') {
                return result.refreshed;
            }
            if (result.refreshed) return false;
            return result.outcome === compareOutcomeFilter;
        });
        const compareDifferentCount = compare.results.filter(
            (result) => result.outcome === 'different' && !result.refreshed,
        ).length;
        const compareNoRemoteCount = compare.results.filter(
            (result) => result.outcome === 'no_remote' && !result.refreshed,
        ).length;
        const compareRemoveOutcomes: CompareOutcome[] =
            compareOutcomeFilter === 'error'
                ? ['error']
                : compareOutcomeFilter === 'no_remote'
                  ? ['no_remote']
                  : [];
        const compareRemoveCount = compare.results.filter(
            (result) =>
                compareRemoveOutcomes.includes(result.outcome) &&
                !result.refreshed,
        ).length;
        const compareBulkReady = compare.status !== 'cancelling';
        const showCompareCard =
            !compareCardDismissed &&
            (compareActive ||
                compare.status === 'completed' ||
                compare.results.length > 0 ||
                compareError !== null);
        const failureCards = (
            <div className="grid gap-3">
                {run.failures.map((failure) => {
                    const product = failure.product;
                    const action = failureActions[failure.id];

                    return (
                        <div
                            key={failure.id}
                            className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:grid-cols-[6rem_minmax(0,1fr)] lg:grid-cols-[6rem_minmax(0,1fr)_auto]"
                        >
                            <ImagePreview
                                src={product?.source_url ?? null}
                                label="Image distante"
                            />
                            <div className="min-w-0 space-y-1">
                                <p className="font-medium">
                                    {product?.name ?? `Produit #${failure.id}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    #{failure.id}
                                    {product?.sku
                                        ? ` · SKU ${product.sku}`
                                        : ''}
                                    {product?.ref
                                        ? ` · Réf. ${product.ref}`
                                        : ''}
                                </p>
                                {(product?.db_name ||
                                    product?.category_name) && (
                                    <p className="text-xs text-muted-foreground">
                                        {product.db_name ?? 'Sans base'} ·{' '}
                                        {product.category_name ??
                                            'Sans catégorie'}
                                    </p>
                                )}
                                <p className="text-sm text-destructive">
                                    {failure.message}
                                </p>
                                {product?.source_url && (
                                    <p
                                        className="truncate text-xs text-muted-foreground"
                                        title={product.source_url}
                                    >
                                        {product.source_url}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-wrap content-start gap-2 sm:col-span-2 lg:col-span-1 lg:max-w-64 lg:justify-end">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void retryFailure(failure)}
                                    disabled={
                                        !!action || isBulkRemovingFailures
                                    }
                                    className="gap-2"
                                >
                                    {action === 'retry' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-4 w-4" />
                                    )}
                                    Réessayer
                                </Button>
                                <Button asChild size="sm" variant="outline">
                                    <a
                                        href={`/admin/products/${failure.id}/edit`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Voir le produit
                                    </a>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() =>
                                        void removeFailureImgLink(failure)
                                    }
                                    disabled={
                                        !!action || isBulkRemovingFailures
                                    }
                                    className="gap-2"
                                >
                                    {action === 'remove' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4" />
                                    )}
                                    Supprimer img_link
                                </Button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
        const showGlobalCard =
            !globalCardDismissed &&
            !compareActive &&
            (activeRun ||
                run.failures.length > 0 ||
                (run.status !== 'completed' && hasImagesToProcess) ||
                showCompletionSummary);

        return (
            <div className="space-y-5 pb-8">
                <Head title={t('Missing images')} />
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        {t('Missing images')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Téléchargez les images distantes manquantes sur le
                        serveur.
                    </p>
                </div>

                <Card className="gap-4 py-4">
                    <CardContent className="space-y-4 px-4 sm:px-6">
                        <form
                            onSubmit={applyFilters}
                            className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_240px_240px_auto_auto]"
                        >
                            <Input
                                value={draftFilters.q}
                                disabled={activeRun || compareActive}
                                onChange={(event) =>
                                    setDraftFilters((current) => ({
                                        ...current,
                                        q: event.target.value,
                                    }))
                                }
                                placeholder="Nom, SKU ou référence"
                            />
                            <Select
                                disabled={activeRun || compareActive}
                                value={
                                    draftFilters.db_products_id?.toString() ??
                                    'all'
                                }
                                onValueChange={(value) =>
                                    setDraftFilters((current) => ({
                                        ...current,
                                        db_products_id:
                                            value === 'all'
                                                ? null
                                                : Number(value),
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Toutes les bases" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Toutes les bases
                                    </SelectItem>
                                    {dbProducts.map((option) => (
                                        <SelectItem
                                            key={option.id}
                                            value={String(option.id)}
                                        >
                                            {option.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select
                                disabled={activeRun || compareActive}
                                value={
                                    draftFilters.category_products_id?.toString() ??
                                    'all'
                                }
                                onValueChange={(value) =>
                                    setDraftFilters((current) => ({
                                        ...current,
                                        category_products_id:
                                            value === 'all'
                                                ? null
                                                : Number(value),
                                    }))
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Toutes les catégories" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Toutes les catégories
                                    </SelectItem>
                                    {categories.map((option) => (
                                        <SelectItem
                                            key={option.id}
                                            value={String(option.id)}
                                        >
                                            {option.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={activeRun || compareActive}
                                className="gap-2"
                            >
                                <Search className="h-4 w-4" /> Rechercher
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={activeRun || compareActive}
                                onClick={startCompareRun}
                                className="gap-2"
                            >
                                <GitCompareArrows className="h-4 w-4" />{' '}
                                Comparer
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {showGlobalCard && (
                    <StickyBar
                        borderBottom={false}
                        zIndex={20}
                        className="w-full"
                        stickyClassName="bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/85"
                        onFixedToggle={setIsGlobalCardSticky}
                    >
                        <Card
                            className={`${isGlobalCardSticky ? 'block' : 'hidden'} w-full gap-0 py-2`}
                        >
                            <CardContent className="space-y-2 px-3 sm:px-4">
                                <div className="flex items-center gap-3">
                                    <p className="min-w-0 truncate text-xs text-muted-foreground sm:text-sm">
                                        Base : {runDbName} · Catégorie :{' '}
                                        {runCategoryName}
                                        {run.filters.q && (
                                            <>
                                                {' '}
                                                · Recherche : « {
                                                    run.filters.q
                                                }{' '}
                                                »
                                            </>
                                        )}
                                    </p>
                                    <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted sm:min-w-28">
                                        <div
                                            className="h-full bg-primary transition-[width]"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <div className="flex shrink-0 gap-2">
                                        {!activeRun &&
                                            !compareActive &&
                                            hasImagesToProcess && (
                                                <Button
                                                    size="sm"
                                                    onClick={startRun}
                                                    className="gap-2"
                                                >
                                                    <Play className="h-4 w-4" />
                                                    <span className="hidden sm:inline">
                                                        {run.failures.length > 0
                                                            ? 'Relancer'
                                                            : 'Tout télécharger'}
                                                    </span>
                                                </Button>
                                            )}
                                        {run.status === 'running' && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    commitRun({
                                                        ...runRef.current,
                                                        status: 'paused',
                                                    })
                                                }
                                                className="gap-2"
                                            >
                                                <Pause className="h-4 w-4" />
                                                <span className="hidden sm:inline">
                                                    Pause
                                                </span>
                                            </Button>
                                        )}
                                        {run.status === 'paused' && (
                                            <Button
                                                size="sm"
                                                onClick={() =>
                                                    commitRun({
                                                        ...runRef.current,
                                                        status: 'running',
                                                    })
                                                }
                                                className="gap-2"
                                            >
                                                <Play className="h-4 w-4" />
                                                <span className="hidden sm:inline">
                                                    Reprendre
                                                </span>
                                            </Button>
                                        )}
                                        {controllableRun && (
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={requestCancellation}
                                                className="gap-2"
                                            >
                                                <Square className="h-4 w-4" />
                                                <span className="hidden sm:inline">
                                                    Annuler
                                                </span>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                {run.failures.length > 0 && (
                                    <MissingImagesFailuresDetails
                                        variant="compact"
                                        title="Fichiers en erreur"
                                        failureCount={run.failures.length}
                                        removeAllLabel="Supprimer tout"
                                        isBulkRemoving={isBulkRemovingFailures}
                                        onRemoveAll={() => {
                                            void removeAllFailureImgLinks();
                                        }}
                                    >
                                        {failureCards}
                                    </MissingImagesFailuresDetails>
                                )}
                            </CardContent>
                        </Card>
                        <Card
                            className={`${isGlobalCardSticky ? 'hidden' : 'block'} w-full gap-3 py-3`}
                        >
                            <CardHeader className="flex-row items-start justify-between gap-4 px-4 sm:px-6">
                                <div>
                                    <CardTitle>Traitement global</CardTitle>
                                </div>
                                <Badge
                                    variant={
                                        run.status === 'completed'
                                            ? 'default'
                                            : run.failed > 0
                                              ? 'destructive'
                                              : 'secondary'
                                    }
                                >
                                    {run.status === 'running' && 'En cours'}
                                    {run.status === 'paused' && 'En pause'}
                                    {run.status === 'cancelling' &&
                                        'Annulation en cours'}
                                    {run.status === 'completed' && 'Terminé'}
                                    {run.status === 'stopped' && 'Arrêté'}
                                    {run.status === 'idle' && 'Prêt'}
                                </Badge>
                            </CardHeader>
                            <CardContent className="space-y-3 px-4 sm:px-6">
                                <div className="h-2 overflow-hidden rounded-full bg-muted">
                                    <div
                                        className="h-full bg-primary transition-[width]"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                                    <span>
                                        {run.processed} traité(s)
                                        {run.total !== null
                                            ? ` / ${run.total}`
                                            : ''}
                                    </span>
                                    <span className="text-muted-foreground">
                                        Base : {runDbName} · Catégorie :{' '}
                                        {runCategoryName}
                                        {run.filters.q && (
                                            <>
                                                {' '}
                                                · Recherche : « {
                                                    run.filters.q
                                                }{' '}
                                                »
                                            </>
                                        )}
                                    </span>
                                    <span className="text-emerald-600">
                                        {run.downloaded} téléchargé(s)
                                    </span>
                                    <span
                                        className={
                                            run.failed
                                                ? 'text-destructive'
                                                : 'text-muted-foreground'
                                        }
                                    >
                                        {run.failed} erreur(s)
                                    </span>
                                    {run.pending.length > 0 && (
                                        <span className="text-muted-foreground">
                                            {run.pending.length} en attente dans
                                            le lot
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {!activeRun &&
                                        !compareActive &&
                                        hasImagesToProcess && (
                                            <Button
                                                onClick={startRun}
                                                className="gap-2"
                                            >
                                                <Play className="h-4 w-4" />
                                                {run.failures.length > 0
                                                    ? 'Relancer les images restantes'
                                                    : 'Tout télécharger'}
                                            </Button>
                                        )}
                                    {run.status === 'running' && (
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                commitRun({
                                                    ...runRef.current,
                                                    status: 'paused',
                                                })
                                            }
                                            className="gap-2"
                                        >
                                            <Pause className="h-4 w-4" /> Pause
                                        </Button>
                                    )}
                                    {run.status === 'paused' && (
                                        <Button
                                            onClick={() =>
                                                commitRun({
                                                    ...runRef.current,
                                                    status: 'running',
                                                })
                                            }
                                            className="gap-2"
                                        >
                                            <Play className="h-4 w-4" />{' '}
                                            Reprendre
                                        </Button>
                                    )}
                                    {controllableRun && (
                                        <Button
                                            variant="destructive"
                                            onClick={requestCancellation}
                                            className="gap-2"
                                        >
                                            <Square className="h-4 w-4" />{' '}
                                            Annuler
                                        </Button>
                                    )}
                                </div>
                                {run.failures.length > 0 && (
                                    <MissingImagesFailuresDetails
                                        variant="full"
                                        title="Produits à corriger"
                                        failureCount={run.failures.length}
                                        removeAllLabel="Supprimer tous les liens invalides"
                                        isBulkRemoving={isBulkRemovingFailures}
                                        onRemoveAll={() => {
                                            void removeAllFailureImgLinks();
                                        }}
                                    >
                                        {failureCards}
                                    </MissingImagesFailuresDetails>
                                )}
                            </CardContent>
                        </Card>
                    </StickyBar>
                )}

                {showCompareCard && (
                    <Card className="w-full gap-3 py-4">
                        <CardHeader className="flex-row items-start justify-between gap-4 px-4 sm:px-6">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <GitCompareArrows className="h-5 w-5" />
                                    Comparaison des images
                                </CardTitle>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Compare chaque image locale avec sa source
                                    distante (img_link) par hash.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge
                                    variant={
                                        compare.status === 'completed'
                                            ? 'default'
                                            : compare.different > 0 ||
                                                compare.error > 0
                                              ? 'destructive'
                                              : 'secondary'
                                    }
                                >
                                    {compare.status === 'running' && 'En cours'}
                                    {compare.status === 'paused' && 'En pause'}
                                    {compare.status === 'cancelling' &&
                                        'Annulation en cours'}
                                    {compare.status === 'completed' &&
                                        'Terminé'}
                                    {compare.status === 'idle' && 'Prêt'}
                                </Badge>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() =>
                                        setCompareCardDismissed(true)
                                    }
                                >
                                    <Square className="h-4 w-4" />
                                    <span className="sr-only">Masquer</span>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3 px-4 sm:px-6">
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full bg-primary transition-[width]"
                                    style={{ width: `${compareProgress}%` }}
                                />
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                                <span>
                                    {compare.processed} comparé(s)
                                    {compare.total !== null
                                        ? ` / ${compare.total}`
                                        : ''}
                                </span>
                                <span className="text-emerald-600">
                                    {compare.identical} identique(s)
                                </span>
                                <span
                                    className={
                                        compare.different
                                            ? 'text-destructive'
                                            : 'text-muted-foreground'
                                    }
                                >
                                    {compare.different} différente(s)
                                </span>
                                <span className="text-amber-600">
                                    {compare.no_remote} distante inaccessible
                                </span>
                                <span className="text-emerald-600">
                                    {compare.refreshed} remplacée(s)
                                </span>
                                <span
                                    className={
                                        compare.img_links_removed
                                            ? 'text-destructive'
                                            : 'text-muted-foreground'
                                    }
                                >
                                    {compare.img_links_removed} img_link
                                    supprimé(s)
                                </span>
                                <span className="text-muted-foreground">
                                    {compare.error} erreur(s)
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                {!compareActive && compareHasWork && (
                                    <Button
                                        onClick={startCompareRun}
                                        className="gap-2"
                                    >
                                        <Play className="h-4 w-4" />
                                        {compare.processed > 0
                                            ? 'Relancer la comparaison'
                                            : 'Lancer la comparaison'}
                                    </Button>
                                )}
                                {compare.status === 'running' && (
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            commitCompare({
                                                ...compareRef.current,
                                                status: 'paused',
                                            })
                                        }
                                        className="gap-2"
                                    >
                                        <Pause className="h-4 w-4" /> Pause
                                    </Button>
                                )}
                                {compare.status === 'paused' && (
                                    <Button
                                        onClick={() =>
                                            commitCompare({
                                                ...compareRef.current,
                                                status: 'running',
                                            })
                                        }
                                        className="gap-2"
                                    >
                                        <Play className="h-4 w-4" /> Reprendre
                                    </Button>
                                )}
                                {compareActive && (
                                    <Button
                                        variant="destructive"
                                        onClick={requestCompareCancellation}
                                        className="gap-2"
                                    >
                                        <Square className="h-4 w-4" /> Annuler
                                    </Button>
                                )}
                                <Select
                                    value={compareOutcomeFilter}
                                    onValueChange={(value) =>
                                        setCompareOutcomeFilter(
                                            value as CompareOutcomeFilter,
                                        )
                                    }
                                >
                                    <SelectTrigger className="w-56">
                                        <SelectValue placeholder="Tous les résultats" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            Tous les résultats
                                        </SelectItem>
                                        <SelectItem value="identical">
                                            Identiques
                                        </SelectItem>
                                        <SelectItem value="different">
                                            Différentes
                                        </SelectItem>
                                        <SelectItem value="refreshed">
                                            Remplacées
                                        </SelectItem>
                                        <SelectItem value="no_remote">
                                            Distante inaccessible
                                        </SelectItem>
                                        <SelectItem value="error">
                                            Erreurs
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                {compareBulkReady &&
                                    compareDifferentCount > 0 && (
                                        <Button
                                            onClick={() =>
                                                void bulkRefresh(['different'])
                                            }
                                            disabled={
                                                isBulkDownloadingDiff ||
                                                isBulkRemovingLinks
                                            }
                                            className="gap-2"
                                        >
                                            {isBulkDownloadingDiff ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Download className="h-4 w-4" />
                                            )}
                                            Télécharger toutes les images
                                            différentes ({compareDifferentCount}
                                            )
                                        </Button>
                                    )}
                                {compareBulkReady &&
                                    compareOutcomeFilter === 'no_remote' &&
                                    compareNoRemoteCount > 0 && (
                                        <Button
                                            onClick={() =>
                                                void bulkRefresh(['no_remote'])
                                            }
                                            disabled={
                                                isBulkDownloadingDiff ||
                                                isBulkRemovingLinks
                                            }
                                            className="gap-2"
                                        >
                                            {isBulkDownloadingDiff ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Download className="h-4 w-4" />
                                            )}
                                            Tout télécharger (
                                            {compareNoRemoteCount})
                                        </Button>
                                    )}
                                {compareBulkReady &&
                                    compareRemoveOutcomes.length > 0 &&
                                    compareRemoveCount > 0 && (
                                        <Button
                                            variant="destructive"
                                            onClick={() =>
                                                void bulkRemoveLinks(
                                                    compareRemoveOutcomes,
                                                )
                                            }
                                            disabled={
                                                isBulkDownloadingDiff ||
                                                isBulkRemovingLinks
                                            }
                                            className="gap-2"
                                        >
                                            {isBulkRemovingLinks ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                            Supprimer tous les img_link (
                                            {compareRemoveCount})
                                        </Button>
                                    )}
                            </div>
                            {compareError && (
                                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                                    <AlertCircle className="h-4 w-4 shrink-0" />{' '}
                                    {compareError}
                                </div>
                            )}
                            <div className="grid gap-3">
                                {compareVisibleResults.map((result) => (
                                    <div
                                        key={result.id}
                                        className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-[6rem_minmax(0,1fr)] lg:grid-cols-[6rem_6rem_minmax(0,1fr)_auto] ${
                                            result.outcome === 'different' &&
                                            !result.refreshed
                                                ? 'border-destructive/30 bg-destructive/5'
                                                : result.refreshed
                                                  ? 'border-emerald-500 bg-emerald-500/10'
                                                  : ''
                                        }`}
                                    >
                                        <ImagePreview
                                            src={result.local_url}
                                            label="Locale"
                                        />
                                        <ImagePreview
                                            src={result.source_url}
                                            label="Distante"
                                        />
                                        <div className="min-w-0 space-y-1">
                                            <p className="font-medium">
                                                {result.name ||
                                                    `Produit #${result.id}`}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                #{result.id}
                                                {result.sku
                                                    ? ` · SKU ${result.sku}`
                                                    : ''}
                                                {result.ref
                                                    ? ` · Réf. ${result.ref}`
                                                    : ''}
                                            </p>
                                            {(result.db_name ||
                                                result.category_name) && (
                                                <p className="text-xs text-muted-foreground">
                                                    {result.db_name ??
                                                        'Sans base'}{' '}
                                                    ·{' '}
                                                    {result.category_name ??
                                                        'Sans catégorie'}
                                                </p>
                                            )}
                                            <Badge
                                                variant={
                                                    result.refreshed ||
                                                    result.outcome ===
                                                        'identical'
                                                        ? 'default'
                                                        : result.outcome ===
                                                            'error'
                                                          ? 'secondary'
                                                          : 'destructive'
                                                }
                                                className={
                                                    result.refreshed ||
                                                    result.outcome ===
                                                        'identical'
                                                        ? 'bg-emerald-600 text-white'
                                                        : result.outcome ===
                                                            'no_remote'
                                                          ? 'bg-amber-500 text-white'
                                                          : ''
                                                }
                                            >
                                                {result.refreshed &&
                                                    'Remplacée'}
                                                {!result.refreshed &&
                                                    result.outcome ===
                                                        'identical' &&
                                                    'Identique'}
                                                {!result.refreshed &&
                                                    result.outcome ===
                                                        'different' &&
                                                    'Différente'}
                                                {!result.refreshed &&
                                                    result.outcome ===
                                                        'no_remote' &&
                                                    'Distante inaccessible'}
                                                {!result.refreshed &&
                                                    result.outcome ===
                                                        'error' &&
                                                    'Erreur'}
                                            </Badge>
                                            <p className="text-xs text-muted-foreground">
                                                {result.message}
                                            </p>
                                            {compareRowStates[result.id] &&
                                                compareRowStates[result.id] !==
                                                    'download' &&
                                                compareRowStates[result.id] !==
                                                    'remove' && (
                                                    <p className="text-sm text-destructive">
                                                        {
                                                            compareRowStates[
                                                                result.id
                                                            ]
                                                        }
                                                    </p>
                                                )}
                                        </div>
                                        <div className="flex flex-wrap content-start gap-2 sm:col-span-3 lg:col-span-1 lg:max-w-40 lg:justify-end">
                                            {(result.outcome === 'different' ||
                                                result.outcome ===
                                                    'no_remote') &&
                                                !result.refreshed && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={
                                                            compareRowStates[
                                                                result.id
                                                            ] === 'download' ||
                                                            compareRowStates[
                                                                result.id
                                                            ] === 'remove' ||
                                                            isBulkDownloadingDiff ||
                                                            isBulkRemovingLinks
                                                        }
                                                        onClick={() =>
                                                            void refreshSingleCompareResult(
                                                                result,
                                                            )
                                                        }
                                                        className="gap-2"
                                                    >
                                                        {compareRowStates[
                                                            result.id
                                                        ] === 'download' ||
                                                        compareRowStates[
                                                            result.id
                                                        ] === 'remove' ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Download className="h-4 w-4" />
                                                        )}
                                                        Télécharger
                                                    </Button>
                                                )}
                                            <Button
                                                asChild
                                                size="sm"
                                                variant="outline"
                                            >
                                                <a
                                                    href={`/admin/products/${result.id}/edit`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <ExternalLink className="h-4 w-4" />
                                                    Voir
                                                </a>
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {!compareActive && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">
                                Images à traiter
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {total === null
                                    ? 'Comptage…'
                                    : `${total} produit(s) sans image locale`}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            onClick={() => setRefreshKey((value) => value + 1)}
                            disabled={loading}
                            className="gap-2"
                        >
                            <RefreshCw
                                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                            />{' '}
                            Actualiser
                        </Button>
                    </div>
                )}

                {!compareActive && loadError && (
                    <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" /> {loadError}
                    </div>
                )}
                {!compareActive && (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {items.map((item) => {
                            const actionState = actionStates[item.id];
                            const isBusy =
                                actionState === 'download' ||
                                actionState === 'remove';
                            const isCompleted = actionState === 'completed';
                            return (
                                <Card
                                    key={item.id}
                                    className={`gap-4 py-4 transition-colors ${
                                        isCompleted
                                            ? 'border-emerald-500 bg-emerald-500/10'
                                            : ''
                                    }`}
                                >
                                    <CardHeader className="px-4 sm:px-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <CardTitle className="truncate text-base">
                                                    {item.name
                                                        ? item.name
                                                              .charAt(0)
                                                              .toUpperCase() +
                                                          item.name.slice(1)
                                                        : 'Produit sans nom'}
                                                </CardTitle>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    #{item.id} ·{' '}
                                                    {item.sku ||
                                                        item.ref ||
                                                        'Sans référence'}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-2">
                                                {isCompleted && (
                                                    <Badge className="bg-emerald-600 text-white">
                                                        <CheckCircle2 /> Terminé
                                                    </Badge>
                                                )}
                                                {item.missing_reason ===
                                                    'missing_file' && (
                                                    <Badge variant="destructive">
                                                        Fichier local absent
                                                    </Badge>
                                                )}
                                                {item.db_name && (
                                                    <Badge variant="outline">
                                                        {item.db_name}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4 px-4 sm:px-5">
                                        <div className="flex gap-3">
                                            <ImagePreview
                                                src={item.source_url}
                                                label="Distante"
                                            />
                                            <ImagePreview
                                                src={item.local_url}
                                                label="Locale"
                                            />
                                            <ImagePreview
                                                src={item.thumb_url}
                                                label="Vignette"
                                            />
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                {item.category_name ||
                                                    'Sans catégorie'}
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() =>
                                                        void runIndividualAction(
                                                            item,
                                                            'download',
                                                        )
                                                    }
                                                    disabled={
                                                        isBusy || isCompleted
                                                    }
                                                    className="gap-2"
                                                >
                                                    {actionState ===
                                                    'download' ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Download className="h-4 w-4" />
                                                    )}
                                                    Télécharger
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() =>
                                                        requestSingleItemRemoval(
                                                            item,
                                                        )
                                                    }
                                                    disabled={
                                                        isBusy || isCompleted
                                                    }
                                                    className="gap-2"
                                                >
                                                    {actionState ===
                                                    'remove' ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="h-4 w-4" />
                                                    )}
                                                    Retirer le lien invalide
                                                </Button>
                                            </div>
                                        </div>
                                        {actionState &&
                                            !isBusy &&
                                            !isCompleted && (
                                                <p className="flex items-center gap-2 text-sm text-destructive">
                                                    <AlertCircle className="h-4 w-4" />
                                                    {actionState}
                                                </p>
                                            )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {!compareActive &&
                    !loading &&
                    items.length === 0 &&
                    !loadError &&
                    !hasMore && (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center">
                            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                            <p className="font-medium">
                                Aucune image manquante pour ces filtres.
                            </p>
                        </div>
                    )}
                {!compareActive && loading && items.length === 0 && (
                    <div className="flex justify-center py-16">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                )}
                {!compareActive && hasMore && (
                    <div className="flex justify-center">
                        <Button
                            variant="outline"
                            onClick={() => void loadBrowse(false, filters)}
                            disabled={loading}
                        >
                            {loading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}{' '}
                            Charger la suite
                        </Button>
                    </div>
                )}

                <ConfirmationDialog
                    open={confirmationRequest !== null}
                    title={
                        confirmationRequest?.kind ===
                            'removeMissingImageLink' ||
                        confirmationRequest?.kind ===
                            'removeSingleItemMissingImageLink'
                            ? 'Supprimer ce lien invalide ?'
                            : 'Supprimer tous les liens invalides ?'
                    }
                    description={
                        confirmationRequest?.kind === 'removeMissingImageLink'
                            ? `Le lien image invalide du produit « ${
                                  confirmationRequest.failure.product?.name ??
                                  `Produit #${confirmationRequest.failure.id}`
                              } » sera supprimé.`
                            : confirmationRequest?.kind ===
                                'removeSingleItemMissingImageLink'
                              ? `Le lien image invalide du produit « ${confirmationRequest.item.name || `Produit #${confirmationRequest.item.id}`} » sera supprimé.`
                              : `Les liens image invalides seront supprimés pour ${
                                    confirmationRequest?.failures.length ?? 0
                                } produit(s).`
                    }
                    confirmLabel={
                        confirmationRequest?.kind ===
                            'removeMissingImageLink' ||
                        confirmationRequest?.kind ===
                            'removeSingleItemMissingImageLink'
                            ? 'Supprimer le lien'
                            : 'Supprimer les liens'
                    }
                    confirmationEnabled={
                        confirmationRequest?.kind ===
                        'removeSingleItemMissingImageLink'
                            ? confirmMissingImageLink
                            : confirmMissingImageLinks
                    }
                    onConfirmationEnabledChange={(enabled) => {
                        if (
                            confirmationRequest?.kind ===
                            'removeSingleItemMissingImageLink'
                        ) {
                            setConfirmMissingImageLink(enabled);
                            persistCartConfirmationPreference(
                                'removeMissingImageLink',
                                enabled,
                            );
                            return;
                        }

                        setConfirmMissingImageLinks(enabled);
                        persistCartConfirmationPreference(
                            'removeMissingImageLinks',
                            enabled,
                        );
                    }}
                    onCancel={handleConfirmDialogCancel}
                    onConfirm={handleConfirmDialogConfirm}
                />
            </div>
        );
    },
);
