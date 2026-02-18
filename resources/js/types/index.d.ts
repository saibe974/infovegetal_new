import { InertiaLinkProps } from '@inertiajs/react';
import { LucideIcon } from 'lucide-react';

export interface PaginatedCollection<T> {
    data: T[];
    links: {
        first: string;
        last: string;
        prev: string | null;
        next: string | null;
    };
    meta: {
        current_page: number;
        from: number;
        last_page: number;
        path: string;
        per_page: number;
        to: number;
        total: number;
        links: {
            url: string | null;
            label: string;
            active: boolean;
        }[];
    };
}

export interface ProductCategory {
    id: number;
    name: string;
    parent_id?: number | null;
    depth?: number;
    has_children?: boolean;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown; // This allows for additional properties...
}

export interface dbProduct {
    id: number;
    name: string;
    description: string | null;
    champs: Record<string, any> | null;
    categories: Record<string, any> | null;
    traitement: string | null;
    country?: string | null;
    mod_liv?: string | null;
    mini?: number | null;
    created_at: string;
    updated_at: string;
}

export interface CarrierZone {
    id?: number;
    carrier_id?: number;
    name: string;
    tariffs?: Record<string, number | string>;
    created_at?: string;
    updated_at?: string;
}

export interface Carrier {
    id?: number;
    name: string;
    country?: string | null;
    days?: number | null;
    minimum?: number | null;
    taxgo?: number | null;
    zones?: CarrierZone[];
    zones_count?: number;
    created_at?: string;
    updated_at?: string;
}

export interface Product {
    id: number;
    name: string;
    img_link: string;
    description: string;
    price: number;
    active: boolean;
    db_products_id?: number | null;
    ref?: string | null;
    ean13?: string | null;
    pot?: number | string | null;
    height?: string | number | null;
    price_floor?: number | null;
    price_roll?: number | null;
    price_promo?: number | null;
    producer_id?: number | null;
    tva_id?: number | null;
    cond?: number | null;
    floor?: number | null;
    roll?: number | null;
    category?: ProductCategory | null;
    dbProduct?: dbProduct | null;
    db_user_attributes?: Record<string, unknown> | null;
    attributes: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    tags?: { id: number; name: string; slug: string }[];
    [key: string]: unknown; // This allows for additional properties...
}

export interface ProductDetailed extends Product {
    // Add more detailed fields if necessary
}

export interface BreadcrumbItem {
    title: string;
    href: string;
}

export interface NavGroup {
    title: string;
    items: NavItem[];
}

export interface NavItem {
    title: string;
    href: NonNullable<InertiaLinkProps['href']>;
    icon?: LucideIcon | null;
    isActive?: boolean;
    target?: string;
}

export interface NavItemExtended extends NavItem {
    subItems?: NavItem[];
}

export interface Auth {
    user?: User | null;
    impersonate_from?: number | null;
}

export interface SharedData {
    name: string;
    quote: { message: string; author: string };
    auth: Auth;
    users?: User[];
    sidebarOpen: boolean;
    flash: {
        success?: string;
        error?: string;
    };
    query: Record<string, unknown>;
    [key: string]: unknown;
}

export interface User {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    roles?: { id: number; name: string }[];
    permissions?: { id: number; name: string }[];
    [key: string]: unknown; // This allows for additional properties...
}

export interface RightSidebarProps {
    id?: string;
    side?: 'left' | 'right';
    variant?: 'sidebar' | 'floating' | 'inset';
    className?: string;
    header?: ReactNode;
    children?: ReactNode;
    footer?: ReactNode;
    [key: string]: any;
}