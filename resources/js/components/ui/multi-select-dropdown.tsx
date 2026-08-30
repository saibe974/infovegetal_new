import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export type MultiSelectOption = {
    value: string;
    text: string;
    label: ReactNode;
};

type Props = {
    label: string;
    allLabel: string;
    options: MultiSelectOption[];
    selected: string[];
    onApply: (values: string[]) => void;
    applyLabel: string;
    clearLabel: string;
};

export function MultiSelectDropdown({
    label,
    allLabel,
    options,
    selected,
    onApply,
    applyLabel,
    clearLabel,
}: Props) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<string[]>(selected);

    useEffect(() => {
        if (!open) {
            setDraft(selected);
        }
    }, [selected, open]);

    const summaryValues = selected
        .map((value) => options.find((option) => option.value === value)?.text ?? value);
    const summary = summaryValues.length === 0
        ? allLabel
        : summaryValues.length <= 2
            ? summaryValues.join(', ')
            : `${summaryValues.slice(0, 2).join(', ')} +${summaryValues.length - 2}`;

    return (
        <div className="w-full space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
            <DropdownMenu
                modal={false}
                open={open}
                onOpenChange={(nextOpen) => {
                    if (nextOpen) {
                        setDraft(selected);
                    }
                    setOpen(nextOpen);
                }}
            >
                <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="w-full justify-between rounded-md border border-input">
                        <span className="truncate">{summary}</span>
                        <ChevronDown className="size-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                    <div className="max-h-60 overflow-y-auto">
                        {options.map((option) => (
                            <DropdownMenuCheckboxItem
                                key={option.value}
                                checked={draft.includes(option.value)}
                                onCheckedChange={() => {
                                    setDraft((current) => current.includes(option.value)
                                        ? current.filter((value) => value !== option.value)
                                        : [...current, option.value]);
                                }}
                                onSelect={(event) => event.preventDefault()}
                            >
                                {option.label}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </div>
                    <DropdownMenuSeparator />
                    <div className="flex items-center justify-end gap-2 p-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setDraft([])}>
                            {clearLabel}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                                onApply(draft);
                                setOpen(false);
                            }}
                        >
                            {applyLabel}
                        </Button>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}