import { renderRulePreview } from '@/components/app/file-template/rules';
import type { VariableFormatType } from '@/components/app/file-template/types';
import type {
    BillingFileBlock,
    BillingFileBlockType,
    BillingFileEvent,
    BillingFileExtension,
    BillingFileTemplate,
} from '@/types';
const documentVariables = [
    '%document.number%',
    '%document.date%',
    '%document.items_total%',
    '%document.shipping_total%',
    '%document.total%',
    '%client.id%',
    '%client.name%',
    '%client.email%',
    '%billing.id%',
    '%billing.name%',
    '%billing.email%',
    '%db.id%',
    '%db.name%',
];

const itemVariables = [
    '%product.id%',
    '%product.reference%',
    '%product.sku%',
    '%product.name%',
    '%product.description%',
    '%product.ean13%',
    '%product.cond%',
    '%product.floor%',
    '%product.roll%',
    '%product.pot%',
    '%product.height%',
    '%product.price%',
    '%product.price_floor%',
    '%product.price_roll%',
    '%product.price_promo%',
    '%quantity%',
    '%unit_price%',
    '%line_total%',
    '%comment%',
];

export const blockLabels: Record<BillingFileBlockType, string> = {
    header: 'Entête',
    items: 'Liste des produits',
    footer: 'Total / pied de fichier',
};

export const eventLabels: Record<BillingFileEvent, string> = {
    order: 'Commande',
    delivery: 'Livraison',
    invoice: 'Facture',
    credit_note: 'Avoir',
};

export const preferredExtension = (
    delimiter: BillingFileTemplate['delimiter'],
): Extract<BillingFileExtension, 'csv' | 'tsv'> =>
    delimiter === '\t' || delimiter === '|' ? 'tsv' : 'csv';

const csvCell = (value: string, delimiter: string): string => {
    if (
        value.includes(delimiter) ||
        value.includes('"') ||
        value.includes('\n') ||
        value.includes('\r')
    ) {
        return `"${value.replaceAll('"', '""')}"`;
    }

    return value;
};

const previewValues: Record<string, string> = {
    'document.number': '00124',
    'document.date': '2026-08-23',
    'document.items_total': '145.00',
    'document.shipping_total': '15.00',
    'document.total': '160.00',
    'order.number': '00124',
    'order.date': '2026-08-23',
    'order.total': '160.00',
    'client.id': '508',
    'client.name': 'Client exemple',
    'client.email': 'client@exemple.test',
    'billing.id': '463',
    'billing.name': 'Facturant exemple',
    'billing.email': 'facturation@exemple.test',
    'db.id': '4',
    'db.name': 'Catalogue exemple',
};

export const previewItems: Array<Record<string, string>> = [
    {
        'product.id': '101',
        'product.reference': 'ROS-01',
        'product.sku': 'ROS-01',
        'product.name': 'Rose rouge',
        'product.description': 'Rose rouge à longue tige',
        'product.ean13': '1234567890123',
        'product.cond': '10',
        'product.floor': '5',
        'product.roll': '4',
        'product.pot': '14.00',
        'product.height': '40-60 cm',
        'product.price_floor': '10.50',
        'product.price_roll': '9.75',
        'product.price_promo': '8.90',
        quantity: '2',
        unit_price: '12.50',
        line_total: '25.00',
        comment: '',
    },
    {
        'product.id': '102',
        'product.reference': 'TUL-02',
        'product.sku': 'TUL-02',
        'product.name': 'Tulipe blanche',
        'product.description': 'Tulipe blanche de saison',
        'product.ean13': '9876543210123',
        'product.cond': '8',
        'product.floor': '6',
        'product.roll': '3',
        'product.pot': '12.00',
        'product.height': '35 cm',
        'product.price_floor': '28.50',
        'product.price_roll': '27.00',
        'product.price_promo': '25.00',
        quantity: '4',
        unit_price: '30.00',
        line_total: '120.00',
        comment: '',
    },
];

export const variableFormatType = (
    variableName: string,
): VariableFormatType | null => {
    if (variableName.endsWith('.date')) return 'date';
    if (
        /^(?:document|order|delivery|invoice|credit_note)\.(?:items_total|shipping_total|total)$/.test(
            variableName,
        ) ||
        /^(?:product\.(?:cond|floor|roll|pot)|quantity|unit_price|line_total)$/.test(
            variableName,
        )
    ) {
        return 'decimal';
    }

    return null;
};

export const replacePreviewVariables = (
    value: string,
    event: BillingFileTemplate['event'],
    item?: Record<string, string>,
) => {
    const values = { ...previewValues, ...item };
    Object.entries(values).forEach(([key, entry]) => {
        if (key.startsWith('document.'))
            values[event + key.slice('document'.length)] = entry;
    });
    return renderRulePreview(value, values);
};

export const renderPreview = (file: BillingFileTemplate): string => {
    const blocks = file.blocks.filter((block) => block.enabled);
    const delimiter = file.delimiter;
    const lines: string[] = [];
    const width = Math.max(0, ...blocks.map((block) => block.columns.length));

    const writeCells = (cells: string[]) => {
        const padded = [
            ...cells,
            ...Array(Math.max(0, width - cells.length)).fill(''),
        ];
        lines.push(
            padded.map((cell) => csvCell(cell, delimiter)).join(delimiter),
        );
    };

    const writeRows = (
        block: BillingFileBlock,
        item?: Record<string, string>,
    ) => {
        block.rows.forEach((row) => {
            writeCells(
                block.columns.map((column) =>
                    replacePreviewVariables(
                        row.cells[column.id] ?? '',
                        file.event,
                        item,
                    ),
                ),
            );
        });
    };

    blocks.forEach((block) => {
        if (block.show_headers) {
            writeCells(block.columns.map((column) => column.name));
        }
        if (block.type === 'items') {
            previewItems.forEach((item) => writeRows(block, item));
        } else {
            writeRows(block);
        }
    });

    return lines.join('\n');
};

export const variablesForBlock = (
    blockType: BillingFileBlockType,
    event: BillingFileTemplate['event'],
) => [
    ...documentVariables,
    `%${event}.number%`,
    `%${event}.date%`,
    `%${event}.total%`,
    ...(blockType === 'items' ? itemVariables : []),
];
