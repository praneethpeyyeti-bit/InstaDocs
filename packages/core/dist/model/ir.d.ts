/**
 * The Intermediate Representation (IR) — the keystone of InstaDocs.
 *
 * Every platform parser reads its native files and emits a `ProcessGraph`.
 * Every downstream stage (analyze / generate / export) consumes a
 * `ProcessGraph` and NEVER touches raw platform files. This is what makes the
 * pipeline platform-agnostic.
 */
export type Platform = 'uipath' | 'powerAutomate' | 'blueprism' | 'automationAnywhere' | 'unknown';
export declare const PLATFORM_LABELS: Record<Platform, string>;
/** Normalized kind of a process node, mapped from platform-specific activities. */
export type NodeKind = 'start' | 'end' | 'sequence' | 'assign' | 'if' | 'switch' | 'loop' | 'invoke' | 'io' | 'ui' | 'log' | 'throw' | 'delay' | 'other';
export interface ProcessNode {
    id: string;
    kind: NodeKind;
    displayName: string;
    /** Platform-specific attributes preserved verbatim for the analyzer. */
    raw: Record<string, unknown>;
    /** Developer comment / annotation attached to the activity, if any. */
    annotations?: string;
}
export type EdgeKind = 'seq' | 'true' | 'false' | 'case' | 'loop-body' | 'catch';
export interface Edge {
    from: string;
    to: string;
    kind: EdgeKind;
    /** Condition/label for branch or case edges (e.g. the If condition). */
    label?: string;
}
export type Direction = 'in' | 'out' | 'inout';
export interface Variable {
    name: string;
    type?: string;
    scope?: string;
    defaultValue?: string;
}
export interface Argument {
    name: string;
    type?: string;
    direction: Direction;
    defaultValue?: string;
}
export interface Invocation {
    /** Node id of the invoke activity. */
    nodeId: string;
    target: string;
    arguments?: Record<string, string>;
}
export interface ExceptionHandler {
    /** Node id of the try/catch (or equivalent) construct. */
    nodeId: string;
    exceptionType?: string;
    handlerSummary?: string;
}
/** A declared activity/library package the project depends on. */
export interface PackageDependency {
    package: string;
    version?: string;
}
/** A field uploaded into an Orchestrator queue item (from Add/Bulk Add Queue Item). */
export interface QueueField {
    name: string;
    type?: string;
}
/** What an Add Queue Item / Bulk Add Queue Items activity uploads. */
export interface QueueItemSpec {
    queue?: string;
    reference?: string;
    priority?: string;
    fields: QueueField[];
    bulk?: boolean;
}
export interface ProcessGraph {
    platform: Platform;
    projectName: string;
    /** Where the process begins: Main.xaml, top-level flow, main bot, etc. */
    entryPoints: string[];
    nodes: ProcessNode[];
    edges: Edge[];
    variables: Variable[];
    arguments: Argument[];
    invocations: Invocation[];
    tryCatches: ExceptionHandler[];
    /**
     * Declared package dependencies read straight from project.json (name +
     * version). Authoritative — used to fill the SDD dependencies/applications
     * without the LLM having to guess versions.
     */
    dependencies?: PackageDependency[];
    /** Queue items uploaded by Add/Bulk Add Queue Item activities, for the queue-item JSON. */
    queueItems?: QueueItemSpec[];
    /**
     * Optional project-level context from the UiPath project-discovery agent
     * (AGENTS.md / project-context.md), when present. Enriches PDD sections the
     * parser can't derive from XAML alone (dependencies, conventions, etc.).
     */
    projectContext?: import('./context').ProjectContext;
    /**
     * Parsed AI Agent spec, present when the project is an agentic automation
     * (low-code `agent.json` or a coded agent). Drives the Agentic Design Document
     * path instead of the RPA Solution Design Document.
     */
    agent?: import('./agent').AgentSpec;
    /**
     * Root layout of the entry workflow — drives the process-design diagram:
     * 'statemachine' (REFramework/state machine), 'flowchart', or 'sequence'.
     */
    layout?: 'statemachine' | 'flowchart' | 'sequence';
    /** Free-form extraction diagnostics (unsupported activities, parse warnings). */
    warnings?: string[];
}
/** Convenience: an empty graph a parser can start populating. */
export declare function emptyGraph(platform: Platform, projectName: string): ProcessGraph;
