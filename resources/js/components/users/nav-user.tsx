import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
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
import { router, usePage } from '@inertiajs/react';
import { ChevronDown, UserCheck } from 'lucide-react';

export function NavUser() {
    const pageData = usePage<SharedData>().props;
    const auth = pageData.auth;
    const users = (pageData.users as any[]) || [];
    const { state } = useSidebar();
    const isMobile = useIsMobile();

    // L'utilisateur actuellement connecté (peut être impersoné)
    const currentUser = auth.user as User;
    const isImpersonating = !!auth.impersonate_from;
    const isStrictMode = !!auth.impersonation_strict_mode;

    const toggleStrictMode = (checked: boolean | 'indeterminate') => {
        router.post('/impersonate/mode', {
            strict: checked === true,
        }, {
            preserveScroll: true,
            preserveState: true,
            replace: true,
        });
    };

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
                            <UserInfo user={currentUser} showRoles={isImpersonating ? true : false} />
                            {isImpersonating && (
                                <UserCheck size={16} className="ml-1 text-amber-500" />
                            )}
                            {isImpersonating && (
                                <div
                                    className="ml-2 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <Checkbox
                                        checked={isStrictMode}
                                        onCheckedChange={toggleStrictMode}
                                        aria-label="Mode strict d'impersonation"
                                    />
                                    <span className="text-xs text-muted-foreground">Strict</span>
                                </div>
                            )}
                            <ChevronDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg overflow-visible"
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


