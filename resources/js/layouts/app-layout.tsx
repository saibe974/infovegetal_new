import { AppFooter } from '@/components/app/app-footer';
import ScrollToTopButton from '@/components/ui/scroll-to-top-btn';
import { Toaster } from '@/components/ui/sonner';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import type { SharedData, BreadcrumbItem } from '@/types';
import { usePage } from '@inertiajs/react';
import { type FC, type ReactNode, useEffect } from 'react';
import { toast } from 'sonner';

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    hideFooterOnInfiniteScroll?: boolean;
}

const AppLayout = ({ children, breadcrumbs, hideFooterOnInfiniteScroll = false, ...props }: AppLayoutProps) => {
    const page = usePage<SharedData>();

    const isHomePage = usePage().component === 'home';

    useEffect(() => {
        if (page.props.flash.success) {
            toast.success(page.props.flash.success);
        }
        if (page.props.flash.error) {
            toast.error(page.props.flash.error);
        }
        console.log(page)
    }, [page.props]);

    return (
        <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
            {children}
            <AppFooter hideOnInfiniteScroll={hideFooterOnInfiniteScroll} />

            <Toaster position="top-center" richColors />
        </AppLayoutTemplate>
    );
};

export function withAppLayout<T>(breadcrumbs: BreadcrumbItem[], hideFooterOnInfiniteScroll: boolean = false, component: FC<T>,) {


    // @ts-expect-error layout exists for inertia
    component.layout = (page: ReactNode) => <AppLayout breadcrumbs={breadcrumbs} hideFooterOnInfiniteScroll={hideFooterOnInfiniteScroll}>
        <div className="p-2 lg:p-4 min-h-screen">
            {page}

        </div>
        <ScrollToTopButton />
    </AppLayout>;
    return component;
}

export default AppLayout;