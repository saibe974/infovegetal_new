export const resolveImageUrl = (src?: string | null): string => {
    if (!src || typeof window === 'undefined') return src ?? '';
    const origin = window.location.origin;
    const isLocal = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
    if (!isLocal) return src;

    if (src.startsWith('/')) {
        return `${origin}${src}`;
    }

    if (src.startsWith('http://localhost/') || src.startsWith('https://localhost/')) {
        return `${origin}/${src.split('/').slice(3).join('/')}`;
    }

    return src;
};
