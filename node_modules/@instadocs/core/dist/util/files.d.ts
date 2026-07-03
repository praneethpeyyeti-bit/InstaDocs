export interface WalkOptions {
    /** Lowercase extensions to include, with dot (e.g. ['.xaml', '.cs']). Empty = all. */
    extensions?: string[];
    maxFiles?: number;
}
/** Recursively list files under `root`, skipping noise directories. */
export declare function walkFiles(root: string, options?: WalkOptions): string[];
export declare function readText(file: string): string;
export declare function exists(file: string): boolean;
