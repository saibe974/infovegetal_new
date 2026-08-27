import { useSidebar } from '@/components/ui/sidebar';
import {
    defaultDisplayPreferences,
    getPreferenceScope,
    getStoredDisplayPreferences,
} from '@/lib/display-preferences';
import type { SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { useCallback } from 'react';

const MOBILE_MEDIA_QUERY = '(max-width: 1023px)';

export function useCartAutoOpen() {
    const { appearancePreferences } = usePage<SharedData>().props;
    const { isMobile, isOpenId, openSidebar } = useSidebar();

    return useCallback(() => {
        if (
            isMobile ||
            (typeof window !== 'undefined' &&
                window.matchMedia(MOBILE_MEDIA_QUERY).matches)
        ) {
            return;
        }

        const preferences = getStoredDisplayPreferences(
            getPreferenceScope(Boolean(appearancePreferences)),
        );
        const products = preferences.pages.products;
        const autoOpen = products.enabled
            ? products.autoOpenCartOnAdd
            : defaultDisplayPreferences.pages.products.autoOpenCartOnAdd;

        if (autoOpen && !isOpenId('right')) {
            openSidebar('right', { persist: false });
        }
    }, [appearancePreferences, isMobile, isOpenId, openSidebar]);
}
