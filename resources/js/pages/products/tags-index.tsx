import { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { useRef, useState } from 'react';
import { PaginatedCollection } from '@/types';
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table';
import { Link, InfiniteScroll, usePage, router, Head, useForm } from '@inertiajs/react';
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { Button } from '@/components/ui/button';
import { EditIcon, TrashIcon } from 'lucide-react';
import { StickyBar } from '@/components/ui/sticky-bar';
import SearchSelect from '@/components/app/search-select';
import tagsProducts from '@/routes/tags-products';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { ButtonsActions } from '@/components/buttons-actions';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

type Tag = {
    id: number;
    name: string;
    slug: string;
    created_at: string;
    updated_at: string;
};

type Props = {
    collection: PaginatedCollection<Tag>;
    q?: string | null;
};

export default withAppLayout(
    () => {
        const { t } = useI18n();
        return [
            {
                title: t('Products'),
                href: products.index().url,
            },
            {
                title: t('Tags'),
                href: tagsProducts.index().url,
            },
        ];
    },
    true,
    ({ collection, q }: Props) => {
        const { t } = useI18n();
        const page = usePage<{ searchPropositions?: string[] }>();
        const searchPropositions = page.props.searchPropositions ?? [];
        const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
        const [fetching, setFetching] = useState(false);
        const [search, setSearch] = useState('');
        const [createOpen, setCreateOpen] = useState(false);
        const tagForm = useForm<{ name: string; slug?: string }>({ name: '' });
        const [searchPropositionsState, setSearchPropositions] = useState<string[]>(searchPropositions ?? []);

        const handleSearch = (s: string) => {
            setSearch(s);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            router.cancelAll();
            if (s.length < 2) {
                return;
            }
            setFetching(true);
            timerRef.current = setTimeout(async () => {
                try {
                    const res = await fetch(`/search-propositions?context=tags&q=${encodeURIComponent(s)}&limit=10`);
                    const json = await res.json();
                    setSearchPropositions((json.propositions || []) as string[]);
                } finally {
                    setFetching(false);
                }
            }, 300);
        };

        const onSelect = (mysearch: string, options?: { force?: boolean }) => {
            const trimmed = (mysearch ?? '').trim();
            if (options?.force && trimmed.length === 0) {
                const url = new URL(window.location.href);
                url.searchParams.delete('q');
                router.visit(url.toString(), { replace: true });
                setSearch('');
                return;
            }

            if (trimmed.length === 0) {
                return;
            }

            setSearch('');
            // Validation: navigation complète pour réactualiser la page
            router.get(window.location.pathname, { q: trimmed }, {
                preserveState: false,
                replace: true,
                preserveScroll: false,
            });
        };

        return (
            <>
                <Head title={t('Tags')} />
                <StickyBar className='mb-4'>
                    <div className="w-200 flex-1">
                        <SearchSelect
                            value={search}
                            onChange={handleSearch}
                            onSubmit={onSelect}
                            propositions={searchPropositionsState}
                            loading={fetching}
                            count={collection.meta.total}
                            query={q ?? ''}
                        />
                    </div>

                    {/* <div className="ml-auto flex items-center gap-2">
                        <Button asChild size="sm">
                            <Link href={tagsProducts.create().url}>
                                <PlusIcon size={16} className="mr-2" />
                                {t('Add Tag')}
                            </Link>
                        </Button>
                    </div> */}
                    <ButtonsActions
                        add={() => {
                            tagForm.reset();
                            tagForm.clearErrors();
                            setCreateOpen(true);
                        }}
                    />
                </StickyBar>

                <Dialog open={createOpen} onOpenChange={(open) => { if (!tagForm.processing) setCreateOpen(open); }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t('Add Tag')}</DialogTitle>
                            <DialogDescription>{t('Le slug est généré automatiquement à partir du nom.')}</DialogDescription>
                        </DialogHeader>
                        <form className="space-y-4" onSubmit={(event) => {
                            event.preventDefault();
                            tagForm.post(tagsProducts.store.url(), {
                                onSuccess: () => {
                                    setCreateOpen(false);
                                    tagForm.reset();
                                },
                            });
                        }}>
                            <FormField label={t('Name')} htmlFor="tag-name" error={tagForm.errors.name}>
                                <Input id="tag-name" value={tagForm.data.name} onChange={(event) => tagForm.setData('name', event.target.value)} maxLength={255} required autoFocus disabled={tagForm.processing} aria-invalid={!!tagForm.errors.name} />
                            </FormField>
                            {tagForm.errors.slug && <p role="alert" className="text-sm text-destructive">{tagForm.errors.slug}</p>}
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={tagForm.processing}>{t('Cancel')}</Button>
                                <Button type="submit" disabled={tagForm.processing}>{t('Create')}</Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                <InfiniteScroll data="collection">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <SortableTableHead field="id">ID</SortableTableHead>
                                <SortableTableHead field="name">{t('Name')}</SortableTableHead>
                                <SortableTableHead field="slug">{t('Slug')}</SortableTableHead>
                                <TableHead className='text-end'>{t('Actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Array.from(new Map(collection.data.map((item) => [item.id, item])).values()).map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.id}</TableCell>
                                    <TableCell>
                                        <Link href={tagsProducts.edit(item.id)} className="hover:underline font-medium">
                                            {item.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="font-mono text-xs">
                                            {item.slug}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex gap-2 justify-end">
                                            <Button asChild size="icon" variant="outline">
                                                <Link href={tagsProducts.edit(item.id)}>
                                                    <EditIcon size={16} />
                                                </Link>
                                            </Button>
                                            <Button asChild size="icon" variant="destructive-outline">
                                                <Link
                                                    href={tagsProducts.destroy(item.id)}
                                                    method="delete"
                                                    onBefore={() => confirm(t('Are you sure you want to delete this tag?'))}
                                                >
                                                    <TrashIcon size={16} />
                                                </Link>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </InfiniteScroll>
            </>
        )
    })
