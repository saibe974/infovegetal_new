import { Toaster } from '@/components/ui/sonner';
import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import type { SharedData, BreadcrumbItem } from '@/types';
import { usePage } from '@inertiajs/react';
import { type FC, type ReactNode, useEffect } from 'react';
import { toast } from 'sonner';

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
}

const AppLayout = ({ children, breadcrumbs, ...props }: AppLayoutProps) => {
    const page = usePage<SharedData>();
    
    useEffect(() => {
        if (page.props.flash.success) {
            toast.success(page.props.flash.success);
        }
        if (page.props.flash.error) {
            toast.error(page.props.flash.error);
        }
    }, [page.props.flash]);

    return (
    <AppLayoutTemplate breadcrumbs={breadcrumbs} {...props}>
        {children}
        <Toaster position="top-center" richColors />
    </AppLayoutTemplate>
    );
};

export function withAppLayout<T>(breadcrumbs: BreadcrumbItem[], component: FC<T>) {
    // @ts-expect-error layout exists for inertia
    component.layout = (page: ReactNode) => <AppLayout breadcrumbs={breadcrumbs}>
        <div className="p-2 lg:p-4">
            {page}
        </div>
    </AppLayout>;
    return component;
}

export default AppLayout;