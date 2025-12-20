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
import { edit } from '@/routes/profile';
import { type User, type SharedData } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { LogOut, Settings, UserCheck } from 'lucide-react';
import { isAdmin } from '@/lib/roles';
import { useState } from 'react';

interface UserMenuContentProps {
    user: User;
    users?: User[];
}

export function UserMenuContent({ user, users = [] }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();
    const { auth } = usePage<SharedData>().props;
    const [showImpersonate, setShowImpersonate] = useState(false);
    const isCurrentUserAdmin = isAdmin(auth.user);

    const handleLogout = () => {
        cleanup();
        router.flushAll();
    };

    const handleStopImpersonate = () => {
        cleanup();
        router.post('/admin/impersonate/stop', {
            preserveState: false,
        });
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
            {isCurrentUserAdmin && (
                <>
                    {showImpersonate ? (
                        <ImpersonateSelect
                            users={users}
                            onClose={() => setShowImpersonate(false)}
                        />
                    ) : (
                        <DropdownMenuGroup>
                            <DropdownMenuItem
                                onClick={() => setShowImpersonate(true)}
                                onSelect={(e) => {
                                    e.preventDefault();
                                }}
                            >
                                <UserCheck className="mr-2 size-4" />
                                Impersonate user
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                    )}
                    <DropdownMenuSeparator />
                </>
            )}
            {isImpersonating && (
                <>
                    <DropdownMenuGroup>
                        <DropdownMenuItem onClick={handleStopImpersonate}>
                            <UserCheck className="mr-2 size-4" />
                            Stop impersonating
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                </>
            )}
            <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                    <Link
                        className="block w-full"
                        href={edit()}
                        as="button"
                        prefetch
                        onClick={cleanup}
                    >
                        <Settings className="mr-2" />
                        Settings
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
                    Log out
                </Link>
            </DropdownMenuItem>
        </>
    );
}


