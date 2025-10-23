import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
    value: string;
    onChange: (val: string) => void;
    onSubmit: (val: string, options?: { force?: boolean }) => void;
    suggestions?: string[];
    propositions?: string[];
    loading?: boolean;
    // Optional total count to display next to the search button
    count?: number;
    // Current query string (e.g., from URL/props) to display as tags
    query?: string;
}

interface Option {
    value: string;
    label: string;
}

export default function SearchSoham({
    value,
    onChange,
    onSubmit,
    propositions,
    loading = false,
    count,
    query,
}: SearchBarProps) {
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<Option[]>([]);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    // Resolve list of strings to display as propositions
    const list: string[] = (propositions ?? []) as string[];
    // Track last submitted query to avoid duplicate submit loops
    const lastSubmittedRef = useRef<string | null>(null);

    const handleSelect = (name: string) => {
        const option = { value: name, label: name };
        if (!selected.some((s) => s.value === option.value)) {
            const newSelected = [...selected, option];
            setSelected(newSelected);
            // const query = newSelected.map((s) => s.value).join(" ");
            // onSubmit(query);
        }
        setHighlightedIndex(-1);
        setOpen(false);
        onChange("");
    };

    const handleRemove = (name: string) => {
        const newSelected = selected.filter((s) => s.value !== name);
        setSelected(newSelected);
        // Si plus aucun tag, forcer la suppression de la recherche côté URL
        if (newSelected.length === 0) {
            onSubmit('', { force: true });
        }
    };

    const handleClear = () => {
        setSelected([]);
        onChange("");
        onSubmit("", { force: true });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {

        if (!open && e.key === "ArrowDown" && list.length > 0) {
            setOpen(true);
            setHighlightedIndex(0);
            return;
        }

        if (e.key === "Backspace" && value === "" && selected.length > 0) {
            e.preventDefault();
            const last = selected[selected.length - 1];
            handleRemove(last.value);
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev < list.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev > 0 ? prev - 1 : list.length - 1
            );
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < list.length) {
                handleSelect(list[highlightedIndex]);
            } else if (value.trim()) {
                handleSelect(value);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
            setHighlightedIndex(-1);
        }
    };

    const handleSearch = () => {
        if (value.trim()) handleSelect(value);
    };

    useEffect(() => {
        if (!value) setOpen(false);
    }, [value]);

    // Sync incoming query string into selected tags (as spans)
    useEffect(() => {
        if (query === undefined) return;
        const tokens = query
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        const uniq = Array.from(new Set(tokens));
        const opts = uniq.map((t) => ({ value: t, label: t }));
        setSelected(opts);
        // Prevent immediate resubmit with the same value
        lastSubmittedRef.current = uniq.join(" ");
    }, [query]);

    useEffect(() => {
        // Ne rien soumettre au montage si aucune sélection, pour ne pas envoyer q=""
        if (selected.length === 0) return;
        const next = selected.map((s) => s.value).join(" ");
        if (lastSubmittedRef.current === next) return;
        lastSubmittedRef.current = next;
        onSubmit(next);
    }, [selected]);

    return (
        <div className="relative w-full">
            <div
                className={cn(
                    "flex items-center flex-wrap gap-1 border rounded-md px-2 py-1 min-h-10 bg-background",
                    "focus-within:ring-2 focus-within:ring-ring focus-within:border-ring transition"
                )}
                onClick={() => inputRef.current?.focus()}
            >
                {selected.map((opt) => (
                    <span
                        key={opt.value}
                        className="flex items-center gap-1 bg-muted text-sm px-2 py-0.5 rounded-xl"
                    >
                        {opt.label}
                        <X
                            size={14}
                            className="cursor-pointer hover:text-destructive"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemove(opt.value);
                            }}
                        />
                    </span>
                ))}

                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setOpen(true);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search..."
                    className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 min-w-[100px] text-sm"
                />

                {/* Bouton clear */}
                {(selected.length > 0 || value) && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-muted-foreground hover:text-foreground px-1"
                    >
                        <X size={16} />
                    </button>
                )}

                {/* Bouton recherche */}
                <button
                    type="button"
                    onClick={handleSearch}
                    className="text-muted-foreground hover:text-foreground px-1"
                >
                    <Search size={16} />
                </button>

                {/* Petit compteur d'occurrences */}
                {typeof count === 'number' && (
                    <span className="ml-2 text-xs text-muted-foreground">
                        {count > 1 ? `${count} results found` : count === 0 ? 'aucun résultat' : ''}
                    </span>
                )}
            </div>

            {/* propositions */}
            {open && value.length >= 2 && (
                <div className="absolute top-full left-0 w-full mt-1 border bg-popover rounded-md shadow-lg z-50">
                    {loading ? (
                        <div className="flex justify-center items-center py-2 text-muted-foreground">
                            <Loader2 className="animate-spin mr-2" size={16} /> Search...
                        </div>
                    ) : list.length > 0 ? (
                        list.map((name: string, i: number) => (
                            <button
                                key={i}
                                onClick={() => handleSelect(name)}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-sm rounded-sm transition-colors",
                                    highlightedIndex === i
                                        ? "bg-accent text-accent-foreground"
                                        : "hover:bg-accent/60 hover:text-accent-foreground"
                                )}
                            >
                                {name}
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                            Aucun résultat.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
