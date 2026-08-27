import type { ViewMode } from '@/components/ui/view-mode-toggle';
import type { Appearance } from '@/hooks/use-appearance';

export type AccentColor = 'brand' | 'green' | 'blue' | 'neutral';
export type DisplayDensity = 'comfortable' | 'compact';
export type PreferenceScope = 'local' | 'account';
export type PreferencePage = 'products' | 'users';
export type CartConfirmationPreference =
    | 'removeItem'
    | 'clearCart'
    | 'removeMissingImageLink'
    | 'removeMissingImageLinks';

export type PageDisplayPreference = {
    enabled: boolean;
    view: ViewMode;
    rightSidebarOpen: boolean;
    autoOpenCartOnAdd?: boolean;
};

export type DisplayPreferences = {
    version: 1;
    general: {
        theme: Appearance;
        accent: AccentColor;
        density: DisplayDensity;
    };
    confirmations: {
        removeItem: boolean;
        clearCart: boolean;
        removeMissingImageLink: boolean;
        removeMissingImageLinks: boolean;
    };
    pages: Record<PreferencePage, PageDisplayPreference>;
};

export const DISPLAY_PREFERENCES_KEY = 'infovegetal:display-preferences:v1';
export const ACCOUNT_PREFERENCES_KEY = `${DISPLAY_PREFERENCES_KEY}:account`;
export const PREFERENCE_SCOPE_KEY = `${DISPLAY_PREFERENCES_KEY}:scope`;

export const defaultDisplayPreferences: DisplayPreferences = {
    version: 1,
    general: {
        theme: 'system',
        accent: 'brand',
        density: 'comfortable',
    },
    confirmations: {
        removeItem: true,
        clearCart: true,
        removeMissingImageLink: true,
        removeMissingImageLinks: true,
    },
    pages: {
        products: {
            enabled: true,
            view: 'table',
            rightSidebarOpen: false,
            autoOpenCartOnAdd: true,
        },
        users: {
            enabled: true,
            view: 'accordion',
            rightSidebarOpen: false,
        },
    },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

export function normalizeDisplayPreferences(
    value: unknown,
): DisplayPreferences {
    const input = isRecord(value) ? value : {};
    const general = isRecord(input.general) ? input.general : {};
    const confirmations = isRecord(input.confirmations)
        ? input.confirmations
        : {};
    const pages = isRecord(input.pages) ? input.pages : {};
    const products = isRecord(pages.products) ? pages.products : {};
    const users = isRecord(pages.users) ? pages.users : {};

    const theme = ['light', 'dark', 'system'].includes(String(general.theme))
        ? (general.theme as Appearance)
        : defaultDisplayPreferences.general.theme;
    const accent = ['brand', 'green', 'blue', 'neutral'].includes(
        String(general.accent),
    )
        ? (general.accent as AccentColor)
        : defaultDisplayPreferences.general.accent;
    const density = ['comfortable', 'compact'].includes(String(general.density))
        ? (general.density as DisplayDensity)
        : defaultDisplayPreferences.general.density;

    return {
        version: 1,
        general: { theme, accent, density },
        confirmations: {
            removeItem:
                typeof confirmations.removeItem === 'boolean'
                    ? confirmations.removeItem
                    : true,
            clearCart:
                typeof confirmations.clearCart === 'boolean'
                    ? confirmations.clearCart
                    : true,
            removeMissingImageLink:
                typeof confirmations.removeMissingImageLink === 'boolean'
                    ? confirmations.removeMissingImageLink
                    : typeof confirmations.removeMissingImageLinks === 'boolean'
                        ? confirmations.removeMissingImageLinks
                        : true,
            removeMissingImageLinks:
                typeof confirmations.removeMissingImageLinks === 'boolean'
                    ? confirmations.removeMissingImageLinks
                    : true,
        },
        pages: {
            products: {
                enabled:
                    typeof products.enabled === 'boolean'
                        ? products.enabled
                        : true,
                view: ['table', 'list', 'grid'].includes(String(products.view))
                    ? (products.view as ViewMode)
                    : 'table',
                rightSidebarOpen:
                    typeof products.rightSidebarOpen === 'boolean'
                        ? products.rightSidebarOpen
                        : false,
                autoOpenCartOnAdd:
                    typeof products.autoOpenCartOnAdd === 'boolean'
                        ? products.autoOpenCartOnAdd
                        : true,
            },
            users: {
                enabled:
                    typeof users.enabled === 'boolean' ? users.enabled : true,
                view: ['accordion', 'grid'].includes(String(users.view))
                    ? (users.view as ViewMode)
                    : 'accordion',
                rightSidebarOpen:
                    typeof users.rightSidebarOpen === 'boolean'
                        ? users.rightSidebarOpen
                        : false,
            },
        },
    };
}

function readJson(key: string): unknown {
    if (typeof window === 'undefined') return null;

    try {
        return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
        return null;
    }
}

function readLegacyDisplayPreferences(): DisplayPreferences {
    const preferences = normalizeDisplayPreferences(null);
    if (typeof window === 'undefined') return preferences;

    const theme = localStorage.getItem('appearance');
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
        preferences.general.theme = theme;
    }

    const views = readJson('views');
    if (isRecord(views)) {
        if (['table', 'list', 'grid'].includes(String(views.products))) {
            preferences.pages.products.view = views.products as ViewMode;
        }
        if (['accordion', 'grid'].includes(String(views.users))) {
            preferences.pages.users.view = views.users as ViewMode;
        }
    }

    return preferences;
}

export function getPreferenceScope(
    hasAccountPreferences = false,
): PreferenceScope {
    if (typeof window === 'undefined')
        return hasAccountPreferences ? 'account' : 'local';

    const stored = localStorage.getItem(PREFERENCE_SCOPE_KEY);
    if (stored === 'local' || stored === 'account') return stored;

    return hasAccountPreferences ? 'account' : 'local';
}

export function setPreferenceScope(scope: PreferenceScope): void {
    if (typeof window !== 'undefined')
        localStorage.setItem(PREFERENCE_SCOPE_KEY, scope);
}

export function getStoredDisplayPreferences(
    scope: PreferenceScope,
): DisplayPreferences {
    const stored = readJson(
        scope === 'account' ? ACCOUNT_PREFERENCES_KEY : DISPLAY_PREFERENCES_KEY,
    );

    if (isRecord(stored)) return normalizeDisplayPreferences(stored);

    return scope === 'local'
        ? readLegacyDisplayPreferences()
        : normalizeDisplayPreferences(null);
}

export function storeDisplayPreferences(
    preferences: DisplayPreferences,
    scope: PreferenceScope,
): void {
    if (typeof window === 'undefined') return;

    localStorage.setItem(
        scope === 'account' ? ACCOUNT_PREFERENCES_KEY : DISPLAY_PREFERENCES_KEY,
        JSON.stringify(normalizeDisplayPreferences(preferences)),
    );
}

function pageFromPath(pathname: string): PreferencePage | null {
    if (pathname === '/products' || pathname.startsWith('/products/'))
        return 'products';
    if (pathname === '/users' || pathname.startsWith('/users/')) return 'users';
    return null;
}

function applySidebarPreference(
    preferences: DisplayPreferences,
    pathname: string,
): void {
    const page = pageFromPath(pathname);
    if (
        !page ||
        !preferences.pages[page].enabled ||
        typeof document === 'undefined'
    )
        return;

    let states: Record<string, boolean> = {};
    try {
        const cookie = document.cookie
            .split(';')
            .find((item) => item.trim().startsWith('sidebar_state='));
        if (cookie)
            states = JSON.parse(
                decodeURIComponent(cookie.split('=').slice(1).join('=')),
            );
    } catch {
        states = {};
    }

    states.right = preferences.pages[page].rightSidebarOpen;
    document.cookie = `sidebar_state=${encodeURIComponent(JSON.stringify(states))}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
}

export function applyDisplayPreferences(
    preferences: DisplayPreferences,
    pathname = typeof window !== 'undefined' ? window.location.pathname : '',
): void {
    if (typeof window === 'undefined') return;

    const normalized = normalizeDisplayPreferences(preferences);
    localStorage.setItem('appearance', normalized.general.theme);
    document.cookie = `appearance=${normalized.general.theme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    previewDisplayPreferences(normalized);

    try {
        const views = JSON.parse(
            localStorage.getItem('views') || '{}',
        ) as Record<string, ViewMode>;
        (['products', 'users'] as PreferencePage[]).forEach((page) => {
            if (normalized.pages[page].enabled)
                views[page] = normalized.pages[page].view;
            else delete views[page];
        });
        localStorage.setItem('views', JSON.stringify(views));
    } catch {
        // A blocked localStorage must not prevent the application from loading.
    }

    applySidebarPreference(normalized, pathname);
}

export function previewDisplayPreferences(
    preferences: DisplayPreferences,
): void {
    if (typeof window === 'undefined') return;

    const normalized = normalizeDisplayPreferences(preferences);
    document.documentElement.dataset.accent = normalized.general.accent;
    document.documentElement.dataset.density = normalized.general.density;

    const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)',
    ).matches;
    const dark =
        normalized.general.theme === 'dark' ||
        (normalized.general.theme === 'system' && prefersDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function initializeDisplayPreferences(
    accountPreferences: unknown,
    pathname?: string,
): DisplayPreferences {
    const hasAccountPreferences = isRecord(accountPreferences);
    if (hasAccountPreferences) {
        storeDisplayPreferences(
            normalizeDisplayPreferences(accountPreferences),
            'account',
        );
    }

    const scope = getPreferenceScope(hasAccountPreferences);
    const preferences = getStoredDisplayPreferences(scope);
    applyDisplayPreferences(preferences, pathname);

    return preferences;
}

export async function saveAccountDisplayPreferences(
    preferences: DisplayPreferences,
    endpoint = '/settings/appearance',
): Promise<void> {
    const normalized = normalizeDisplayPreferences(preferences);
    storeDisplayPreferences(normalized, 'account');

    const csrf = document.head.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    )?.content;
    const response = await fetch(endpoint, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
        },
        body: JSON.stringify(normalized),
    });

    if (!response.ok) throw new Error('Unable to save display preferences');
}

export function persistPagePreference(
    page: PreferencePage,
    patch: Partial<PageDisplayPreference>,
): void {
    if (typeof window === 'undefined') return;

    const scope = getPreferenceScope(
        Boolean(readJson(ACCOUNT_PREFERENCES_KEY)),
    );
    const preferences = getStoredDisplayPreferences(scope);
    if (!preferences.pages[page].enabled) return;
    if (
        Object.entries(patch).every(
            ([key, value]) =>
                preferences.pages[page][key as keyof PageDisplayPreference] ===
                value,
        )
    )
        return;
    preferences.pages[page] = {
        ...preferences.pages[page],
        ...patch,
    };
    storeDisplayPreferences(preferences, scope);

    if (scope === 'account') {
        void saveAccountDisplayPreferences(preferences).catch(() => undefined);
    }
}

export function persistThemePreference(theme: Appearance): void {
    if (typeof window === 'undefined') return;

    const scope = getPreferenceScope(
        Boolean(readJson(ACCOUNT_PREFERENCES_KEY)),
    );
    const preferences = getStoredDisplayPreferences(scope);
    if (preferences.general.theme === theme) return;
    preferences.general.theme = theme;
    storeDisplayPreferences(preferences, scope);

    if (scope === 'account') {
        void saveAccountDisplayPreferences(preferences).catch(() => undefined);
    }
}

export function persistCartConfirmationPreference(
    key: CartConfirmationPreference,
    enabled: boolean,
): void {
    if (typeof window === 'undefined') return;

    const scope = getPreferenceScope(
        Boolean(readJson(ACCOUNT_PREFERENCES_KEY)),
    );
    const preferences = getStoredDisplayPreferences(scope);
    if (preferences.confirmations[key] === enabled) return;

    preferences.confirmations[key] = enabled;
    storeDisplayPreferences(preferences, scope);

    if (scope === 'account') {
        void saveAccountDisplayPreferences(preferences).catch(() => undefined);
    }
}

export function persistSidebarPreference(id: string, open: boolean): void {
    if (id !== 'right' || typeof window === 'undefined') return;

    const page = pageFromPath(window.location.pathname);
    if (page) persistPagePreference(page, { rightSidebarOpen: open });
}
