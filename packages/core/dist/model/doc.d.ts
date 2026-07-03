/**
 * Doc AST — a small, exporter-neutral document model.
 *
 * Generators (PDD, test cases) build a `DocDocument`; exporters (markdown,
 * docx, pdf) walk it. This keeps document structure in ONE place so all three
 * output formats stay consistent.
 */
export interface DocDocument {
    title: string;
    subtitle?: string;
    /** Cover-page metadata rendered as a key/value block. */
    meta?: Record<string, string>;
    blocks: Block[];
}
export type Block = Heading | Paragraph | BulletList | Table;
export interface Heading {
    type: 'heading';
    level: 1 | 2 | 3;
    text: string;
}
export interface Paragraph {
    type: 'paragraph';
    text: string;
}
export interface BulletList {
    type: 'list';
    ordered?: boolean;
    items: string[];
}
export interface Table {
    type: 'table';
    headers: string[];
    rows: string[][];
}
export declare const h1: (text: string) => Heading;
export declare const h2: (text: string) => Heading;
export declare const h3: (text: string) => Heading;
export declare const p: (text: string) => Paragraph;
export declare const ul: (items: string[]) => BulletList;
export declare const ol: (items: string[]) => BulletList;
export declare const table: (headers: string[], rows: string[][]) => Table;
