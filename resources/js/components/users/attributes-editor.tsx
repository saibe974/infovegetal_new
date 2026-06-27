import React, { useState } from 'react';
import ReactJson from 'react18-json-view';

interface AttributesEditorProps {
    initialAttributes: Record<string, unknown>;
    onChange?: (attributes: Record<string, unknown>) => void;
}

export default function AttributesEditor({ initialAttributes, onChange }: AttributesEditorProps) {
    const [attributes, setAttributes] = useState(initialAttributes || {});

    const handleEdit = (edit: { updated_src?: Record<string, unknown>; src?: Record<string, unknown> }) => {
        const next = edit.updated_src ?? edit.src ?? {};
        setAttributes(next);
        onChange?.(next);
    };

    return (
        <ReactJson
            src={attributes}
            onEdit={handleEdit}
            onAdd={handleEdit}
            onDelete={handleEdit}
            enableClipboard={false}
            collapsed={false}
            style={{ fontSize: 14 }}
        />
    );
}
