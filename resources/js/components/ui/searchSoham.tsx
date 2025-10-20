import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandLoading,
} from "@/components/ui/command";
import { on } from "events";
import { X, LoaderCircleIcon } from "lucide-react";
import React, { useState } from "react";

interface Option {
    value: string;
    label: string;
}

const SearchSoham = ({
    search,
    fetching,
    handleSearch,
    productsSearch,
    onSelect,
}: {
    search: string;
    fetching: boolean;
    handleSearch: (s: string) => void;
    productsSearch: any;
    onSelect: (name: string) => void;
}) => {
    const [selected, setSelected] = useState<Option[]>([]);

    const handleSelect = (name: string) => {
        const option = { value: name, label: name };

        if (!selected.some((s) => s.value === option.value)) {
            const newSelected = [...selected, option];
            setSelected(newSelected);
            onSelect(name);
            // console.log(selected)
        }

        // handleSearch(name);
        // handleSearch("");
    };

    const handleRemove = (value: string) => {
        const newSelected = selected.filter((s) => s.value !== value);
        setSelected(newSelected);
    };

    const handleClear = () => {
        setSelected([]);
        handleSearch("");
        onSelect("");
    };

    return (
        <div className="relative w-full">
            <div className="flex flex-wrap items-center gap-1 border rounded-xl px-2 py-1 min-h-10">
                {selected.map((opt) => (
                    <span
                        key={opt.value}
                        className="bg-muted text-sm px-2 py-0.5 rounded-xl flex items-center gap-1"
                    >
                        {opt.label}
                        <X
                            size={14}
                            className="cursor-pointer hover:text-destructive"
                            onClick={() => handleRemove(opt.value)}
                        />
                    </span>
                ))}

                <Command shouldFilter={false} className="flex-1 border-0 shadow-none">
                    <CommandInput
                        value={search}
                        onValueChange={handleSearch}
                        placeholder="Rechercher Soso"
                        className="flex-1 border-0 shadow-none focus:ring-0"
                    />

                    {search.length >= 3 && (
                        <CommandList className="absolute w-full top-full left-0 mt-1 border bg-popover rounded-xl shadow-lg z-50">
                            {fetching ? (
                                <CommandLoading className="flex items-center justify-center h-10">
                                    <LoaderCircleIcon className="animate-spin mr-2" />
                                </CommandLoading>
                            ) : (
                                <>
                                    <CommandEmpty>Aucun résultat</CommandEmpty>
                                    <CommandGroup heading="Suggestions">
                                        {productsSearch.length > 0 ? (
                                            productsSearch.map((name: string, index: number) => (
                                                <CommandItem key={index} onSelect={() => handleSelect(name)}>
                                                    {name}
                                                </CommandItem>
                                            ))
                                        ) : (
                                            <CommandItem disabled>Aucun résultat</CommandItem>
                                        )}
                                    </CommandGroup>
                                </>
                            )}
                        </CommandList>
                    )}
                </Command>
            </div>

            {/* Bouton Clear global */}
            {(selected.length > 0 || search) && (
                <button
                    onClick={handleClear}
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
};

export default SearchSoham;
