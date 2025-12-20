import { useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import SearchSelect from '@/components/app/search-select';
import { type SharedData, type User } from '@/types';
import { useI18n } from '@/lib/i18n';
import { isAdmin } from '@/lib/roles';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@/components/ui/button';

interface ImpersonateSelectProps {
    users: User[];
    onClose?: () => void;
}

const PAGE_SIZE = 12;

export function ImpersonateSelect({ users, onClose }: ImpersonateSelectProps) {
    const { t } = useI18n();
    const pageProps = usePage<SharedData>().props;
    const { auth } = pageProps;
    const [search, setSearch] = useState<string>('');
    const [currentPage, setCurrentPage] = useState<number>(1);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isCurrentUserAdmin = isAdmin(auth.user);
    if (!isCurrentUserAdmin) return null;

    // Use passed `users` prop if present, otherwise fall back to Inertia shared `users` prop
    const sharedUsers: User[] = (users && users.length > 0) ? users : ((pageProps as any).users || []);
    const availableUsers: User[] = sharedUsers.filter((u: User) => u.id !== auth.user?.id);

    const handleLoadMore = () => setCurrentPage((p: number) => p + 1);

    const handleSearch = (s: string) => {
        setSearch(s);
        setCurrentPage(1);
        if (timerRef.current) clearTimeout(timerRef.current);
    };

    const handleSelect = (targetUser: User) => {
        setSearch('');
        setCurrentPage(1);
        if (onClose) onClose();
        router.visit(`/impersonate/take/${targetUser.id}`, { preserveState: false });
    };

    let filteredUsers: User[] = availableUsers;
    if (search.length >= 2) {
        const q = search.toLowerCase();
        filteredUsers = availableUsers.filter(
            (u: User) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
        );
    }

    const displayedUsers = filteredUsers.slice(0, currentPage * PAGE_SIZE);
    const hasMore = filteredUsers.length > displayedUsers.length;

    const UserListFilters = () => (
        <div className="w-full">
            <div className="max-h-96 overflow-y-auto">
                {displayedUsers.length > 0 ? (
                    displayedUsers.map((user: User) => (
                        <button
                            key={user.id}
                            onClick={() => handleSelect(user)}
                            className="w-full text-left px-4 py-2 hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-b-0"
                        >
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                        </button>
                    ))
                ) : (
                    <div className="px-4 py-2 text-sm text-muted-foreground text-center">{t('No results.')}</div>
                )}
            </div>

            {hasMore && (
                <div className="px-4 py-2 border-t">
                    <Button variant="ghost" size="sm" onClick={handleLoadMore} className="w-full">
                        Load more...
                    </Button>
                </div>
            )}
        </div>
    );

    return (
        <DropdownMenu.Sub>
            <div className="px-2 py-2 w-full" onKeyDown={(e) => e.stopPropagation()}>
                <SearchSelect
                    value={search}
                    onChange={handleSearch}
                    onSubmit={(val: string) => {
                        if (!val) return;
                        const tokens = val.split(/\s+/).map((s) => s.trim()).filter(Boolean);
                        if (tokens.length === 0) return;
                        const first = tokens[0];
                        const match = filteredUsers.find((u: User) => u.name === first || `${u.name} <${u.email}>` === first);
                        if (match) {
                            handleSelect(match);
                        }
                    }}
                    propositions={search.trim().length >= 3 ? filteredUsers.map((u: User) => `${u.name}`) : []}
                    filters={<UserListFilters />}
                    placeholder={t('Search user to impersonate') || 'Search user...'}
                />
            </div>
        </DropdownMenu.Sub>
    );
}
