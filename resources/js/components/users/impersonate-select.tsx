import { useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import SearchSelect from '@/components/app/search-select';
import { type SharedData, type User } from '@/types';
import { useI18n } from '@/lib/i18n';
import { hasAnyPermission, isAdmin } from '@/lib/roles';
import { take as impersonateTake } from '@/actions/App/Http/Controllers/ImpersonationController';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface ImpersonateSelectProps {
    users: User[];
    onClose?: () => void;
}

export function ImpersonateSelect({ users, onClose }: ImpersonateSelectProps) {
    const { t } = useI18n();
    const pageProps = usePage<SharedData>().props;
    const { auth } = pageProps;
    const [search, setSearch] = useState<string>('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Droits de l'utilisateur réel (impersonateur), quel que soit le mode strict :
    // le serveur vérifie de toute façon chaque substitution sur ce même compte.
    const realActor = auth.impersonator ?? auth.user;
    const canImpersonate = isAdmin(realActor) || hasAnyPermission(realActor, [
        'users.impersonate.branch',
        'users.impersonate.all',
    ]);
    if (!canImpersonate) return null;

    // Use passed `users` prop if present, otherwise fall back to Inertia shared `users` prop
    const sharedUsers: User[] = users && users.length > 0 ? users : pageProps.users ?? [];
    const availableUsers: User[] = sharedUsers.filter(
        (u: User) => u.id !== auth.user?.id && u.id !== auth.impersonator?.id,
    );

    const handleSearch = (s: string) => {
        setSearch(s);
        if (timerRef.current) clearTimeout(timerRef.current);
    };

    const handleSelect = (targetUser: User) => {
        if (!targetUser?.id) {
            return;
        }
        setSearch('');
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

    return (
        <DropdownMenu.Sub>
            <div className="px-1 py-2 w-full" onKeyDown={(e) => e.stopPropagation()}>
                <SearchSelect
                    value={search}
                    onChange={handleSearch}
                    onSubmit={() => {}}
                    onSelectOption={(option) => {
                        const normalized = option.label.trim().toLowerCase();
                        const match =
                            (option.id !== undefined
                                ? filteredUsers.find((u: User) => u.id === option.id)
                                : undefined) ??
                            filteredUsers.find(
                                (u: User) =>
                                    u.name.toLowerCase() === normalized ||
                                    u.email.toLowerCase() === normalized,
                            );
                        if (match) {
                            handleSelect(match);
                        }
                        return true;
                    }}
                    propositions={filteredUsers.map((u: User) => ({
                        value: String(u.id),
                        label: u.name,
                        description: u.email,
                        image: u.logo_url,
                        id: u.id,
                    }))}
                    // filters={<UserListFilters />}
                    placeholder={t('Search user to impersonate')}
                    minQueryLength={0}
                    search={false}
                    compact
                />
            </div>
        </DropdownMenu.Sub>
    );
}
