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
import { SortableTableHead } from '@/components/ui/sortable-table-head';
import { UploadIcon, EditIcon, TrashIcon } from 'lucide-react';
import SearchSelect from '@/components/app/search-select';
import { CsvUploadFilePond } from '@/components/csv-upload-filepond';
import { isDev, isAdmin, isClient, hasPermission } from '@/lib/roles';
import ProductsTable from '@/components/products/products-table';
import { ProductsCardsList } from '@/components/products/products-cards-list';
import users from '@/routes/users';
import UsersTable from '@/components/users/users-table';
import UsersCardsList from '@/components/users/users-cards-list';
import { StickyBar } from '@/components/ui/sticky-bar';
import { ViewModeToggle } from '@/components/ui/view-mode-toggle';
import { ButtonsActions } from '@/components/buttons-actions';

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



export default withAppLayout(breadcrumbs, true, ({ users, roles }: UsersPageProps) => {

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

    const [viewMode, setViewMode] = useState<'table' | 'grid'>(() => {
        if (typeof window === 'undefined') return 'table';
        const views = JSON.parse(localStorage.getItem('views') || '{}');
        return views.users === 'grid' ? 'grid' : 'table';
    });

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
        <div className='w-full'>
            <Head title="Users" />
            <StickyBar
                zIndex={20}
                borderBottom={false}
                className='mb-4'
            >
                <ViewModeToggle
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    pageKey="users"
                />
                {/* <div className="w-full left-0 top-1 mr-2"> */}
                    <SearchSelect
                        value={search}
                        onChange={handleSearch}
                        onSubmit={onSelect}
                        propositions={searchPropositions}
                        loading={fetching}
                    />
                {/* </div> */}

                {canImportExport && (
                    // <div className="ml-auto flex items-center gap-2">
                    //     <CsvUploadFilePond
                    //         title="Upload CSV"
                    //         description="Uploadez un fichier CSV"
                    //         uploadUrl="/upload"
                    //         successRedirectUrl={products.index().url}
                    //         buttonLabel=""
                    //     />
                    //     <DownloadCsvButton />
                    // </div>
                    <ButtonsActions
                        import={
                            <CsvUploadFilePond
                                title="Upload CSV"
                                description="Uploadez un fichier CSV"
                                uploadUrl="/admin/users/import"
                                successRedirectUrl={products.index().url}
                                buttonLabel=""
                            />
                        }
                        export={"/admin/users/export"}
                    />

                )}
            </StickyBar>

            {/* <InfiniteScroll data="collection"> */}
            <div>
                {viewMode === 'table' ? (
                    <UsersTable
                        users={users}
                        roles={roles}
                        auth={auth}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        canPreview={canPreview}
                    />
                ) : (
                    <div>
                        <UsersCardsList
                            users={users}
                            roles={roles}
                            auth={auth}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            canChangeRole={canPreview}
                        />
                    </div>
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