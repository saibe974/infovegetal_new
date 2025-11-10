import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import React, { type ComponentProps, useEffect, useState } from 'react';

export type SelectOption = {
    label: string;
    value: string;
    img?: React.ReactNode;
};

type Props = {
    items: SelectOption[];
    placeholder?: string;
    name: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
} & ComponentProps<typeof SelectTrigger>;

export function SelectWithItems({
    items,
    placeholder,
    name,
    defaultValue,
    onValueChange,
    ...props
}: Props) {
    const [value, setValue] = useState<string | undefined>(defaultValue);

    useEffect(() => {
        // Keep in sync if defaultValue changes externally
        setValue(defaultValue);
    }, [defaultValue]);

    const handleValueChange = (newValue: string) => {
        setValue(newValue);
        if (onValueChange) {
            onValueChange(newValue);
        }
    };

    return (
        <>
            <input type="hidden" name={name} value={value ?? ''} />
            <Select value={value} onValueChange={handleValueChange}>
                <SelectTrigger {...props}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.img && item.img}{item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </>
    );
}
