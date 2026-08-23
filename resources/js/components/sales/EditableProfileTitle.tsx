import { CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEffect, useRef, useState } from 'react';

type Props = {
    name: string;
    canEdit: boolean;
    onRename: (name: string) => void;
    className?: string;
};

export default function EditableProfileTitle({
    name,
    canEdit,
    onRename,
    className,
}: Props) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(name);
    const cancelling = useRef(false);

    useEffect(() => {
        if (!editing) setDraft(name);
    }, [editing, name]);

    const commit = () => {
        if (cancelling.current) {
            cancelling.current = false;
            return;
        }

        const nextName = draft.trim();
        if (nextName && nextName !== name) onRename(nextName);
        setDraft(nextName || name);
        setEditing(false);
    };

    if (editing && canEdit) {
        return (
            <Input
                autoFocus
                className="h-8 max-w-sm text-lg font-semibold"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                        cancelling.current = true;
                        setDraft(name);
                        setEditing(false);
                    }
                }}
            />
        );
    }

    return (
        <CardTitle
            className={`${canEdit ? 'cursor-pointer rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none' : ''} ${className ?? ''}`}
            role={canEdit ? 'button' : undefined}
            tabIndex={canEdit ? 0 : undefined}
            onClick={() => canEdit && setEditing(true)}
            onKeyDown={(event) => {
                if (canEdit && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    setEditing(true);
                }
            }}
        >
            {name}
        </CardTitle>
    );
}
