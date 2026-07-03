export interface WalkOptions {
    /** Lowercase extensions to include, with dot (e.g. ['.xaml', '.cs']). Empty = all. */
    extensions?: string[];
    maxFiles?: number;
}
/** Recursively list files under `root`, skipping noise directories. */
export declare function walkFiles(root: string, options?: WalkOptions): string[];
/**
 * Render a clean ASCII folder tree for `root` (folders first, a few key files),
 * skipping noise dirs. Used for the SDD "Project folder structure" section.
 */
export declare function folderTree(root: string, maxDepth?: number, maxLines?: number): string;
export declare function readText(file: string): string;
export declare function exists(file: string): boolean;
