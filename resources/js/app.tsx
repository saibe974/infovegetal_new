import '../css/app.css';

import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';
type CsrfPageProps = {
    csrf_token?: string;
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
        syncCsrfToken((props.initialPage.props as CsrfPageProps).csrf_token);

        const root = createRoot(el);

        root.render(<App {...props} />);

        router.on('navigate', (event) => {
            syncCsrfToken((event.detail.page.props as CsrfPageProps).csrf_token);
        });
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
