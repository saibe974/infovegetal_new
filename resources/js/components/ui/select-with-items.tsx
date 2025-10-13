import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { ComponentProps } from 'react';

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
    return (
        <Select name={name} defaultValue={defaultValue}>
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
    );
}
