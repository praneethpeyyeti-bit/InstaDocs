/**
 * ProjectContext — the parsed output of the UiPath `uipath-project-discovery-agent`.
 *
 * The discovery agent (part of the `uipath-rpa` skill) returns a ≤200-line
 * markdown "Project Context" document which the skill writes to `AGENTS.md`
 * (between PROJECT-CONTEXT markers) and `.claude/rules/project-context.md`.
 * InstaDocs *consumes* that artifact to enrich the PDD with authoritative,
 * code-derived project context it cannot infer from XAML alone.
 */
export interface ContextDependency {
    package: string;
    version?: string;
    category?: string;
    description?: string;
}
export interface ContextEntryPoint {
    file: string;
    inputs?: string;
    outputs?: string;
    purpose?: string;
}
export interface ContextKeyWorkflow {
    workflow: string;
    purpose?: string;
    uses?: string;
}
export interface ProjectContextOverview {
    name?: string;
    type?: string;
    description?: string;
    targetFramework?: string;
    expressionLanguage?: string;
}
export interface ProjectContext {
    /** Full markdown of the context document — fed to the LLM as grounding. */
    raw: string;
    /** Where it was loaded from (for diagnostics). */
    source: string;
    overview?: ProjectContextOverview;
    dependencies: ContextDependency[];
    entryPoints: ContextEntryPoint[];
    keyWorkflows: ContextKeyWorkflow[];
    conventions: string[];
    architecture?: string;
}
