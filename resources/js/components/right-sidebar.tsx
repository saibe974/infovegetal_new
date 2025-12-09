import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
} from '@/components/ui/sidebar';
import { RightSidebarProps } from '@/types';

export function RightSidebar({
    id = 'default',
    side = 'right',
    variant = 'sidebar',
    className = '',
    header,
    children,
    footer,
    ...props
}: RightSidebarProps) {
    return (
        <Sidebar
            id={id}
            side={side}
            variant={variant}
            className={className}
            {...props}
        >
            {header && <SidebarHeader>{header}</SidebarHeader>}
            {children && <SidebarContent>{children}</SidebarContent>}
            {footer && <SidebarFooter>{footer}</SidebarFooter>}
        </Sidebar>
    );
}
