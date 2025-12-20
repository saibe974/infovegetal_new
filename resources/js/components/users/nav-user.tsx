import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { UserInfo } from '@/components/users/user-info';
import { UserMenuContent } from '@/components/users/user-menu-content';
import { useIsMobile } from '@/hooks/use-mobile';
import { type SharedData, type User } from '@/types';
import { usePage } from '@inertiajs/react';
import { ChevronDown, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function NavUser() {
    const pageData = usePage<SharedData>().props;
    const auth = pageData.auth;
    const users = (pageData.users as any[]) || [];
    const { state } = useSidebar();
    const isMobile = useIsMobile();

    // L'utilisateur actuellement connecté (peut être impersoné)
    const currentUser = auth.user as User;
    const isImpersonating = !!auth.impersonate_from;

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className={`group text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent ${isImpersonating ? 'ring-2 ring-amber-500/50' : ''
                                }`}
                            data-test="sidebar-menu-button"
                        >
                            <UserInfo user={currentUser} showRoles={true} />
                            {isImpersonating && (
                                <UserCheck size={16} className="ml-1 text-amber-500" />
                            )}
                            <ChevronDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                        align="end"
                        side={
                            isMobile
                                ? 'bottom'
                                : 'bottom'
                        }
                    >
                        <UserMenuContent user={currentUser} users={users} />
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}


