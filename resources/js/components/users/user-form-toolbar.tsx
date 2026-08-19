import SearchSelect from '@/components/app/search-select';
import { ButtonsActions } from '@/components/buttons-actions';
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
import { Eye, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export type UserParent = { id: number; name: string };
type ParentOption = UserParent & { description: string };

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
    const [parentSearch, setParentSearch] = useState('');
    const [items, setItems] = useState<ParentOption[]>([]);
    const [loading, setLoading] = useState(false);
    const targetUserId = user?.id;

    useEffect(() => {
        if (!canManageParent) return;
        const controller = new AbortController();
        const load = async () => {
            setLoading(true);
            try {
                const target = targetUserId
                    ? `?target_user_id=${targetUserId}`
                    : '';
                const response = await fetch(
                    `/admin/users/parent-options${target}`,
                    {
                        signal: controller.signal,
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
                        description: String(item.description ?? ''),
                    })),
                );
            } catch (error) {
                if (
                    !(
                        error instanceof DOMException &&
                        error.name === 'AbortError'
                    )
                ) {
                    setItems([]);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [canManageParent, targetUserId]);

    const filteredItems = useMemo(() => {
        const query = parentSearch.trim().toLocaleLowerCase();
        if (!query) return items;
        return items.filter((item) =>
            `${item.name} ${item.description}`
                .toLocaleLowerCase()
                .includes(query),
        );
    }, [items, parentSearch]);

    const submitParent = (id: string) => {
        if (!id) {
            onParentChange(null);
            return;
        }
        const selected = items.find((item) => String(item.id) === id);
        if (!selected) return;
        onParentChange({ id: selected.id, name: selected.name });
        setParentSearch('');
    };

    return (
        <>
            <StickyBar topOffsetElement={topOffsetElement}>
                <div className="flex min-w-0 basis-full flex-wrap items-center gap-2 sm:flex-1 sm:basis-auto">
                    {canManageParent && (
                        <>
                            <span className="shrink-0 text-sm text-muted-foreground">
                                Parent :
                            </span>
                            <SearchSelect
                                className="min-w-0 flex-1 sm:max-w-96"
                                value={parentSearch}
                                onChange={setParentSearch}
                                onSubmit={submitParent}
                                propositions={filteredItems.map((item) => ({
                                    value: String(item.id),
                                    label: item.name,
                                    description: item.description,
                                }))}
                                selection={
                                    parent
                                        ? [
                                              {
                                                  value: String(parent.id),
                                                  label: parent.name,
                                              },
                                          ]
                                        : []
                                }
                                multiple={false}
                                loading={loading}
                                minQueryLength={0}
                                search={false}
                                placeholder="Sélectionner un parent"
                            />
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
        </>
    );
}
