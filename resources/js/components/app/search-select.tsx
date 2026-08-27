import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import * as Flags from 'country-flag-icons/react/3x2';
import {
    Camera,
    CameraOff,
    Diameter,
    Loader2,
    MoveVertical,
    SearchIcon,
    SlidersHorizontalIcon,
    X,
    Zap,
} from 'lucide-react';
import {
    ReactElement,
    ReactNode,
    cloneElement,
    isValidElement,
    useEffect,
    useRef,
    useState,
    type ComponentType,
} from 'react';
import CountryFlag from '../ui/country-flag';

interface SearchBarProps {
    className?: string;
    value: string;
    onChange: (val: string) => void;
    onSubmit: (val: string, options?: { force?: boolean }) => void;
    onSelectOption?: (option: Option) => boolean | void;
    propositions?: (string | Option)[];
    loading?: boolean;
    // Optional total count to display next to the search button
    count?: number;
    // Current query string (e.g., from URL/props) to display as tags
    query?: string;
    placeholder?: string;
    filters?: ReactNode;
    search?: boolean;
    compactMobile?: boolean;
    selection?: (string | Option)[];
    multiple?: boolean;
    fixedFilters?: {
        name: string;
        label: string;
        country?: string;
        title?: string;
    }[];
    filtersActive?: {
        name: string;
        label: string;
        value?: string;
        values?: string[];
    }[];
    removeFilter?: (filterName: string) => void;
    clearAll?: () => void;
    // Minimum characters required to show propositions (default: 3). Set to 0 to show on focus.
    minQueryLength?: number;
}

export type Option = {
    value: string;
    label: string;
    description?: string;
    country?: string;
    icone?: string;
    badge?: string;
    kind?: string;
    id?: number;
};

const areOptionsEqual = (a: Option[], b: Option[]): boolean => {
    if (a.length !== b.length) {
        return false;
    }

    return a.every((opt, index) => {
        const other = b[index];
        return (
            opt.value === other?.value &&
            opt.label === other?.label &&
            (opt.description ?? '') === (other?.description ?? '')
        );
    });
};

export default function SearchSelect({
    className,
    value,
    onChange,
    onSubmit,
    onSelectOption,
    propositions,
    loading = false,
    count,
    query,
    placeholder,
    filters = undefined,
    search = true,
    compactMobile = false,
    selection = undefined,
    multiple = true,
    fixedFilters = undefined,
    filtersActive = undefined,
    removeFilter = undefined,
    clearAll = undefined,
    minQueryLength = 3,
}: SearchBarProps) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [openFilters, setOpenFilters] = useState(false);
    const hasFilters = Boolean(filters);
    const renderedFilters =
        hasFilters && isValidElement(filters)
            ? cloneElement(
                filters as ReactElement<{ closeFilters?: () => void }>,
                {
                    closeFilters: () => setOpenFilters(false),
                },
            )
            : filters;

    const toOptions = (arr?: (string | Option)[]) =>
        (arr ?? []).map((s) =>
            typeof s === 'string' ? { value: s, label: s } : s,
        );

    const [selected, setSelected] = useState<Option[]>(
        toOptions(selection) || [],
    );
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listOptions = toOptions(propositions);
    // Track last submitted query to avoid duplicate submit loops
    const lastSubmittedRef = useRef<string | null>(null);
    const onSubmitRef = useRef(onSubmit);

    useEffect(() => {
        onSubmitRef.current = onSubmit;
    }, [onSubmit]);

    // Keep internal `selected` in sync when `selection` prop changes (e.g. parent initializes or updates selections)
    useEffect(() => {
        const opts = toOptions(selection);
        setSelected((prev) => (areOptionsEqual(prev, opts) ? prev : opts));
        // Prevent immediate onSubmit triggered by selected-change effect
        lastSubmittedRef.current = opts.map((s) => s.value).join(' ');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(selection || [])]);

    const handleSelectOption = (option: Option) => {
        if (onSelectOption?.(option) === true) {
            setHighlightedIndex(-1);
            setOpen(false);
            onChange('');
            return;
        }

        const selection = { value: option.value, label: option.label };
        if (multiple) {
            if (!selected.some((s) => s.value === selection.value)) {
                setSelected([...selected, selection]);
            }
        } else {
            setSelected([selection]);
            // const query = newSelected.map((s) => s.value).join(" ");
            // onSubmit(query);
        }
        setHighlightedIndex(-1);
        setOpen(false);
        onChange('');
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
        onChange('');
        if (clearAll) {
            clearAll();
            return;
        }
        onSubmit('', { force: true });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open && e.key === 'ArrowDown' && listOptions.length > 0) {
            setOpen(true);
            setHighlightedIndex(0);
            return;
        }

        if (e.key === 'Backspace' && value === '' && selected.length > 0) {
            e.preventDefault();
            const last = selected[selected.length - 1];
            handleRemove(last.value);
            return;
        }

        if (
            e.key === 'Backspace' &&
            value === '' &&
            selected.length === 0 &&
            filtersActive &&
            filtersActive.length > 0
        ) {
            e.preventDefault();
            const lastFilter = filtersActive[filtersActive.length - 1];
            removeFilter?.(lastFilter.name);
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev < listOptions.length - 1 ? prev + 1 : 0,
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev > 0 ? prev - 1 : listOptions.length - 1,
            );
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (
                highlightedIndex >= 0 &&
                highlightedIndex < listOptions.length
            ) {
                handleSelectOption(listOptions[highlightedIndex]);
            } else if (value.trim()) {
                handleSelectOption({ value, label: value });
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
            setHighlightedIndex(-1);
        }
    };

    const handleSearch = () => {
        if (value.trim()) handleSelectOption({ value, label: value });
    };

    useEffect(() => {
        if (!value && minQueryLength > 0) setOpen(false);
    }, [value, minQueryLength]);

    // Sync incoming query string into selected tags (as spans)
    useEffect(() => {
        if (query === undefined) return;
        const tokens = query
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        const uniq = Array.from(new Set(tokens));
        const opts = uniq.map((t) => ({ value: t, label: t }));
        setSelected((prev) => (areOptionsEqual(prev, opts) ? prev : opts));
        // Prevent immediate resubmit with the same value
        lastSubmittedRef.current = uniq.join(' ');
    }, [query]);

    useEffect(() => {
        // Ne rien soumettre au montage si aucune sélection, pour ne pas envoyer q=""
        if (selected.length === 0) return;
        const next = selected.map((s) => s.value).join(' ');
        if (lastSubmittedRef.current === next) return;
        lastSubmittedRef.current = next;
        onSubmitRef.current(next);
    }, [selected]);

    useEffect(() => {
        const handleOutsidePointerDown = (event: PointerEvent) => {
            const target = event.target as Node | null;
            if (!target) return;

            if (containerRef.current?.contains(target)) {
                return;
            }

            // Allow interactions with Radix portals opened by controls inside SearchSelect.
            if (
                target instanceof Element &&
                target.closest('[data-radix-popper-content-wrapper]')
            ) {
                return;
            }

            setOpenFilters(false);
            setOpen(false);
            setHighlightedIndex(-1);
        };

        document.addEventListener(
            'pointerdown',
            handleOutsidePointerDown,
            true,
        );
        return () => {
            document.removeEventListener(
                'pointerdown',
                handleOutsidePointerDown,
                true,
            );
        };
    }, []);

    return (
        <div ref={containerRef} className={cn('relative w-full', className)}>
            <div
                className={cn(
                    'flex min-h-10 flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-1',
                    'transition focus-within:border-ring focus-within:ring-2 focus-within:ring-ring',
                )}
                onClick={() => inputRef.current?.focus()}
            >
                {fixedFilters?.map((filter) => {
                    const countryCode = filter.country?.toUpperCase();
                    const Flag = countryCode
                        ? (
                            Flags as Record<
                                string,
                                ComponentType<{
                                    title?: string;
                                    className?: string;
                                }>
                            >
                        )[countryCode]
                        : undefined;

                    return (
                        <span
                            key={filter.name}
                            title={filter.title ?? filter.label}
                            aria-label={filter.title ?? filter.label}
                            className={cn(
                                'flex items-center gap-1 rounded-xl border border-brand-main/30 bg-brand-main/10 px-2 text-sm text-foreground',
                                Flag ? 'py-1.5' : 'py-0.5',
                                compactMobile && 'hidden sm:flex',
                            )}
                        >
                            {Flag ? (
                                <>
                                    <Flag
                                        title={filter.label}
                                        className="w-4"
                                    />
                                    <span className="sr-only">
                                        {filter.label}
                                    </span>
                                </>
                            ) : (
                                <>
                                    {filter.name === 'pot' ? (
                                        <Diameter size={14} aria-hidden="true" />
                                    ) : null}
                                    {filter.name === 'height' ? (
                                        <MoveVertical size={14} aria-hidden="true" />
                                    ) : null}
                                    {filter.label}
                                </>
                            )}
                        </span>
                    );
                })}

                {hasFilters && (
                    <button
                        type="button"
                        onMouseDown={() => {
                            setOpenFilters((v) => !v);
                        }}
                        // onClick={(e) => { e.stopPropagation(); }}
                        className="px-1 text-muted-foreground hover:text-foreground"
                        title="Filters"
                    >
                        <SlidersHorizontalIcon size={16} />
                    </button>
                )}

                {filtersActive?.map((filter) => {
                    const isCountry = filter.name === 'country';
                    const countryCodes = isCountry
                        ? (filter.values ?? (filter.value ? [filter.value] : []))
                            .map((value) => value.toUpperCase())
                        : [];
                    const isImage = filter.name === 'image';
                    const isPromo = filter.name === 'promo';
                    const isPot = filter.name === 'pot';
                    const isHeight = filter.name === 'height';
                    const compactValues = filter.values ?? (filter.value ? [filter.value] : []);
                    const compactSummary = compactValues.length <= 2
                        ? compactValues.join(', ')
                        : `${compactValues.slice(0, 2).join(', ')} +${compactValues.length - 2}`;

                    return (
                        <span
                            key={filter.name}
                            title={filter.label}
                            aria-label={filter.label}
                            className={cn(
                                'flex items-center gap-1 rounded-xl px-2 py-0.5 text-sm',
                                isImage
                                    ? 'border border-border bg-muted/70 text-foreground'
                                    : 'bg-brand-main text-white dark:text-black',
                            )}
                        >
                            {isCountry ? (
                                <>
                                    {countryCodes.slice(0, 2).map((countryCode) => {
                                        const Flag = (
                                            Flags as Record<
                                                string,
                                                ComponentType<{
                                                    title?: string;
                                                    className?: string;
                                                }>
                                            >
                                        )[countryCode];
                                        return Flag ? (
                                            <Flag
                                                key={countryCode}
                                                title={filter.label}
                                                className="w-4"
                                            />
                                        ) : null;
                                    })}
                                    {countryCodes.length > 2 ? (
                                        <span>+{countryCodes.length - 2}</span>
                                    ) : null}
                                    <span className="sr-only">
                                        {filter.label}
                                    </span>
                                </>
                            ) : isImage ? (
                                filter.value === 'without' ? (
                                    <CameraOff size={17} aria-hidden="true" />
                                ) : (
                                    <Camera size={17} aria-hidden="true" />
                                )
                            ) : isPromo ? (
                                <Zap size={17} aria-hidden="true" />
                            ) : isPot ? (
                                <>
                                    <Diameter size={14} aria-hidden="true" />
                                    {compactSummary}
                                </>
                            ) : isHeight ? (
                                <>
                                    <MoveVertical size={14} aria-hidden="true" />
                                    {compactSummary}
                                </>
                            ) : (
                                filter.label
                            )}
                            <X
                                size={14}
                                className="cursor-pointer hover:text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeFilter?.(filter.name);
                                }}
                            />
                        </span>
                    );
                })}

                {selected.map((opt) => (
                    <span
                        key={opt.value}
                        title={opt.description ?? undefined}
                        className="flex items-center gap-1 rounded-xl bg-muted px-2 py-0.5 text-sm"
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
                        setHighlightedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder ?? t('Search...')}
                    className="min-w-[100px] flex-1 border-0 bg-transparent text-sm focus:ring-0 focus:outline-none"
                />

                {/* Bouton clear */}
                {((filtersActive?.length ?? 0) > 0 ||
                    selected.length > 0 ||
                    value) && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="px-1 text-muted-foreground hover:text-destructive"
                        >
                            <X size={16} />
                        </button>
                    )}

                {/* Bouton recherche */}
                {search && (
                    <button
                        type="button"
                        onClick={handleSearch}
                        className={cn(
                            'px-1 text-muted-foreground hover:text-foreground',
                            compactMobile && 'hidden sm:inline-flex',
                        )}
                    >
                        <SearchIcon size={16} />
                    </button>
                )}

                {/* Petit compteur d'occurrences */}
                {typeof count === 'number' && (
                    <span
                        className={cn(
                            'ml-2 text-xs text-muted-foreground',
                            compactMobile && 'hidden sm:inline',
                        )}
                    >
                        {count > 1
                            ? `${count} ${t('results')}`
                            : count === 0
                                ? t('No results.')
                                : ''}
                    </span>
                )}
            </div>

            {/* Panneau combiné filtres + propositions */}
            {(openFilters || (open && value.length >= minQueryLength)) && (
                <div className="absolute top-full left-0 z-50 mt-1 max-h-[min(30rem,calc(100vh-8rem))] w-full overflow-y-auto rounded-md border bg-popover px-2 py-4 shadow-lg">
                    <div
                        className={cn(
                            'flex flex-col gap-4 md:flex-row',
                            open && value.length >= minQueryLength
                                ? 'md:flex-row'
                                : 'flex-col',
                        )}
                    >
                        {/* Propositions */}
                        {open && value.length >= minQueryLength && (
                            <div
                                className={cn(
                                    'px-4',
                                    openFilters && renderedFilters
                                        ? 'md:w-1/2 md:border-r md:border-r-accent'
                                        : 'w-full',
                                )}
                            >
                                {/* <Heading title={t('Propositions')} /> */}
                                {loading ? (
                                    <div className="flex items-center justify-center py-2 text-muted-foreground">
                                        <Loader2
                                            className="mr-2 animate-spin"
                                            size={16}
                                        />{' '}
                                        {t('Search...')}
                                    </div>
                                ) : listOptions.length > 0 ? (
                                    listOptions.map((option, i: number) => (
                                        <button
                                            type="button"
                                            key={`${option.value}-${i}`}
                                            onClick={() =>
                                                handleSelectOption(option)
                                            }
                                            className={cn(
                                                'w-full rounded-sm px-3 py-2 text-left text-sm transition-colors',
                                                highlightedIndex === i
                                                    ? 'bg-accent text-accent-foreground'
                                                    : 'hover:bg-accent/60 hover:text-accent-foreground',
                                            )}
                                        >
                                            <span>
                                                {option.badge ? (
                                                    <span className="mr-2 inline-flex rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-muted-foreground">
                                                        {option.badge}
                                                    </span>
                                                ) : null}
                                                {option.country ? (
                                                    <CountryFlag
                                                        countryCode={
                                                            option.country
                                                        }
                                                        className="mr-2 inline w-4"
                                                    />
                                                ) : null}
                                                {option.label}
                                            </span>
                                            {option.description ? (
                                                <span className="block text-xs text-muted-foreground">
                                                    {option.description}
                                                </span>
                                            ) : null}
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
                            <div
                                className={cn(
                                    'px-4',
                                    open && value.length >= minQueryLength
                                        ? 'md:w-1/2'
                                        : 'w-full',
                                )}
                            >
                                {/* <Heading title={t('Filters')} /> */}
                                {renderedFilters}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
