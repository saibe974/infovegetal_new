import React, { useState } from 'react';
import ReactJson from 'react18-json-view';

interface AttributesEditorProps {
    initialAttributes: Record<string, any>;
    onChange?: (attributes: Record<string, any>) => void;
}

export default function AttributesEditor({ initialAttributes, onChange }: AttributesEditorProps) {
    const [attributes, setAttributes] = useState(initialAttributes || {});

    const handleEdit = (edit: any) => {
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
