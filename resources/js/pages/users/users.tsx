import { type BreadcrumbItem, type SharedData, type User } from '@/types';
import { Head, Link, router, usePage, InfiniteScroll } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

import SettingsLayout from '@/layouts/settings/layout';
import { useI18n } from '@/lib/i18n';
import AppLayout, { withAppLayout } from '@/layouts/app-layout';
import products from '@/routes/products';
import { SortableTableHead } from '@/components/sortable-table-head';
import { UploadIcon, EditIcon, TrashIcon, List, LayoutGrid } from 'lucide-react';
import BasicSticky from 'react-sticky-el';
import SearchSoham from '@/components/ui/searchSoham';
import { CsvUploadFilePond } from '@/components/csv-upload-filepond';
import { isDev, isAdmin, isClient, hasPermission } from '@/lib/roles';
import ProductsTable from '@/components/products-table';
import { ProductsCardsList } from '@/components/products-cards-list';
import users from '@/routes/users';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Users management',
        href: users.index().url,
    },
];

interface UsersPageProps {
    users: User[];
    roles: Array<{ id: number; name: string }>;
}



export default withAppLayout(breadcrumbs, ({ users, roles }: UsersPageProps) => {

    // console.log(users)
    const { t } = useI18n();

    const { auth, locale } = usePage<SharedData>().props;
    const user = auth?.user;
    const isAuthenticated = !!user;
    const canEditProducts = isAdmin(user) || hasPermission(user, 'edit products');
    const canDeleteProducts = isAdmin(user) || hasPermission(user, 'delete products');
    const canImportExportProducts = isAdmin(user) || hasPermission(user, 'import products') || hasPermission(user, 'export products');
    const canManageUsers = isAdmin(user) || hasPermission(user, 'manage users');
    const canPreview = isDev(user) || hasPermission(user, 'preview');


    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: t('Users management'),
            href: '/users',
        },
    ];

    // Vérifier que l'utilisateur est admin
    if (!isAdmin(auth.user)) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title={t('Users management')} />
                <SettingsLayout>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Access denied')}</CardTitle>
                            <CardDescription>
                                {t('You do not have permission to access this page')}
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </SettingsLayout>
            </AppLayout>
        );
    }

    const canEdit = isAdmin(user) || hasPermission(user, 'edit users');
    const canDelete = isAdmin(user) || hasPermission(user, 'delete users');
    const canImportExport = isAdmin(user) || hasPermission(user, 'import users') || hasPermission(user, 'export users');

    const page = usePage<{ searchPropositions?: string[] }>();
    const searchPropositions = page.props.searchPropositions ?? [];
    // const timerRef = useRef<ReturnType<typeof setTimeout>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [fetching, setFetching] = useState(false);
    const [search, setSearch] = useState('');

    const [topOffset, setTopOffset] = useState<number>(0);

    const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
        if (typeof window === 'undefined') return 'table';
        const stored = localStorage.getItem('products_view_mode');
        return stored === 'grid' ? 'grid' : 'table';
    });

    // sauvegarde à chaque changement (safe)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem('products_view_mode', viewMode);
        } catch (e) {
            // ignore (ex: stockage bloqué)
        }
    }, [viewMode]);

    useEffect(() => {
        const selector = '.top-sticky'; // classe à ajouter sur le sticky du dessus
        const getHeight = () => {
            const el = document.querySelector(selector) as HTMLElement | null;
            return el ? Math.ceil(el.getBoundingClientRect().height) : 0;
        };

        const update = () => setTopOffset(getHeight());
        update();
        window.addEventListener('resize', update);
        // si ton layout change dynamiquement (menu mobile), tu peux aussi observer le DOM :
        const obs = new MutationObserver(update);
        const parent = document.body;
        obs.observe(parent, { childList: true, subtree: true });
        return () => {
            window.removeEventListener('resize', update);
            obs.disconnect();
        };
    }, []);

    const handleSearch = (s: string) => {
        setSearch(s);
        // @ts-ignore
        clearTimeout(timerRef.current);
        router.cancelAll();
        if (s.length < 2) {
            return;
        }
        setFetching(true);
        timerRef.current = setTimeout(() => {
            router.reload({
                only: ['searchPropositions'],
                data: { q: s },
                onSuccess: () => setFetching(false),
                // preserveState: true,
            })
        }, 300)
    }

    // @ts-ignore
    const onSelect = (mysearch: string, options?: { force?: boolean }) => {
        const trimmed = (mysearch ?? '').trim();
        // If explicit clear requested, remove q from URL instead of setting q=""
        if (options?.force && trimmed.length === 0) {
            const url = new URL(window.location.href);
            url.searchParams.delete('q');
            router.visit(url.toString(), { replace: true });
            setSearch('');
            return;
        }

        // Otherwise ignore empty submissions
        if (trimmed.length === 0) {
            return;
        }

        setSearch('');
        router.reload({
            data: { q: trimmed },
        })

        // console.log("selected:", trimmed);
    };


    const handleRoleChange = (userId: number, roleName: string) => {
        // setUpdating(userId);
        // router.post(
        //     `/settings/users/${userId}/role`,
        //     { role: roleName },
        //     {
        //         preserveScroll: true,
        //         onFinish: () => setUpdating(null),
        //     }
        // );
    };

    return (
        <div>
            <BasicSticky
                topOffset={topOffset}
                stickyStyle={{ top: topOffset }}
                stickyClassName="bg-background"
                wrapperClassName="relative z-20"
            >
                <div className="flex items-center py-2 relative w-full">

                    <div className="flex gap-2 mr-2">
                        <button
                            type="button"
                            aria-pressed={viewMode === 'table'}
                            onClick={() => setViewMode('table')}
                            className={`
                                p-2 rounded-md transition border ${viewMode === 'table' ?
                                    'bg-accent' :
                                    'hover:bg-accent hover:text-inherit text-black/40 dark:text-white/40 dark:hover:text-inherit'}
                            `}
                            title="Afficher en tableau"
                        >
                            <List />
                        </button>

                        <button
                            type="button"
                            aria-pressed={viewMode === 'grid'}
                            onClick={() => setViewMode('grid')}
                            className={`
                                p-2 rounded-md transition border ${viewMode === 'grid' ?
                                    'bg-accent' :
                                    'hover:bg-accent hover:text-inherit text-black/40 dark:text-white/40 dark:hover:text-inherit'}
                            `}
                            title="Afficher en grille"
                        >
                            <LayoutGrid />
                        </button>
                    </div>

                    <div className="w-200 left-0 top-1 mr-2" >
                        <SearchSoham
                            value={search}
                            onChange={handleSearch}
                            onSubmit={onSelect}
                            propositions={searchPropositions}
                            loading={fetching}
                        // count={collection.meta.total}
                        // query={q ?? ''}
                        />
                    </div>



                    {canImportExport && (
                        <div className="ml-auto flex items-center gap-2">
<<<<<<< HEAD
                            {canPreview && <CsvUploadFilePond config={{
                                title: 'Upload CSV',
                                description: 'Uploadez un fichier CSV',
                                uploadUrl: '/upload',
                                successRedirectUrl: products.index().url,
                                buttonLabel: ''
                            }} />
                            }
=======
                            <CsvUploadFilePond
                                title="Upload CSV"
                                description="Uploadez un fichier CSV"
                                uploadUrl="/upload"
                                successRedirectUrl={products.index().url}
                                buttonLabel=""
                            />
>>>>>>> importProducts
                            <DownloadCsvButton />
                        </div>
                    )}
                </div>
            </BasicSticky>

            {/* <InfiniteScroll data="collection"> */}
            <div>
                {viewMode === 'table' ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('Name')}</TableHead>
                                <TableHead>{t('Email')}</TableHead>
                                <TableHead>{t('Current roles')}</TableHead>
                                {canPreview && <TableHead>{t('Change role')}</TableHead>}
                                <TableHead>{t('Joined')}</TableHead>
                                {(canEdit || canDelete) && <TableHead className="text-end">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell className="font-medium">
                                        {user.name}
                                    </TableCell>
                                    <TableCell>{user.email}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {user.roles && user.roles.length > 0 ? (
                                                user.roles.map((role) => (
                                                    <Badge
                                                        key={role.id}
                                                        variant={
                                                            role.name === 'dev'
                                                                ? 'destructive'
                                                                : role.name === 'admin'
                                                                    ? 'default'
                                                                    : role.name === 'client'
                                                                        ? 'secondary'
                                                                        : 'outline'
                                                        }
                                                    >
                                                        {role.name}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <Badge variant="outline">
                                                    {t('No role')}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    {canPreview && <TableCell>
                                        <Select
                                            onValueChange={(value) =>
                                                handleRoleChange(user.id, value)
                                            }
                                            disabled={
                                                // updating === user.id ||
                                                user.id === auth.user?.id
                                            }
                                        >
                                            <SelectTrigger className="w-[140px]">
                                                <SelectValue
                                                    placeholder={t('Select role')}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {roles.map((role) => (
                                                    <SelectItem
                                                        key={role.id}
                                                        value={role.name}
                                                    >
                                                        {role.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {user.id === auth.user?.id && (
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {t('Cannot modify your own role')}
                                            </p>
                                        )}
                                    </TableCell>
                                    }
                                    <TableCell className="text-sm text-muted-foreground">
                                        {new Date(
                                            user.created_at
                                        ).toLocaleDateString()}
                                    </TableCell>
                                    {(canEdit || canDelete) && (
                                        <TableCell>
                                            <div className="flex gap-2 justify-end">
                                                {canEdit && (
                                                    <Button asChild size="icon" variant="outline">
                                                        <Link href={`/admin/users/${user.id}/edit`}>
                                                            <EditIcon size={16} />
                                                        </Link>
                                                    </Button>
                                                )}
                                                {canDelete && (
                                                    <Button asChild size="icon" variant="destructive-outline">
                                                        <Link href={`/admin/users/${user.id}/destroy`} onBefore={() => confirm('Are you sure?')}>
                                                            <TrashIcon size={16} />
                                                        </Link>
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <Card className="relative h-4xl w-80 flex flex-col p-4 gap-4">
                        <h2 className='bg-info'>vue card à faire</h2>
                    </Card>
                    // <UsersCardsList products={collection.data} canEdit={canEdit} canDelete={canDelete} />
                )}
                {/* </InfiniteScroll> */}
            </div>
        </div>

    );

})


function DownloadCsvButton() {
    return (
        <a href="/admin/users/export" className="clickable inline-flex items-center border px-3 py-1 rounded text-sm">
            <UploadIcon />
        </a>
    );
}