import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandLoading,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command"
import { LoaderCircleIcon } from "lucide-react";

const SearchSoham = (
    { search, fetching, handleSearch, productsSearch, onSelect }
        : { search: string, fetching: boolean, handleSearch: (s: string) => void, productsSearch: any, onSelect: (name: string) => void }
) => {

    return (
        <Command shouldFilter={false} className="ml-auto w-full">
            <CommandInput
                value={search}
                onValueChange={handleSearch}
                placeholder="Rechercher Soso" />

            {search.length >= 3 && <CommandList>
                {fetching ? (<CommandLoading className="flex items-center justify-center overflow-hidden h-10 z-[1000]">
                    <LoaderCircleIcon className="animate-spin mr-2" />
                </CommandLoading>) : <>
                    <CommandEmpty>Aucun résultat</CommandEmpty>
                    <CommandGroup heading="Suggestions">
                        {productsSearch.length > 0 ? (
                            productsSearch.map((name: string, index: number) => (
                            <CommandItem
                                key={index}
                                onSelect={() => onSelect(name)}
                            >
                                {name}
                            </CommandItem>
                            ))
                        ) : (
                            <CommandItem disabled>
                            Aucun résultat
                            </CommandItem>
                        )}
                    </CommandGroup>
                </>}
            </CommandList>
            }

        </Command>
    )

}

export default SearchSoham;