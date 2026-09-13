/** Canonical variable names shared by catalogue and billing templates. */
export const canonicalProductVariable = (key: string) =>
    `%product.${key === 'ref' ? 'reference' : key}%`;

export const sharedDocumentVariables = [
    '%document.date%',
    '%document.count%',
] as const;

/** Existing saved configurations may still use these aliases. */
export const legacyExportVariables = [
    '%export.date%',
    '%export.count%',
] as const;
