import type { ViewMode } from '@/components/ui/view-mode-toggle';
import type { Appearance } from '@/hooks/use-appearance';
import {
    canAccessUsers,
    hasAnyPermission,
    hasPermission,
    isAdmin,
    isDev,
} from '@/lib/roles';
import type { User } from '@/types';

export type AccentColor = 'brand' | 'green' | 'blue' | 'neutral';
export type DisplayDensity = 'comfortable' | 'compact';
export type PreferenceScope = 'local' | 'account';

export const PREFERENCE_PAGES = [
    'dashboard',
    'products',
    'offers',
    'categories',
    'tags',
    'db-products',
    'missing-images',
    'users',
    'promotions',
    'carriers',
    'media',
] as const;

export type PreferencePage = (typeof PREFERENCE_PAGES)[number];

export const SIDEBAR_APPLY_PREFERENCE_EVENT = 'sidebar-apply-preference';

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

const pageViewModes: Record<PreferencePage, ViewMode[]> = {
    dashboard: ['table'],
    products: ['table', 'list', 'grid'],
    offers: ['table'],
    categories: ['table'],
    tags: ['table'],
    'db-products': ['table'],
    'missing-images': ['table'],
    users: ['accordion', 'grid'],
    promotions: ['table'],
    carriers: ['table'],
    media: ['table'],
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

const buildDefaultPages = (): Record<PreferencePage, PageDisplayPreference> => {
    const pages = {} as Record<PreferencePage, PageDisplayPreference>;
    PREFERENCE_PAGES.forEach((page) => {
        pages[page] = {
            enabled: true,
            view: pageViewModes[page][0],
            rightSidebarOpen: false,
            ...(page === 'products' ? { autoOpenCartOnAdd: true } : {}),
        };
    });
    return pages;
};

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
    pages: buildDefaultPages(),
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
    const pagesInput = isRecord(input.pages) ? input.pages : {};

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

    const pages = {} as Record<PreferencePage, PageDisplayPreference>;
    PREFERENCE_PAGES.forEach((page) => {
        const raw = isRecord(pagesInput[page]) ? pagesInput[page] : {};
        const views = pageViewModes[page];
        pages[page] = {
            enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
            view: views.includes(raw.view as ViewMode)
                ? (raw.view as ViewMode)
                : views[0],
            rightSidebarOpen:
                typeof raw.rightSidebarOpen === 'boolean'
                    ? raw.rightSidebarOpen
                    : false,
            ...(page === 'products'
                ? {
                      autoOpenCartOnAdd:
                          typeof raw.autoOpenCartOnAdd === 'boolean'
                              ? raw.autoOpenCartOnAdd
                              : true,
                  }
                : {}),
        };
    });

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
        pages,
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
    if (
        pathname === '/products/images' ||
        pathname.startsWith('/products/images/')
    )
        return 'missing-images';
    if (pathname === '/products' || pathname.startsWith('/products/'))
        return 'products';
    if (pathname === '/users' || pathname.startsWith('/users/')) return 'users';
    if (pathname.startsWith('/admin/users')) return 'users';
    if (pathname === '/' || pathname.startsWith('/dashboard'))
        return 'dashboard';
    if (pathname === '/offres' || pathname.startsWith('/offres/'))
        return 'offers';
    if (pathname.startsWith('/category-products')) return 'categories';
    if (pathname.startsWith('/tags-products')) return 'tags';
    if (pathname.startsWith('/db-products')) return 'db-products';
    if (pathname.startsWith('/promotions')) return 'promotions';
    if (pathname.startsWith('/carriers')) return 'carriers';
    if (pathname.startsWith('/admin/media-manager')) return 'media';
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

    window.dispatchEvent(
        new CustomEvent(SIDEBAR_APPLY_PREFERENCE_EVENT, {
            detail: { id: 'right', open: states.right },
        }),
    );
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

/**
 * Liste des pages de préférences réellement accessibles par l'utilisateur,
 * en miroir de la logique de la barre latérale principale.
 */
export function getAccessiblePreferencePages(
    user: User | null | undefined,
    canManagePromotions = false,
): PreferencePage[] {
    if (!user) return ['products'];

    const pages: PreferencePage[] = ['dashboard', 'products', 'offers'];

    if (isAdmin(user) || hasPermission(user, 'products.categories.manage'))
        pages.push('categories');
    if (isDev(user) || hasPermission(user, 'preview')) pages.push('tags');

    const canManageDbProducts =
        isAdmin(user) ||
        hasPermission(user, 'users.db_products.manage.all') ||
        hasPermission(user, 'users.db_products.manage.his');
    if (canManageDbProducts) pages.push('db-products');
    if (isDev(user) || canManageDbProducts) pages.push('missing-images');

    if (canAccessUsers(user)) pages.push('users');
    if (canManagePromotions) pages.push('promotions');
    if (
        isAdmin(user) ||
        hasAnyPermission(user, [
            'carriers.view',
            'carriers.create',
            'carriers.update',
            'carriers.delete',
            'manage carriers',
        ])
    )
        pages.push('carriers');
    if (isAdmin(user)) pages.push('media');

    return pages;
}
