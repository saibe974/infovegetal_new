import type { LayoutItem } from 'react-grid-layout';

export type DashboardWidgetConfig = {
    id: string;
    type: string;
    title: string;
    x: number;
    y: number;
    w: number;
    h: number;
};

export type DashboardLayoutPayload = DashboardWidgetConfig[];

const ENDPOINT = '/settings/dashboard-layout';

export function normalizeDashboardLayout(value: unknown): DashboardLayoutPayload {
    if (!Array.isArray(value)) return [];
    return value
        .filter(
            (item): item is DashboardWidgetConfig =>
                !!item &&
                typeof item === 'object' &&
                typeof (item as DashboardWidgetConfig).id === 'string' &&
                typeof (item as DashboardWidgetConfig).type === 'string',
        )
        .map((item) => ({
            id: item.id,
            type: item.type,
            title: typeof item.title === 'string' ? item.title : item.type,
            x: Number(item.x) || 0,
            y: Number(item.y) || 0,
            w: Math.min(12, Math.max(1, Number(item.w) || 6)),
            h: Math.max(1, Number(item.h) || 4),
        }));
}

export async function saveDashboardLayout(widgets: DashboardLayoutPayload): Promise<void> {
    const csrf = document.head.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
    const response = await fetch(ENDPOINT, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
        },
        body: JSON.stringify({ widgets: normalizeDashboardLayout(widgets) }),
    });

    if (!response.ok) throw new Error('Unable to save dashboard layout');
}

export type { LayoutItem };
