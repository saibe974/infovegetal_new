import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import api from '@/routes/api';
import { index as usersIndex, show as usersShow } from '@/routes/users';
import { Link } from '@inertiajs/react';
import { Loader2, LogInIcon } from 'lucide-react';

type WidgetItem = {
    id: number;
    login_at: string | null;
    ip_address: string | null;
    user_agent: string | null;
    user: { id: number; name: string; email: string } | null;
};

type WidgetResponse = { items: WidgetItem[]; total: number };

const BROWSER_PATTERNS: Array<[RegExp, string]> = [
    [/Edg(?:e|A|iOS)?\//, 'Edge'],
    [/OPR\/|Opera/, 'Opera'],
    [/SamsungBrowser\//, 'Samsung Internet'],
    [/FxiOS\//, 'Firefox'],
    [/Firefox\//, 'Firefox'],
    [/CriOS\//, 'Chrome'],
    [/Chrome\//, 'Chrome'],
    [/Safari\//, 'Safari'],
    [/Trident\/|MSIE/, 'Internet Explorer'],
];

function browserLabel(userAgent?: string | null): string | null {
    if (!userAgent) return null;
    for (const [pattern, label] of BROWSER_PATTERNS) {
        if (pattern.test(userAgent)) return label;
    }
    return null;
}

function formatRelative(dateString: string, locale: string): string {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
    return rtf.format(Math.round(diffHours / 24), 'day');
}

export function RecentLoginsWidget() {
    const { t, locale } = useI18n();
    const [items, setItems] = useState<WidgetItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(api.recentLoginsWidget.index.url(), {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) throw new Error('Request failed');
            const data = (await response.json()) as WidgetResponse;
            setItems(data.items ?? []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchItems();
    }, [fetchItems]);

    return (
        <div className="flex h-full min-h-0 flex-col">
            {loading && (
                <div className="flex items-center justify-end px-3 py-2">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
            )}
            <div className="min-h-0 flex-1 overflow-auto px-3 pb-2">
                {!loading && items.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        {t('No logins recorded yet')}
                    </p>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {items.map((item) => {
                            const browser = browserLabel(item.user_agent);
                            return (
                                <li key={item.id}>
                                    <div className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60">
                                        <LogInIcon className="size-4 shrink-0 text-muted-foreground" />
                                        <div className="min-w-0 flex-1">
                                            {item.user ? (
                                                <Link
                                                    href={usersShow({
                                                        user: item.user.id,
                                                    }).url}
                                                    className="block truncate text-sm font-medium hover:underline"
                                                >
                                                    {item.user.name}
                                                </Link>
                                            ) : (
                                                <span className="block truncate text-sm font-medium">
                                                    —
                                                </span>
                                            )}
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {[item.ip_address, browser]
                                                    .filter(Boolean)
                                                    .join(' · ') || '—'}
                                            </span>
                                        </div>
                                        <span
                                            className="shrink-0 text-xs text-muted-foreground"
                                            title={
                                                item.login_at
                                                    ? new Date(
                                                          item.login_at,
                                                      ).toLocaleString(locale)
                                                    : undefined
                                            }
                                        >
                                            {item.login_at
                                                ? formatRelative(
                                                      item.login_at,
                                                      locale,
                                                  )
                                                : '—'}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
            <div className="border-t px-3 py-1.5">
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-muted-foreground"
                >
                    <Link href={usersIndex().url}>{t('View all')}</Link>
                </Button>
            </div>
        </div>
    );
}