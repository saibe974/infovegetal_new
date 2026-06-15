import { AppContent } from '@/components/app/app-content';
import { AppShell } from '@/components/app/app-shell';
import { AppSidebar } from '@/components/app/app-sidebar';
import { AppSidebarHeader } from '@/components/app/app-sidebar-header';
import { RightSidebar } from '@/components/app/right-sidebar';
import { CartSidebarHeader } from '@/components/cart/cart-sidebar-header';
import { CartOrderDialog } from '@/components/cart/cart-order-dialog';
import { CartOrderProvider } from '@/components/cart/cart-order.context';
import { CartProvider } from '@/components/cart/cart.context';
import { type BreadcrumbItem } from '@/types';
import { type PropsWithChildren } from 'react';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
    showRightSidebar = true,
}: PropsWithChildren<{ breadcrumbs?: BreadcrumbItem[]; showRightSidebar?: boolean }>) {
    return (
        <CartProvider>
            <CartOrderProvider>
                <CartOrderDialog />
                <AppShell variant="sidebar">
                    <AppSidebar />

                    <AppContent variant="sidebar" className="overflow-x-hidden pt-14">
                        {/* <ImpersonationBanner /> */}
                        <AppSidebarHeader breadcrumbs={breadcrumbs} />
                        {children}
                    </AppContent>

                    {showRightSidebar && (
                        <RightSidebar
                            id='right'
                            variant='inset'
                            header={<CartSidebarHeader />}
                        >
                        </RightSidebar>
                    )}

                </AppShell>
            </CartOrderProvider>
        </CartProvider>
    );
}

