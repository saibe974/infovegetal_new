export const normalizeCountry = (value?: string | null): string | null => {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return trimmed.length === 2 ? trimmed.toUpperCase() : trimmed;
};

export const getCountryLabel = (value: string, locale?: string): string => {
    const normalized = normalizeCountry(value) ?? value;
    if (normalized.length === 2 && typeof Intl !== 'undefined' && typeof Intl.DisplayNames !== 'undefined') {
        const displayNames = new Intl.DisplayNames([locale ?? 'fr'], { type: 'region' });
        return displayNames.of(normalized) ?? normalized;
    }
    return normalized;
};