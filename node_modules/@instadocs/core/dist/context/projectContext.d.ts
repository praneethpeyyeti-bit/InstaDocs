import { ContextDependency, ProjectContext } from '../model/context';
/**
 * Locate and parse a UiPath "Project Context" document produced by the
 * `uipath-project-discovery-agent`.
 *
 * Locations, in priority order:
 *   1. AGENTS.md — the block between <!-- PROJECT-CONTEXT:START --> and
 *      <!-- PROJECT-CONTEXT:END --> (the cross-agent convention).
 *   2. .claude/rules/project-context.md — the full file.
 *
 * Returns undefined when no discovery document is present, so the pipeline
 * cleanly falls back to InstaDocs' own project.json parse.
 */
export declare function loadProjectContext(workingDir: string): ProjectContext | undefined;
export declare function parseProjectContext(raw: string, source: string): ProjectContext;
/**
 * Map UiPath dependency packages to the business applications/systems they
 * imply, for the PDD "Applications Used" section. Shared by the deterministic
 * fallback and the template fill.
 */
/** Map a single dependency package to the application/system it implies. */
export declare function packageToApp(pkg: string): string | undefined;
export declare function dependenciesToApplications(deps: ContextDependency[]): string[];
