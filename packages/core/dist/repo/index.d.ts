export interface RepoSource {
    /** A git URL (https/ssh) to clone, OR an absolute path to an existing folder. */
    location: string;
    branch?: string;
    /** Optional sub-directory within the repo that holds the automation project. */
    subPath?: string;
}
export interface OpenedRepo {
    /** Absolute path to the working tree (or the sub-path within it). */
    workingDir: string;
    /** True if we cloned into a temp dir and the caller should clean it up. */
    cloned: boolean;
    cleanup: () => void;
}
/**
 * Resolve a RepoSource to a local working directory. Clones git URLs into a
 * temp dir; opens local folders in place.
 */
export declare function openRepo(source: RepoSource): Promise<OpenedRepo>;
