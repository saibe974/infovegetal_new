import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useInitials } from '@/hooks/use-initials';
import { type User } from '@/types';

export function UserInfo({
    user,
    showEmail = false,
    showRoles = false,
}: {
    user: User;
    showEmail?: boolean;
    showRoles?: boolean;
}) {
    const getInitials = useInitials();

    return (
        <>
            <Avatar className="h-8 w-8 overflow-hidden rounded-full">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                    {getInitials(user.name)}
                </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                {showEmail && (
                    <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                    </span>
                )}
                {showRoles && user.roles && user.roles.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                        {user.roles.slice(0, 2).map((role) => (
                            <Badge
                                key={role.id}
                                variant={
                                    role.name === 'dev'
                                        ? 'destructive'
                                        : role.name === 'admin'
                                            ? 'default'
                                            : 'secondary'
                                }
                                className="text-[10px] px-1 py-0 h-4"
                            >
                                {role.name}
                            </Badge>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

