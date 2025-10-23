import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { router, usePage } from '@inertiajs/react';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof TableHead> & {
    field: string;
};

export function SortableTableHead({
    field,
    children,
    className,
    ...props
}: Props) {
    const page = usePage<{ q?: string; query: { sort?: string; dir?: string } }>();
    const query = page.props.query;
    const currentQ = page.props.q;
    const isActive = field === query.sort;
    const direction = query.dir ?? 'desc';

    const handleSort = () => {
        const url = new URL(window.location.href);

        if (!isActive) {
            // 1er clic: activer tri desc
            url.searchParams.set('sort', field);
            url.searchParams.set('dir', 'desc');
        } else if (direction === 'desc') {
            // 2e clic: passer en asc
            url.searchParams.set('dir', 'asc');
        } else {
            // 3e clic: désactiver le tri (enlever les params)
            url.searchParams.delete('sort');
            url.searchParams.delete('dir');
        }

        // Conserver la recherche actuelle si absente de l'URL
        if (currentQ && !url.searchParams.get('q')) {
            url.searchParams.set('q', currentQ);
        }

        router.visit(url.toString());
    };

    const getSortIcon = () => {
        if (!isActive) {
            return <ArrowUpDownIcon size={16} className="opacity-50" />;
        }
        if (direction === 'asc') {
            return <ArrowUpIcon size={16} />;
        }
        return <ArrowDownIcon size={16} />;
    };

    return (
        <TableHead
            {...props}
            className={cn(
                className,
                'cursor-pointer hover:text-foreground',
                isActive && 'text-foreground',
            )}
            onClick={handleSort}
        >
            <div className="flex items-center gap-2">
                {children}
                {getSortIcon()}
            </div>
        </TableHead>
    );
}
