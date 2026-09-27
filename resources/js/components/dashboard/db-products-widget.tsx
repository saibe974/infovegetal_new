import { useCallback, useEffect, useRef, useState } from 'react';
import { CountryFlag } from '@/components/ui/country-flag';
import { DbProductActions } from '@/components/products/db-product-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import dbProducts from '@/routes/db-products';
import api from '@/routes/api';
import { Link } from '@inertiajs/react';
import { CalendarClockIcon, DatabaseIcon, Loader2, SearchIcon } from 'lucide-react';

type DbProductItem = {
    id: number;
    name: string;
    description?: string | null;
    country?: string | null;
    updated_at?: string | null;
    abilities?: {
        update?: boolean;
        manage?: boolean;
        delete?: boolean;
        billing?: boolean;
    } | null;
};

type WidgetResponse = {
    items: DbProductItem[];
    total: number;
};

export function DbProductsWidget() {
    const { t } = useI18n();
    const [items, setItems] = useState<DbProductItem[]>([]);
    const [total, setTotal] = useState(0);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchItems = useCallback(async (q: string) => {
        setLoading(true);
        try {
            const url = api.dbProductsWidget.index.url({ query: q ? { q } : undefined });
            const response = await fetch(url, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error('Request failed');
            const data = (await response.json()) as WidgetResponse;
            setItems(data.items ?? []);
            setTotal(data.total ?? 0);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchItems('');
    }, [fetchItems]);

    useEffect(
        () => () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        },
        [],
    );

    const handleSearch = (value: string) => {
        setSearch(value);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (value.trim().length < 2) {
            if (value.length === 0) {
                timerRef.current = setTimeout(() => void fetchItems(''), 300);
            }
            return;
        }
        timerRef.current = setTimeout(() => void fetchItems(value.trim()), 300);
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center gap-2 px-3 py-2">
                <div className="relative flex-1">
                    <SearchIcon className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder={t('Search')}
                        className="h-7 pl-7 text-sm"
                    />
                </div>
                {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                <span className="shrink-0 text-xs text-muted-foreground">{total}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-3 pb-2">
                {items.length === 0 && !loading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{t('No results')}</p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {items.map((item) => (
                            <li key={item.id} className="group/item">
                                <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60">
                                    <Link
                                        href={dbProducts.edit(item.id).url}
                                        className="flex min-w-0 flex-1 items-center gap-2"
                                    >
                                        <DatabaseIcon className="size-4 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                                        {item.country ? (
                                            <CountryFlag countryCode={item.country} title={item.country} className="w-4 shrink-0" />
                                        ) : null}
                                        <span
                                            className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground sm:flex"
                                            title={t('Updated')}
                                        >
                                            <CalendarClockIcon className="size-3" />
                                            {item.updated_at ? new Date(item.updated_at).toLocaleDateString() : '-'}
                                        </span>
                                    </Link>
                                    {item.abilities?.manage || item.abilities?.update || item.abilities?.billing || item.abilities?.delete ? (
                                        <div className="hidden shrink-0 group-hover/item:block">
                                            <DbProductActions item={item} />
                                        </div>
                                    ) : null}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="border-t px-3 py-1.5">
                <Button asChild variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                    <Link href={dbProducts.index().url}>{t('View all')}</Link>
                </Button>
            </div>
        </div>
    );
}
