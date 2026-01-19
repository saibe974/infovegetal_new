import { useState, useRef, useEffect, ReactNode, ReactElement, cloneElement, isValidElement } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, X, Search, SearchIcon, SlidersVerticalIcon, SlidersHorizontalIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { Button } from "../ui/button";
import Heading from "../heading";

interface SearchBarProps {
    value: string;
    onChange: (val: string) => void;
    onSubmit: (val: string, options?: { force?: boolean }) => void;
    propositions?: string[];
    loading?: boolean;
    // Optional total count to display next to the search button
    count?: number;
    // Current query string (e.g., from URL/props) to display as tags
    query?: string;
    placeholder?: string,
    filters?: ReactNode,
    search?: boolean,
    selection?: (string | Option)[]
    filtersActive?: { name: string; label: string }[];
    removeFilter?: (filterName: string) => void;
    // Minimum characters required to show propositions (default: 3). Set to 0 to show on focus.
    minQueryLength?: number;
}

interface Option {
    value: string;
    label: string;
}

export default function SearchSelect({
    value,
    onChange,
    onSubmit,
    propositions,
    loading = false,
    count,
    query,
    placeholder,
    filters = undefined,
    search = true,
    selection = undefined,
    filtersActive = undefined,
    removeFilter = undefined,
    minQueryLength = 3,
}: SearchBarProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [openFilters, setOpenFilters] = useState(false);
    const hasFilters = Boolean(filters);
    const renderedFilters = hasFilters && isValidElement(filters)
        ? cloneElement(filters as ReactElement<{ closeFilters?: () => void }>, {
            closeFilters: () => setOpenFilters(false),
        })
        : filters;

    const toOptions = (arr?: (string | Option)[]) =>
        (arr ?? []).map((s) => (typeof s === "string" ? { value: s, label: s } : s));


    const [selected, setSelected] = useState<Option[]>(toOptions(selection) || []);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const filtersRef = useRef<HTMLDivElement | null>(null);
    const lastMouseDownInsideRef = useRef(false);
    // Resolve list of strings to display as propositions
    const list: string[] = (propositions ?? []) as string[];
    // Track last submitted query to avoid duplicate submit loops
    const lastSubmittedRef = useRef<string | null>(null);

    // Keep internal `selected` in sync when `selection` prop changes (e.g. parent initializes or updates selections)
    useEffect(() => {
        const opts = toOptions(selection);
        setSelected(opts);
        // Prevent immediate onSubmit triggered by selected-change effect
        lastSubmittedRef.current = opts.map((s) => s.value).join(" ");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(selection || [])]);

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

    // console.log(filtersActive)

    const handleClear = () => {
        // if (filtersActive && filtersActive.length > 0) {
        //     filtersActive.forEach((filter) => {
        //         // console.log(filter)
        //         removeFilter?.(filter.name, 'all');
        //     });
        // }
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

        if (e.key === "Backspace" && value === "" && selected.length === 0 && filtersActive && filtersActive.length > 0) {
            e.preventDefault();
            const lastFilter = filtersActive[filtersActive.length - 1];
            removeFilter?.(lastFilter.name);
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


                {hasFilters && (
                    <button
                        type="button"
                        onMouseDown={(e) => { setOpenFilters((v) => !v); }}
                        // onClick={(e) => { e.stopPropagation(); }}
                        className="text-muted-foreground hover:text-foreground px-1"
                        title="Filters"
                    >
                        <SlidersHorizontalIcon size={16} />
                    </button>
                )}

                {filtersActive?.map((filter) => (
                    <span
                        key={filter.name}
                        className="flex items-center gap-1 bg-main-green dark:bg-main-green text-black text-sm px-2 py-0.5 rounded-xl"
                    >
                        {filter.label}
                        <X
                            size={14}
                            className="cursor-pointer hover:text-destructive"
                            onClick={(e) => {
                                e.stopPropagation();
                                removeFilter?.(filter.name);
                            }}
                        />
                    </span>
                ))}

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
                        const v = e.target.value;
                        onChange(v);
                        setOpen(true);
                        // Keep filters open for short queries (<=2 chars) so
                        // the initial list remains visible while typing.
                        // if (hasFilters && v && v.trim() !== '' && v.trim().length >= minQueryLength) {
                        //     setOpenFilters(false);
                        // }
                    }}
                    onFocus={(e) => {
                        if (hasFilters) {
                            setOpenFilters(true);
                        }
                        if (e.target.value.trim().length >= minQueryLength) {
                            setOpen(true);
                        } else if (minQueryLength === 0) {
                            setOpen(true);
                        }
                    }}
                    onBlur={() => {
                        // Délai pour permettre aux interactions avec le panneau (Select, boutons) de se terminer
                        setTimeout(() => {
                            // Si mouseDown a commencé dans le panneau, ne pas fermer
                            if (lastMouseDownInsideRef.current) {
                                lastMouseDownInsideRef.current = false;
                                return;
                            }

                            const active = document.activeElement as Element | null;

                            // Vérifier si le focus est toujours dans le panneau de filtres
                            if (filtersRef.current && active && filtersRef.current.contains(active)) {
                                return;
                            }

                            // Vérifier si le focus est dans un Select portal (radix-ui portals)
                            if (active && active.closest('[role="listbox"]')) {
                                return;
                            }

                            // Vérifier si le focus est dans un autre portal radix
                            if (active && active.closest('[data-radix-popper-content-wrapper]')) {
                                return;
                            }

                            setOpenFilters(false);
                            setOpen(false);
                        }, 150);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder ?? t('Search...')}
                    className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 min-w-[100px] text-sm"
                />

                {/* Bouton clear */}
                {( selected.length > 0 || value) && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-muted-foreground hover:text-destructive px-1"
                    >
                        <X size={16} />
                    </button>
                )}

                {/* Bouton recherche */}
                {search && (
                    <button
                        type="button"
                        onClick={handleSearch}
                        className="text-muted-foreground hover:text-foreground px-1"
                    >
                        <SearchIcon size={16} />
                    </button>
                )}

                {/* Petit compteur d'occurrences */}
                {typeof count === 'number' && (
                    <span className="ml-2 text-xs text-muted-foreground">
                        {count > 1 ? `${count} ${t('results')}` : count === 0 ? t('No results.') : ''}
                    </span>
                )}
            </div>

            {/* Panneau combiné filtres + propositions */}
            {(openFilters || (open && value.length >= minQueryLength)) && (
                <div
                    ref={filtersRef}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        lastMouseDownInsideRef.current = true;
                    }}
                    className="absolute top-full left-0 w-full mt-1 py-4 px-2 border bg-popover rounded-md shadow-lg z-50 max-h-120 overflow-y-auto"
                >
                    <div className={cn(
                        "flex flex-col md:flex-row gap-4",
                        open && value.length >= minQueryLength ? "md:flex-row" : "flex-col"
                    )}>

                        {/* Propositions */}
                        {open && value.length >= minQueryLength && (
                            <div className={cn(
                                "px-4",
                                openFilters && renderedFilters ? "md:w-1/2 md:border-r md:border-r-accent" : "w-full"
                            )}>
                                <Heading title={t('Propositions')} />
                                {loading ? (
                                    <div className="flex justify-center items-center py-2 text-muted-foreground">
                                        <Loader2 className="animate-spin mr-2" size={16} /> {t('Search...')}
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
                                        {t('No results.')}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Filtres */}
                        {openFilters && renderedFilters && (
                            <div className={cn(
                                "px-4",
                                open && value.length >= minQueryLength ? "md:w-1/2" : "w-full"
                            )}>
                                <Heading title={t('Filters')} />
                                {renderedFilters}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
}
