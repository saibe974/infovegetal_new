import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/users/user-info';
import { ImpersonateSelect } from '@/components/users/impersonate-select';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { logout } from '@/routes';
import { edit as editProfile } from '@/routes/profile';
import { type User, type SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { FileText, LogOut, Settings, UserCheck } from 'lucide-react';
import { hasAnyPermission, isAdmin } from '@/lib/roles';
import { useI18n } from '@/lib/i18n';

interface UserMenuContentProps {
    user: User;
    users?: User[];
}

export function UserMenuContent({ user, users = [] }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();
    const { t } = useI18n();
    const { auth } = usePage<SharedData>().props;
    // const [showImpersonate, setShowImpersonate] = useState(false);
    // Droits de l'utilisateur réel (impersonateur), quel que soit le mode strict.
    const realActor = auth.impersonator ?? auth.user;
    const canImpersonate = isAdmin(realActor) || hasAnyPermission(realActor, [
        'users.impersonate.branch',
        'users.impersonate.all',
    ]);

    const handleLogout = () => {
        cleanup();
        router.flushAll();
    };

    const handleStopImpersonate = () => {
        cleanup();
        // Utiliser la route du package laravel-impersonate
        window.location.href = '/impersonate/leave';
    };

    const isImpersonating = !!auth.impersonate_from;

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isImpersonating && (
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={handleStopImpersonate}>
                        <UserCheck className="mr-2 size-4" />
                        {t('Stop impersonating')}
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            )}
            {canImpersonate && <ImpersonateSelect users={users} />}
            {isImpersonating && <DropdownMenuSeparator />}
            <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                    <Link
                        className="block w-full"
                        href="/settings/files"
                        as="button"
                        prefetch
                        onClick={cleanup}
                    >
                        <FileText className="mr-2" />
                        {t('My files')}
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link
                        className="block w-full"
                        href={editProfile()}
                        as="button"
                        prefetch
                        onClick={cleanup}
                    >
                        <Settings className="mr-2" />
                        {t('Settings')}
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link
                    className="block w-full"
                    href={logout()}
                    as="button"
                    onClick={handleLogout}
                    data-test="logout-button"
                >
                    <LogOut className="mr-2" />
                    {t('Log out')}
                </Link>
            </DropdownMenuItem>
        </>
    );
}

