export interface ProjectRef {
    /** Display name — the role (Dispatcher / Performer / Reporter) when derivable,
     *  else the project.json name. Used for flow labels and test-case sheet names. */
    name: string;
    /** The raw project.json name (e.g. "ClaimsBot_Dispatcher"). Used to derive the
     *  shared <ProcessName> for the solution title. */
    fullName: string;
    /** Absolute path to the project folder. */
    dir: string;
}
/** Strip a trailing role from "<ProcessName>_Dispatcher" → "<ProcessName>". */
export declare function stripRole(name: string): string;
/**
 * Discover the UiPath projects in a folder.
 *
 *  - If the folder itself is a project (has project.json), it is a single
 *    project → returns `[thatProject]`.
 *  - Otherwise it is treated as a SOLUTION folder: every immediate subfolder
 *    that contains a project.json is returned (e.g. Dispatcher / Performer /
 *    Reporter). Ordered Dispatcher → Performer → Reporter → rest for readability.
 *
 * Returns `[]` when nothing project-like is found.
 */
export declare function discoverProjects(workingDir: string): ProjectRef[];
/** True when the folder holds more than one project (a solution). */
export declare function isSolution(workingDir: string): boolean;
