import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { type CartItem } from '@/components/cart/cart.context';
import { buildRollDistribution, type SupplierDistribution } from './product-roll';
import { BE, DE, ES, FR, GB, IT, NL } from 'country-flag-icons/react/3x2';
import { ShoppingCart } from 'lucide-react';

type ProductRollMiniProps = {
    items: CartItem[];
    className?: string;
    getSupplierPrice?: (supplier: SupplierDistribution) => number | null;
};

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));

const TrolleyIcon = ({ fill = 0, isFull = false }: { fill?: number; isFull?: boolean }) => {
    const fillHeight = clamp(fill);
    
    if (isFull) {
        return (
            <div className="relative h-6 w-6">
                <ShoppingCart className="h-6 w-6 text-emerald-500 fill-emerald-500/30" strokeWidth={2} />
            </div>
        );
    }

    return (
        <div className="relative h-6 w-6">
            <ShoppingCart className="h-6 w-6 text-slate-300" strokeWidth={2} />
            <div 
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(${100 - fillHeight}% 0 0 0)` }}
            >
                <ShoppingCart className="h-6 w-6 text-amber-500 fill-amber-500/30" strokeWidth={2} />
            </div>
        </div>
    );
};

const formatCurrency = (value: number): string =>
    value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

const getFlag = (country: string) => {
    switch (country?.toLowerCase()) {
        case 'fr':
            return <FR title="France" className="w-4" />;
        case 'be':
            return <BE title="Belgium" className="w-4" />;
        case 'nl':
            return <NL title="Netherlands" className="w-4" />;
        case 'de':
            return <DE title="Germany" className="w-4" />;
        case 'es':
            return <ES title="Spain" className="w-4" />;
        case 'it':
            return <IT title="Italy" className="w-4" />;
        case 'en':
            return <GB title="United Kingdom" className="w-4" />;
        default:
            return (
                <div className="h-4 w-4 rounded-full bg-slate-900 text-[8px] font-bold uppercase text-white flex items-center justify-center">
                    {country ? country.slice(0, 2) : '??'}
                </div>
            );
    }
};

export function ProductRollMini({ items, className, getSupplierPrice }: ProductRollMiniProps) {
    const distribution = useMemo(() => buildRollDistribution(items), [items]);
    const suppliers = Object.values(distribution.suppliers);
    

    if (suppliers.length === 0) {
        return (
            <div className={cn('rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground', className)}>
                No rolls yet.
            </div>
        );
    }

    return (
        <div className={cn('space-y-2', className)}>
            {suppliers.map((supplier) => {
                const supplierPrice = getSupplierPrice ? getSupplierPrice(supplier) : null;
                // console.log(supplier)

                if (supplier.mod_liv !== 'roll') {
                    return (
                        <div key={supplier.supplierId} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                            {getFlag(supplier.country)}
                            <div className="text-xs text-muted-foreground">devis</div>
                        </div>
                    );
                }

                const fullRolls = supplier.rolls.filter((roll) => roll.coef >= 95).length;
                const partialRolls = supplier.rolls.filter((roll) => roll.coef < 95);

                return (
                    <div key={supplier.supplierId} className="flex items-center gap-3 px-0 py-2 border-b border-accent">
                        {getFlag(supplier.country)}

                        <div className="flex items-center gap-1">
                            {fullRolls > 0 && (
                                <div className="relative">
                                    <TrolleyIcon isFull={true} />
                                    {fullRolls > 1 && (
                                        <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-600 text-[9px] font-bold text-white flex items-center justify-center">
                                            {fullRolls}
                                        </div>
                                    )}
                                </div>
                            )}
                            {partialRolls.map((roll, index) => {
                                const fill = clamp(roll.coef);
                                return (
                                    <TrolleyIcon
                                        key={`${supplier.supplierId}-partial-${index}`}
                                        fill={fill}
                                    />
                                );
                            })}
                        </div>

                        <div className="ml-auto flex flex-col items-end text-[10px]">
                            <span className="font-semibold">{Math.round(supplier.coefAvg * 10) / 10}%</span>
                            <span>{supplierPrice !== null ? formatCurrency(supplierPrice) : 'devis'}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
