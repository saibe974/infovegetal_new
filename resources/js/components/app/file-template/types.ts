export type FileBlockType = 'header' | 'items' | 'footer';
export type VariableFormatType = 'date' | 'decimal';
export type FileColumn = { id: string; name: string };
export type FileRow = { id: string; cells: Record<string, string> };
export type FileBlock = {
    id: string;
    name: string;
    type: FileBlockType;
    enabled: boolean;
    show_headers: boolean;
    columns: FileColumn[];
    rows: FileRow[];
};
export type FileTemplate = {
    name: string;
    filename: string;
    delimiter: ';' | ',' | '\t' | '|';
    blocks: FileBlock[];
};
export type FileEditorContextValue = {
    variablesForBlock: (type: FileBlockType) => string[];
    variableFormatType: (name: string) => VariableFormatType | null;
    previewValue: (value: string, type: FileBlockType) => string;
    blockLabels: Record<FileBlockType, string>;
};
