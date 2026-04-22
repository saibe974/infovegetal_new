import { useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import SearchSelect from '@/components/app/search-select';
import { type SharedData, type User } from '@/types';
import { useI18n } from '@/lib/i18n';
import { getEffectiveUser, isAdmin } from '@/lib/roles';
import { take as impersonateTake } from '@/actions/App/Http/Controllers/ImpersonationController';
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

    const effectiveUser = getEffectiveUser(auth);
    const isCurrentUserAdmin = isAdmin(effectiveUser);
    if (!isCurrentUserAdmin) return null;
    const isImpersonating = !!auth.impersonate_from;

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
        if (!targetUser?.id) {
            return;
        }
        setSearch('');
        setCurrentPage(1);
        if (onClose) onClose();
        const url = impersonateTake({ id: targetUser.id }).url;
        window.location.href = url;
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

    if (isImpersonating) {
        return null;
    }

    return (
        <DropdownMenu.Sub>
            <div className="px-2 py-2 w-full" onKeyDown={(e) => e.stopPropagation()}>
                <SearchSelect
                    value={search}
                    onChange={handleSearch}
                    onSubmit={(val: string) => {
                        const query = val.trim();
                        if (!query) return;
                        const normalized = query.toLowerCase();
                        const match = filteredUsers.find((u: User) => {
                            const name = u.name.toLowerCase();
                            return name === normalized;
                        });
                        if (match) {
                            handleSelect(match);
                        }
                    }}
                    propositions={filteredUsers.map((u: User) => `${u.name}`)}
                    // filters={<UserListFilters />}
                    placeholder={t('Search user to impersonate') || 'Search user...'}
                    minQueryLength={0}
                    search={false}
                />
            </div>
        </DropdownMenu.Sub>
    );
}
