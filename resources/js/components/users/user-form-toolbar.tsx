import SearchSelect from '@/components/app/search-select';
import { ButtonsActions } from '@/components/buttons-actions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { StickyBar } from '@/components/ui/sticky-bar';
import users from '@/routes/users';
import { Link, router } from '@inertiajs/react';
import { Eye, TriangleAlert, Users2Icon } from 'lucide-react';
import { useRef, useState } from 'react';

export type UserParent = { id: number; name: string };
type TreeUser = UserParent & { email: string; depth: number };

type Props = {
    parent: UserParent | null;
    onParentChange: (parent: UserParent | null) => void;
    canManageParent?: boolean;
    user?: { id: number; name: string } | null;
    canView?: boolean;
    canDelete?: boolean;
    onSave: () => void;
    saving?: boolean;
    topOffsetElement?: string;
};

export function UserFormToolbar({
    parent,
    onParentChange,
    canManageParent = true,
    user,
    canView = false,
    canDelete = false,
    onSave,
    saving,
    topOffsetElement = '.top-sticky',
}: Props) {
    const [parentModalOpen, setParentModalOpen] = useState(false);
    const [parentSearch, setParentSearch] = useState('');
    const [items, setItems] = useState<TreeUser[]>([]);
    const [loading, setLoading] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const searchParents = (query: string) => {
        setParentSearch(query);
        if (timer.current) clearTimeout(timer.current);
        if (query.trim().length < 2) {
            setItems([]);
            return;
        }
        timer.current = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await fetch(
                    `/admin/users/tree-search?q=${encodeURIComponent(query.trim())}`,
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );
                if (!response.ok) return;
                const payload = await response.json();
                setItems(
                    (
                        (payload.items || []) as Array<Record<string, unknown>>
                    ).map((item) => ({
                        id: Number(item.id),
                        name: String(item.name ?? ''),
                        email: String(item.email ?? ''),
                        depth: Number(item.depth ?? 0),
                    })),
                );
            } finally {
                setLoading(false);
            }
        }, 300);
    };

    const selectParent = (value: UserParent | null) => {
        onParentChange(value);
        setParentModalOpen(false);
        setParentSearch('');
        setItems([]);
    };

    return (
        <>
            <StickyBar topOffsetElement={topOffsetElement}>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {canManageParent && (
                        <>
                            <span className="hidden text-sm text-muted-foreground sm:inline">
                                Parent :
                            </span>
                            {parent ? (
                                <Badge
                                    variant="outline"
                                    className="max-w-48 truncate px-3 py-1 text-sm"
                                    title={parent.name}
                                >
                                    {parent.name}
                                </Badge>
                            ) : (
                                <span className="hidden text-sm text-muted-foreground md:inline">
                                    Aucun parent
                                </span>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setParentModalOpen(true)}
                            >
                                <Users2Icon className="size-4" />
                                {parent ? 'Changer' : 'Sélectionner'}
                            </Button>
                            {parent && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onParentChange(null)}
                                >
                                    Retirer
                                </Button>
                            )}
                        </>
                    )}
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-2">
                    {user && canView && (
                        <Button
                            variant="outline"
                            size="icon"
                            asChild
                            title="Voir"
                        >
                            <Link href={users.show({ user: user.id }).url}>
                                <Eye />
                            </Link>
                        </Button>
                    )}
                    {user && canDelete && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="destructive-outline"
                                    size="icon"
                                    title="Supprimer"
                                >
                                    <TriangleAlert />
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        Supprimer {user.name} ?
                                    </DialogTitle>
                                    <DialogDescription>
                                        Cette action supprimera le compte
                                        utilisateur. Cette opération est
                                        irréversible.
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                        >
                                            Annuler
                                        </Button>
                                    </DialogClose>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={() =>
                                            router.delete(
                                                users.destroy({ user: user.id })
                                                    .url,
                                            )
                                        }
                                    >
                                        <TriangleAlert />
                                        Supprimer
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                    <ButtonsActions save={onSave} saving={saving} />
                </div>
            </StickyBar>

            {canManageParent && (
                <Dialog
                    open={parentModalOpen}
                    onOpenChange={setParentModalOpen}
                >
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Sélectionner un parent</DialogTitle>
                        </DialogHeader>
                        <SearchSelect
                            value={parentSearch}
                            onChange={searchParents}
                            onSubmit={searchParents}
                            propositions={items.map((item) => ({
                                value: String(item.id),
                                label: item.name,
                            }))}
                            loading={loading}
                            minQueryLength={2}
                            search
                        />
                        {items.length > 0 && (
                            <ul className="mt-2 max-h-64 divide-y overflow-y-auto rounded-md border text-sm">
                                {items.map((item) => (
                                    <li
                                        key={item.id}
                                        className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-muted"
                                        style={{
                                            paddingLeft: `${item.depth * 16 + 12}px`,
                                        }}
                                        onClick={() =>
                                            selectParent({
                                                id: item.id,
                                                name: item.name,
                                            })
                                        }
                                    >
                                        <span>{item.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                            {item.email}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {parentSearch.trim().length >= 2 &&
                            !loading &&
                            items.length === 0 && (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Aucun résultat.
                                </p>
                            )}
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
