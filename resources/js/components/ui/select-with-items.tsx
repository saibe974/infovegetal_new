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
};

type Props = {
    items: SelectOption[];
    placeholder?: string;
    name: string;
    defaultValue?: string;
} & ComponentProps<typeof SelectTrigger>;

export function SelectWithItems({
    items,
    placeholder,
    name,
    defaultValue,
    ...props
}: Props) {
    const [value, setValue] = useState<string | undefined>(defaultValue);

    useEffect(() => {
        // Keep in sync if defaultValue changes externally
        setValue(defaultValue);
    }, [defaultValue]);

    return (
        <>
            <input type="hidden" name={name} value={value ?? ''} />
            <Select value={value} onValueChange={setValue}>
                <SelectTrigger {...props}>
                    <SelectValue placeholder={placeholder} />
                </SelectTrigger>
                <SelectContent>
                    {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </>
    );
}
