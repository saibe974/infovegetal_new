import type { PropsWithChildren } from 'react';

export function TopActions(props: PropsWithChildren) {
    return (
        <div
            className="absolute top-1.5 right-4 flex items-center justify-end gap-2 lg:right-6"
            {...props}
        />
    );
}
