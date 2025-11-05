import { User } from '@/types';

/**
 * Vérifie si l'utilisateur a un rôle spécifique
 */
export function hasRole(user: User | null | undefined, role: string): boolean {
    if (!user || !user.roles) return false;
    return user.roles.some(r => r.name === role);
}

/**
 * Vérifie si l'utilisateur a l'un des rôles spécifiés
 */
export function hasAnyRole(user: User | null | undefined, roles: string[]): boolean {
    if (!user || !user.roles) return false;
    return user.roles.some(r => roles.includes(r.name));
}

/**
 * Vérifie si l'utilisateur a tous les rôles spécifiés
 */
export function hasAllRoles(user: User | null | undefined, roles: string[]): boolean {
    if (!user || !user.roles) return false;
    return roles.every(role => user.roles!.some(r => r.name === role));
}

/**
 * Vérifie si l'utilisateur a une permission spécifique
 */
export function hasPermission(user: User | null | undefined, permission: string): boolean {
    if (!user || !user.permissions) return false;
    return user.permissions.some(p => p.name === permission);
}

/**
 * Vérifie si l'utilisateur a l'une des permissions spécifiées
 */
export function hasAnyPermission(user: User | null | undefined, permissions: string[]): boolean {
    if (!user || !user.permissions) return false;
    return user.permissions.some(p => permissions.includes(p.name));
}

/**
 * Vérifie si l'utilisateur est admin
 */
export function isAdmin(user: User | null | undefined): boolean {
    return hasRole(user, 'admin');
}

/**
 * Vérifie si l'utilisateur est client
 */
export function isClient(user: User | null | undefined): boolean {
    return hasRole(user, 'client');
}

/**
 * Vérifie si l'utilisateur est guest
 */
export function isGuest(user: User | null | undefined): boolean {
    return hasRole(user, 'guest');
}
