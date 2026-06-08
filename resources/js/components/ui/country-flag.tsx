import React, { ComponentType } from 'react';
import * as Flags from 'country-flag-icons/react/3x2';
import { cn } from '@/lib/utils';

type CountryFlagProps = {
    countryCode: string | null | undefined;
    className?: string;
    title?: string;
};

const CODE_ALIASES: Record<string, string> = {
    EN: 'GB',
    UK: 'GB',
};

export function CountryFlag({ countryCode, className = 'w-5', title }: CountryFlagProps) {
    const rawCode = (countryCode ?? '').trim().toUpperCase();
    const code = CODE_ALIASES[rawCode] ?? rawCode;
    const FlagComponent = code.length === 2
        ? (Flags as Record<string, ComponentType<{ title?: string; className?: string }>>)[code]
        : undefined;

    if (FlagComponent) {
        return <FlagComponent title={title ?? code} className={className} />;
    }

    return (
        <div className={cn('rounded-full bg-slate-900 text-[8px] font-bold uppercase text-white flex items-center justify-center', className)}>
            {rawCode ? rawCode.slice(0, 2) : '??'}
        </div>
    );
}

export default CountryFlag;
