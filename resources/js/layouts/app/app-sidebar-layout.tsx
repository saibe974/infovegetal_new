import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { RightSidebar } from '@/components/right-sidebar';
import { CartSidebarHeader } from '@/components/cart-sidebar-header';
import { SidebarProvider } from '@/components/ui/sidebar';
import { type BreadcrumbItem } from '@/types';
import { type PropsWithChildren } from 'react';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: PropsWithChildren<{ breadcrumbs?: BreadcrumbItem[] }>) {
    return (
        <>
            <AppShell variant="sidebar">
                <AppSidebar />
                <AppContent variant="sidebar" className="overflow-x-hidden pt-14">
                    <AppSidebarHeader breadcrumbs={breadcrumbs} />
                    {children}

                </AppContent>
                <RightSidebar
                    id='right'
                    variant='inset'
                    header={<CartSidebarHeader />}
                >

                </RightSidebar>

            </AppShell>
        </>
    );
}
