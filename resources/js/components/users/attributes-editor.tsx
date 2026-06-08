import React, { useState } from 'react';
import ReactJson from 'react18-json-view';

interface AttributesEditorProps {
    initialAttributes: Record<string, unknown>;
    onChange?: (attributes: Record<string, unknown>) => void;
}

type JsonEditPayload = {
    updated_src: Record<string, unknown>;
};

export default function AttributesEditor({ initialAttributes, onChange }: AttributesEditorProps) {
    const [attributes, setAttributes] = useState(initialAttributes || {});

    const handleEdit = (edit: JsonEditPayload) => {
        setAttributes(edit.updated_src);
        onChange?.(edit.updated_src);
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
