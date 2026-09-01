import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import Select, {
    components,
    type MultiValue,
    type OptionProps,
} from 'react-select';
import type { ReactNode } from 'react';

export type BadgeMultiSelectOption = {
    value: string;
    label: string;
    icon?: ReactNode;
};

function BadgeOption(props: OptionProps<BadgeMultiSelectOption, true>) {
    return (
        <components.Option {...props}>
            <span className="flex min-w-0 items-center gap-2">
                <Check
                    className={cn(
                        'size-3.5 shrink-0',
                        props.isSelected ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden="true"
                />
                {props.data.icon}
                <span className="truncate">{props.data.label}</span>
            </span>
        </components.Option>
    );
}

export function BadgeMultiSelect({
    id,
    label,
    placeholder,
    options,
    value,
    onChange,
    showAllOptionsWhenEmpty = false,
}: {
    id: string;
    label: string;
    placeholder: string;
    options: BadgeMultiSelectOption[];
    value: string[];
    onChange: (values: string[]) => void;
    showAllOptionsWhenEmpty?: boolean;
}) {
    const selectedOptions = showAllOptionsWhenEmpty && value.length === 0
        ? options
        : value
            .map((selectedValue) => options.find((option) => option.value === selectedValue))
            .filter((option): option is BadgeMultiSelectOption => Boolean(option));

    return (
        <div className="space-y-2">
            <label
                htmlFor={id}
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
                {label}
            </label>
            <Select<BadgeMultiSelectOption, true>
                instanceId={id}
                inputId={id}
                isMulti
                unstyled
                options={options}
                value={selectedOptions}
                placeholder={placeholder}
                closeMenuOnSelect={false}
                hideSelectedOptions={false}
                maxMenuHeight={160}
                isClearable
                isSearchable={options.length > 8}
                controlShouldRenderValue
                components={{ Option: BadgeOption }}
                formatOptionLabel={(option) => (
                    <span className="flex min-w-0 items-center gap-1.5">
                        {option.icon}
                        <span className="truncate">{option.label}</span>
                    </span>
                )}
                onChange={(next: MultiValue<BadgeMultiSelectOption>) => {
                    const nextValues = next.map((option) => option.value);
                    const hasEveryOption = showAllOptionsWhenEmpty
                        && options.every((option) => nextValues.includes(option.value));

                    onChange(hasEveryOption ? [] : nextValues);
                }}
                noOptionsMessage={() => null}
                classNames={{
                    control: ({ isFocused, selectProps }) => cn(
                        'min-h-10 cursor-text rounded-md border border-input bg-muted/40 px-1 py-0.5 text-sm shadow-xs transition',
                        isFocused && 'border-ring ring-2 ring-ring',
                        selectProps.menuIsOpen && 'border-brand-main/40 bg-brand-main/5',
                    ),
                    valueContainer: () => 'flex flex-wrap gap-1 p-0',
                    multiValue: () => 'rounded-full border border-brand-main/30 bg-brand-main/10 text-foreground',
                    multiValueLabel: () => 'px-2 py-1',
                    multiValueRemove: () => 'rounded-r-full px-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive',
                    input: () => 'm-0 bg-transparent p-0 text-foreground',
                    placeholder: () => 'px-1 text-muted-foreground',
                    indicatorsContainer: () => 'text-muted-foreground',
                    clearIndicator: () => 'cursor-pointer p-1 hover:text-destructive',
                    dropdownIndicator: ({ selectProps }) => cn(
                        'cursor-pointer rounded-sm p-1 transition-all hover:text-foreground',
                        selectProps.menuIsOpen && 'rotate-180 bg-brand-main/15 text-brand-main',
                    ),
                    indicatorSeparator: () => 'mx-1 w-px bg-border',
                    menu: () => 'z-50 mt-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
                    menuList: () => 'max-h-40 overflow-y-auto',
                    option: ({ isFocused, isSelected }) => cn(
                        'cursor-pointer rounded-sm px-2 py-1.5 text-sm',
                        (isFocused || isSelected) && 'bg-accent text-accent-foreground',
                    ),
                    noOptionsMessage: () => 'px-2 py-1.5 text-sm text-muted-foreground',
                }}
            />
        </div>
    );
}
