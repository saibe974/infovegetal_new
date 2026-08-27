import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';
import { initializeDisplayPreferences } from './lib/display-preferences';

const appName = import.meta.env.VITE_APP_NAME || 'Infovegetal';
type CsrfPageProps = {
    csrf_token?: string;
    appearancePreferences?: unknown;
};

const syncCsrfToken = (token?: string | null) => {
    if (typeof document === 'undefined' || !token) {
        return;
    }

    const meta = document.head.querySelector('meta[name="csrf-token"]');

    if (meta && meta.getAttribute('content') !== token) {
        meta.setAttribute('content', token);
    }
};

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    resolve: (name) =>
        resolvePageComponent(
            `./pages/${name}.tsx`,
            import.meta.glob('./pages/**/*.tsx'),
        ),
    setup({ el, App, props }) {
        const initialProps = props.initialPage.props as CsrfPageProps;
        syncCsrfToken(initialProps.csrf_token);
        initializeDisplayPreferences(
            initialProps.appearancePreferences,
            window.location.pathname,
        );

        const root = createRoot(el);

        root.render(<App {...props} />);

        router.on('navigate', (event) => {
            const pageProps = event.detail.page.props as CsrfPageProps;
            syncCsrfToken(pageProps.csrf_token);
            initializeDisplayPreferences(
                pageProps.appearancePreferences,
                window.location.pathname,
            );
        });
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
