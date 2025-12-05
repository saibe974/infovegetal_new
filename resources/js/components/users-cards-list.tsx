import React from "react";
import { UserCard } from "@/components/user-card";
import { type User, PaginatedCollection, SharedData } from "@/types";

interface UsersCardsListProps {
    users: User[];
    roles: Array<{ id: number; name: string }>;
    auth: SharedData['auth'];
    canEdit?: boolean;
    canDelete?: boolean;
    canChangeRole?: boolean;
    editUser?: (userId: number) => void;
    deleteUser?: (userId: number) => void;
    changeUserRole?: (userId: number, roleName: string) => void;
    className?: string;
    gridClassName?: string;
}

export default function UsersCardsList({
    users,
    roles,
    auth,
    canEdit = false,
    canDelete = false,
    canChangeRole = false,
    editUser,
    deleteUser,
    changeUserRole,
    className = "",
    gridClassName = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
}: UsersCardsListProps) {
    return (
        <div className='w-full'>
            {users.length > 0 ? (
                <div className="flex gap-10 flex-wrap items-center justify-center max-w-full">
                    {users.map((user) => (
                        <UserCard
                            key={user.id}
                            user={user}
                            roles={roles}
                            currentUser={auth.user}
                            canEdit={canEdit}
                            canDelete={canDelete}
                            canChangeRole={canChangeRole}
                            editUser={editUser}
                            deleteUser={deleteUser}
                            changeUserRole={changeUserRole}
                        />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <p className="text-muted-foreground">
                        Aucun utilisateur trouvé
                    </p>
                </div>
            )}
        </div>
    );
}
