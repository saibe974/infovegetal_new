import { useCallback, useEffect, useRef, useState } from 'react';
import { WidgetGrid, type WidgetDefinition, type WidgetType } from '@/components/dashboard/widget-grid';
import { CartsList } from '@/components/cart/carts-list';
import { CommercialBalance } from '@/components/dashboard/commercial-balance';
import { DbProductsWidget } from '@/components/dashboard/db-products-widget';
import { RecentLoginsWidget } from '@/components/dashboard/recent-logins-widget';
import AppLayout from '@/layouts/app-layout';
import { useI18n } from '@/lib/i18n';
import { normalizeDashboardLayout, saveDashboardLayout, type DashboardWidgetConfig } from '@/lib/dashboard-preferences';
import { dashboard } from '@/routes';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, usePage } from '@inertiajs/react';
import type { LayoutItem } from 'react-grid-layout';

type WidgetInstance = WidgetDefinition;

const WIDGET_CATALOG: Record<string, { label: string; defaults: Partial<LayoutItem> }> = {
    carts: { label: 'Carts', defaults: { w: 12, h: 6 } },
    'commercial-balance': { label: 'Commercial balance', defaults: { w: 12, h: 4 } },
    'db-products': { label: 'Product databases', defaults: { w: 4, h: 5, minW: 3, minH: 4 } },
    'recent-logins': { label: 'Recent logins', defaults: { w: 4, h: 5, minW: 3, minH: 4 } },
};

const WIDGET_TYPES: WidgetType[] = Object.entries(WIDGET_CATALOG).map(([type, { label }]) => ({ type, label }));

let widgetCounter = 0;

function renderWidgetContent(type: string) {
    switch (type) {
        case 'commercial-balance':
            return <CommercialBalance />;
        case 'db-products':
            return <DbProductsWidget />;
        case 'recent-logins':
            return <RecentLoginsWidget />;
        default:
            return <CartsList />;
    }
}

export default function Dashboard() {
    const { t } = useI18n();
    const { dashboardLayout } = usePage<SharedData>().props;
    const [stored] = useState(() => normalizeDashboardLayout(dashboardLayout));
    const [widgets, setWidgets] = useState<WidgetInstance[]>(() =>
        stored.length > 0
            ? stored.map((w) => ({
                  id: w.id,
                  type: w.type,
                  title: w.title || w.type,
                  content: renderWidgetContent(w.type),
              }))
            : [
                  {
                      id: 'default-carts',
                      type: 'carts',
                      title: t('Carts'),
                      content: renderWidgetContent('carts'),
                  },
              ],
    );
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const widgetsRef = useRef<WidgetInstance[]>([]);
    widgetsRef.current = widgets;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Dashboard'),
            href: dashboard().url,
        },
    ];

    useEffect(() => {
        const next = normalizeDashboardLayout(dashboardLayout);
        if (next.length === 0) return;
        setWidgets(
            next.map((w) => ({
                id: w.id,
                type: w.type,
                title: w.title || t(WIDGET_CATALOG[w.type]?.label ?? w.type),
                content: renderWidgetContent(w.type),
            })),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dashboardLayout]);

    const scheduleSave = useCallback((layout: LayoutItem[]) => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            const payload: DashboardWidgetConfig[] = layout.map((item) => {
                const widget = widgetsRef.current.find((w) => w.id === item.i);
                return {
                    id: item.i,
                    type: widget?.type ?? 'unknown',
                    title: widget?.title ?? item.i,
                    x: item.x,
                    y: item.y,
                    w: item.w,
                    h: item.h,
                };
            });
            void saveDashboardLayout(payload).catch(() => undefined);
        }, 600);
    }, []);

    const handleAdd = useCallback((type: string) => {
        const spec = WIDGET_CATALOG[type] ?? { label: type, defaults: {} };
        const id = `widget-${Date.now()}-${widgetCounter++}`;
        setWidgets((prev) => [
            ...prev,
            {
                id,
                type,
                title: t(spec.label),
                content: renderWidgetContent(type),
            },
        ]);
        return id;
    }, [t]);

    const handleRemove = useCallback((id: string) => {
        setWidgets((prev) => prev.filter((w) => w.id !== id));
    }, []);

    const handleTitleChange = useCallback((id: string, title: string) => {
        setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, title } : w)));
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={t('Dashboard')} />
            <div className="flex h-full min-h-screen flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <WidgetGrid
                    widgets={widgets}
                    initialLayout={
                        stored.length > 0
                            ? stored.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h }))
                            : [{ i: 'default-carts', x: 0, y: 0, w: 12, h: 6 }]
                    }
                    widgetTypes={WIDGET_TYPES}
                    defaultItem={{ w: 6, h: 4 }}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    onTitleChange={handleTitleChange}
                    onLayoutChange={scheduleSave}
                />
            </div>
        </AppLayout>
    );
}
