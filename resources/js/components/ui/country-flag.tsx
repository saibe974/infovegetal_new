import React, { ComponentType } from 'react';
import * as Flags from 'country-flag-icons/react/3x2';

type CountryFlagProps = {
    countryCode: string | null | undefined;
    className?: string;
    title?: string;
};

export function CountryFlag({ countryCode, className = 'w-5', title }: CountryFlagProps) {
    const code = (countryCode ?? '').trim().toUpperCase();
    const FlagComponent = code.length === 2
        ? (Flags as Record<string, ComponentType<{ title?: string; className?: string }>>)[code]
        : undefined;

    if (FlagComponent) {
        return <FlagComponent title={title ?? code} className={className} />;
    }

    return (
        <div className="h-4 w-4 rounded-full bg-slate-900 text-[8px] font-bold uppercase text-white flex items-center justify-center">
            {code ? code.slice(0, 2) : '??'}
        </div>
    );
}

export default CountryFlag;
