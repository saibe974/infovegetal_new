import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
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
    const isMobile = useIsMobile();

    // L'utilisateur actuellement connecté (peut être impersoné)
    const currentUser = auth.user as User;
    const isImpersonating = !!auth.impersonate_from;
    const isStrictMode = !!auth.impersonation_strict_mode;

    const toggleStrictMode = (checked: boolean) => {
        router.post('/impersonate/mode', {
            strict: checked,
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
                                    className="ml-2 flex flex-col items-center gap-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <div
                                        role="switch"
                                        aria-checked={isStrictMode}
                                        aria-label="Mode strict d'impersonation"
                                        tabIndex={0}
                                        className={`h-5 w-9 rounded-full border transition-colors ${isStrictMode
                                            ? 'bg-amber-500 border-amber-500 dark:bg-amber-400 dark:border-amber-400'
                                            : 'bg-muted border-border'
                                            }`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleStrictMode(!isStrictMode);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleStrictMode(!isStrictMode);
                                            }
                                        }}
                                    >
                                        <span
                                            className={`mt-[1px] ml-[1px] block h-3.5 w-3.5 rounded-full bg-white transition-transform ${isStrictMode ? 'translate-x-4' : ''}`}
                                        />
                                    </div>
                                    <span className="text-[10px] leading-none text-muted-foreground">Strict</span>
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


