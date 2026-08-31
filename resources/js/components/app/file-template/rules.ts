export const uniqueId = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export type CalculationOperator = '+' | '-' | '*' | '/';
export type CalculationOperand = {
    id: string;
    operator: CalculationOperator | null;
    value: string;
};
export type ParsedCalculation = {
    operands: CalculationOperand[];
    decimals: string;
};

export const parseVariableToken = (token: string) => {
    const match = token.match(
        /^%([a-z0-9_.-]+)(?:\|(date|decimal):([a-z0-9]+))?%$/i,
    );
    if (!match) return null;

    return {
        name: match[1],
        base: `%${match[1]}%`,
        format: match[2] ? `${match[2].toLowerCase()}:${match[3]}` : 'raw',
    };
};

export const formatVariableToken = (base: string, format: string) => {
    if (format === 'raw') return base;
    const parsed = parseVariableToken(base);
    return parsed ? `%${parsed.name}|${format}%` : base;
};

export const formatPreviewValue = (value: string, format: string) => {
    if (value.trim() === '') return value;
    if (format === 'date:dmy') {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
    }
    if (format === 'date:ymd') {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : value;
    }
    if (format.startsWith('decimal:')) {
        const decimals = Number(format.slice('decimal:'.length));
        const numericValue = Number(value);
        return Number.isFinite(numericValue) && decimals >= 0 && decimals <= 4
            ? numericValue.toFixed(decimals)
            : value;
    }

    return value;
};

export const parseCalculationToken = (
    token: string,
): ParsedCalculation | null => {
    const match = token.match(/^%calc:([^|%]+)(?:\|decimal:([0-4]))?%$/i);
    if (!match) return null;

    const parts = match[1].split(/([+\-*/])/).filter(Boolean);
    if (parts.length % 2 === 0) return null;

    const operands: CalculationOperand[] = [];
    for (let index = 0; index < parts.length; index += 2) {
        const operand = parts[index];
        const operator = index === 0 ? null : parts[index - 1];
        if (
            !/^(?:[a-z][a-z0-9_.]*|\d+(?:\.\d+)?)$/i.test(operand) ||
            (operator !== null && !['+', '-', '*', '/'].includes(operator))
        ) {
            return null;
        }
        operands.push({
            id: uniqueId('operand'),
            operator: operator as CalculationOperator | null,
            value: operand,
        });
    }

    return { operands, decimals: match[2] ?? 'raw' };
};

export const serializeCalculation = ({
    operands,
    decimals,
}: ParsedCalculation) => {
    const expression = operands
        .map(
            (operand, index) =>
                `${index === 0 ? '' : (operand.operator ?? '*')}${operand.value}`,
        )
        .join('');
    return `%calc:${expression}${decimals === 'raw' ? '' : `|decimal:${decimals}`}%`;
};

export const evaluatePreviewCalculation = (
    calculation: ParsedCalculation,
    contextValues: Record<string, string>,
) => {
    const resolveOperand = (operand: string) => {
        if (/^\d+(?:\.\d+)?$/.test(operand)) return Number(operand);
        const value = contextValues[operand];
        return value !== undefined &&
            value.trim() !== '' &&
            Number.isFinite(Number(value))
            ? Number(value)
            : null;
    };

    const values = calculation.operands.map((operand) =>
        resolveOperand(operand.value),
    );
    if (!values.length || values.some((value) => value === null)) return null;

    const reducedValues = [values[0] as number];
    const reducedOperators: CalculationOperator[] = [];
    for (let index = 1; index < values.length; index += 1) {
        const operator = calculation.operands[index].operator ?? '*';
        const numericValue = values[index] as number;
        if (operator === '*' || operator === '/') {
            if (operator === '/' && numericValue === 0) return null;
            const previous = reducedValues.pop() ?? 0;
            reducedValues.push(
                operator === '*'
                    ? previous * numericValue
                    : previous / numericValue,
            );
        } else {
            reducedOperators.push(operator);
            reducedValues.push(numericValue);
        }
    }

    let result = reducedValues[0];
    reducedOperators.forEach((operator, index) => {
        result =
            operator === '+'
                ? result + reducedValues[index + 1]
                : result - reducedValues[index + 1];
    });

    if (!Number.isFinite(result)) return null;
    return calculation.decimals === 'raw'
        ? String(result)
        : result.toFixed(Number(calculation.decimals));
};

export const renderRulePreview = (
    value: string,
    values: Record<string, string>,
    emptyInvalidCalculations = false,
) =>
    value.replace(
        /%calc:[^%]+%|%[a-z0-9_.-]+(?:\|(?:date|decimal):[a-z0-9]+)?%/gi,
        (match) => {
            const calculation = parseCalculationToken(match);
            if (calculation) {
                return (
                    evaluatePreviewCalculation(calculation, values) ??
                    (emptyInvalidCalculations ? '' : match)
                );
            }

            const parsed = parseVariableToken(match);
            if (!parsed) return match;
            const replacement = values[parsed.name];
            if (replacement === undefined) return match;
            return formatPreviewValue(replacement, parsed.format);
        },
    );
