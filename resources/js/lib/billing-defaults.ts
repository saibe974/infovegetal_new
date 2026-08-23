import type {
    BillingDefaults,
    BillingFileBlock,
    BillingFileTemplate,
    SalesConditionProfile,
    SalesConditions,
} from '@/types';

export const createOrderCsvTemplate = (): BillingFileTemplate => ({
    id: 'order-csv',
    name: 'Commande CSV',
    filename: '%document.number%_%document.date%_commande_%db.name%',
    event: 'order',
    events: ['order'],
    enabled: true,
    shared: false,
    delimiter: ';',
    extension: 'csv',
    system: true,
    blocks: [
        {
            id: 'items',
            name: 'Liste des produits',
            type: 'items',
            enabled: true,
            show_headers: true,
            columns: [
                { id: 'reference', name: 'Reference' },
                { id: 'designation', name: 'Designation' },
                { id: 'quantity', name: 'Quantite' },
                { id: 'unit-price', name: 'Prix unitaire' },
                { id: 'line-total', name: 'Total' },
            ],
            rows: [
                {
                    id: 'item-row',
                    cells: {
                        reference: '%product.reference%',
                        designation: '%product.name%',
                        quantity: '%quantity%',
                        'unit-price': '%unit_price%',
                        'line-total': '%line_total%',
                    },
                },
            ],
        },
    ],
});

export const createOrderPdfTemplate = (): BillingFileTemplate => ({
    id: 'order-pdf',
    name: 'Commande PDF',
    filename: '%document.number%_%document.date%',
    event: 'order',
    events: ['order'],
    enabled: true,
    shared: true,
    delimiter: ';',
    extension: 'pdf',
    system: true,
    blocks: [],
});

const normalizeRows = (
    rows: unknown,
    columns: BillingFileBlock['columns'],
    prefix: string,
): BillingFileBlock['rows'] =>
    Array.isArray(rows)
        ? rows
              .filter(
                  (
                      row,
                  ): row is {
                      id?: string;
                      cells?: Record<string, unknown>;
                  } => !!row && typeof row === 'object',
              )
              .map((row, rowIndex) => ({
                  id: String(row.id || `${prefix}-row-${rowIndex + 1}`),
                  cells: Object.fromEntries(
                      columns.map((column) => [
                          column.id,
                          String(row.cells?.[column.id] ?? ''),
                      ]),
                  ),
              }))
        : [];

const normalizeBlocks = (
    file: BillingFileTemplate,
    legacyColumns: BillingFileBlock['columns'],
): BillingFileBlock[] => {
    if (Array.isArray(file.blocks) && file.blocks.length > 0) {
        return file.blocks
            .filter(
                (block): block is BillingFileBlock =>
                    !!block && typeof block === 'object',
            )
            .map((block, blockIndex) => {
                const columns = Array.isArray(block.columns)
                    ? block.columns.map((column, columnIndex) => ({
                          id: String(
                              column.id ||
                                  `block-${blockIndex + 1}-column-${columnIndex + 1}`,
                          ),
                          name: String(
                              column.name || `Colonne ${columnIndex + 1}`,
                          ),
                      }))
                    : legacyColumns;

                return {
                    id: String(block.id || `block-${blockIndex + 1}`),
                    name: String(block.name || `Bloc ${blockIndex + 1}`),
                    type: ['header', 'items', 'footer'].includes(block.type)
                        ? block.type
                        : 'header',
                    enabled: block.enabled !== false,
                    show_headers:
                        typeof block.show_headers === 'boolean'
                            ? block.show_headers
                            : block.type === 'items',
                    columns,
                    rows: normalizeRows(
                        block.rows,
                        columns,
                        `block-${blockIndex + 1}`,
                    ),
                };
            });
    }

    return [
        {
            id: 'legacy-lines',
            name:
                file.scope === 'items' ? 'Liste des produits' : 'Lignes fixes',
            type: file.scope === 'items' ? 'items' : 'header',
            enabled: true,
            show_headers: true,
            columns: legacyColumns,
            rows: normalizeRows(file.rows, legacyColumns, 'legacy'),
        },
    ];
};

const normalizeFiles = (
    value: BillingDefaults,
): BillingFileTemplate[] | undefined => {
    if (!Array.isArray(value.files)) {
        return undefined;
    }

    return value.files
        .filter(
            (file): file is BillingFileTemplate =>
                !!file && typeof file === 'object',
        )
        .map((file, fileIndex) => {
            const event = [
                'order',
                'delivery',
                'invoice',
                'credit_note',
            ].includes(file.event)
                ? file.event
                : 'order';
            const events = (
                Array.isArray(file.events) ? file.events : [event]
            ).filter((item): item is BillingFileTemplate['event'] =>
                ['order', 'delivery', 'invoice', 'credit_note'].includes(item),
            );
            const columns = Array.isArray(file.columns)
                ? file.columns.map((column, columnIndex) => ({
                      id: String(column.id || `column-${columnIndex + 1}`),
                      name: String(column.name || `Colonne ${columnIndex + 1}`),
                  }))
                : [];

            return {
                id: String(file.id || `file-${fileIndex + 1}`),
                name: String(file.name || `Fichier ${fileIndex + 1}`),
                filename: String(
                    file.filename ||
                        `%document.number%_%document.date%_${file.name || `fichier-${fileIndex + 1}`}_%db.name%`,
                ),
                event,
                events: events.length ? events : [event],
                enabled: file.enabled !== false,
                shared: Boolean(file.shared),
                delimiter: [';', ',', '\t', '|'].includes(file.delimiter)
                    ? file.delimiter
                    : ';',
                extension: ['csv', 'tsv', 'pdf', 'xls'].includes(file.extension)
                    ? file.extension
                    : ['\t', '|'].includes(file.delimiter)
                      ? 'tsv'
                      : 'csv',
                system: Boolean(file.system),
                blocks:
                    file.id === 'order-pdf'
                        ? []
                        : normalizeBlocks(file, columns),
            };
        });
};

export const ensureOrderCsvTemplate = (
    value: BillingDefaults,
): BillingDefaults => {
    const files = normalizeFiles(value) ?? [];
    const withOrderCsv = files.some((file) => file.id === 'order-csv')
        ? files
        : [createOrderCsvTemplate(), ...files];
    return {
        ...value,
        files: withOrderCsv.some((file) => file.id === 'order-pdf')
            ? withOrderCsv
            : [createOrderPdfTemplate(), ...withOrderCsv],
    };
};

const normalizeConditions = (
    value: SalesConditions | undefined,
): SalesConditions => {
    if (!value) {
        return {};
    }

    const entries = Object.entries(value).sort(([a], [b]) =>
        a.localeCompare(b),
    );
    return Object.fromEntries(entries);
};

const toProfileId = (seed: string, index: number): string => {
    const base = seed
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (base.length > 0) {
        return base;
    }

    return `profile-${index + 1}`;
};

export const normalizeBillingDefaultsToProfiles = (
    value: BillingDefaults | SalesConditions | undefined,
): BillingDefaults => {
    if (!value || typeof value !== 'object') {
        return {
            profiles: [
                {
                    id: 'standard',
                    name: 'Standard',
                    conditions: {},
                },
            ],
            default_profile_id: 'standard',
        };
    }

    const maybeProfiles = (value as BillingDefaults).profiles;
    if (Array.isArray(maybeProfiles)) {
        const profiles: SalesConditionProfile[] = maybeProfiles
            .filter(
                (profile) => typeof profile === 'object' && profile !== null,
            )
            .map((profile, index) => {
                const name = String(profile.name ?? `Profile ${index + 1}`);
                return {
                    id: String(profile.id ?? toProfileId(name, index)),
                    name,
                    conditions: normalizeConditions(profile.conditions ?? {}),
                };
            });

        if (profiles.length === 0) {
            profiles.push({ id: 'standard', name: 'Standard', conditions: {} });
        }

        const requestedDefault = (value as BillingDefaults).default_profile_id;
        const default_profile_id = profiles.some(
            (profile) => profile.id === requestedDefault,
        )
            ? (requestedDefault ?? profiles[0].id)
            : profiles[0].id;

        return {
            profiles,
            default_profile_id,
            ...(normalizeFiles(value as BillingDefaults)
                ? { files: normalizeFiles(value as BillingDefaults) }
                : {}),
        };
    }

    const legacyConditions = { ...(value as Record<string, unknown>) };
    delete legacyConditions.files;
    delete legacyConditions.default_profile_id;

    return {
        profiles: [
            {
                id: 'standard',
                name: 'Standard',
                conditions: normalizeConditions(
                    legacyConditions as SalesConditions,
                ),
            },
        ],
        default_profile_id: 'standard',
        ...(normalizeFiles(value as BillingDefaults)
            ? { files: normalizeFiles(value as BillingDefaults) }
            : {}),
    };
};

export const profilesToBillingDefaults = (
    value: BillingDefaults,
): BillingDefaults => {
    const normalized = normalizeBillingDefaultsToProfiles(value);

    return {
        profiles: normalized.profiles.map((profile, index) => ({
            id: String(profile.id || toProfileId(profile.name, index)),
            name: String(profile.name || `Profile ${index + 1}`),
            conditions: normalizeConditions(profile.conditions ?? {}),
        })),
        default_profile_id: normalized.default_profile_id ?? null,
        ...(normalized.files ? { files: normalized.files } : {}),
    };
};
