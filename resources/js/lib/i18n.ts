import { usePage } from '@inertiajs/react'

type I18nMap = Record<string, string>

type SharedWithI18n = {
    i18n?: I18nMap
    locale?: string
}

export function useI18n() {
    const { i18n, locale } = usePage().props as SharedWithI18n
    const map: I18nMap = i18n ?? {}

    function t(key: string, defaultText?: string): string {
        return map[key] ?? defaultText ?? key
    }

    return { t, locale: (locale as string | undefined) ?? 'en' }
}
