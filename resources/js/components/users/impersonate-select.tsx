import { useEffect, useRef, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import SearchSelect from '@/components/app/search-select';
import { type SharedData, type User } from '@/types';
import { useI18n } from '@/lib/i18n';
import { isAdmin } from '@/lib/roles';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface ImpersonateSelectProps {
    users: User[];
    onClose?: () => void;
}

export function ImpersonateSelect({ users, onClose }: ImpersonateSelectProps) {
    const { t } = useI18n();
    const { auth } = usePage<SharedData>().props;
    const [search, setSearch] = useState('');
    const [propositions, setPropositions] = useState<string[]>([]);
    const [fetching, setFetching] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isCurrentUserAdmin = isAdmin(auth.user);

    if (!isCurrentUserAdmin) {
        return null;
    }

    const handleSearch = (s: string) => {
        setSearch(s);
        if (timerRef.current) clearTimeout(timerRef.current);

        if (s.length < 2) {
            setPropositions([]);
            return;
        }

        setFetching(true);
        timerRef.current = setTimeout(() => {
            // Filtrer localement les utilisateurs
            const filtered = users
                .filter(u => u.id !== auth.user?.id) // Exclure l'utilisateur courant
                .filter(u =>
                    u.name.toLowerCase().includes(s.toLowerCase()) ||
                    u.email.toLowerCase().includes(s.toLowerCase())
                )
                .slice(0, 10)
                .map(u => `${u.name} (${u.email})`);

            setPropositions(filtered);
            setFetching(false);
        }, 300);
    };

    const handleSelect = (selected: string) => {
        if (!selected) return;

        // Extraire l'email depuis le format "Name (email@example.com)"
        const emailMatch = selected.match(/\((.*?)\)/);
        if (!emailMatch) return;

        const email = emailMatch[1];
        const targetUser = users.find(u => u.email === email);

        if (!targetUser) return;

        setSearch('');
        if (onClose) onClose();

        // Utiliser la route du package laravel-impersonate (GET)
        router.visit(`/impersonate/take/${targetUser.id}`, {
            preserveState: false,
        });
    };

    return (
        <DropdownMenu.Sub>
            <div className="px-2 py-2" onKeyDown={(e) => e.stopPropagation()}>
                <SearchSelect
                    value={search}
                    onChange={handleSearch}
                    onSubmit={handleSelect}
                    propositions={propositions}
                    loading={fetching}
                    placeholder={t('Search user to impersonate') || 'Search user...'}
                />
            </div>
        </DropdownMenu.Sub>
    );
}

