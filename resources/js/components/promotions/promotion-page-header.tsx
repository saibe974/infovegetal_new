import { StickyBar } from '@/components/ui/sticky-bar';
import { type ReactNode } from 'react';

export function PromotionPageHeader({ children }: { children: ReactNode }) {
    return (
        <div className="mb-5">
            <StickyBar zIndex={20} className="promotion-page-header" stickyClassName="shadow-sm">
                <div className="w-full">{children}</div>
            </StickyBar>
        </div>
    );
}
