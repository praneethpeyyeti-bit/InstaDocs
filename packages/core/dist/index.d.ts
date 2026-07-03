/**
 * @instadocs/core — public API.
 *
 * The whole pipeline, plus the individual stages for callers (VS Code shell,
 * CLI, tests) that want finer control.
 */
import { RepoSource } from './repo';
import { DetectionResult } from './detect';
import { SddEnrichOptions } from './analyze/sdd';
import { SddModel } from './model/sdd';
import { ProcessGraph } from './model/ir';
export * from './model/ir';
export * from './model/sdd';
export * from './model/context';
export { loadProjectContext } from './context/projectContext';
export { detectPlatform } from './detect';
export type { DetectionResult } from './detect';
export { openRepo } from './repo';
export type { RepoSource } from './repo';
export { parseProject } from './parse';
export { enrichSdd, deterministicSdd } from './analyze/sdd';
export { compactGraph } from './analyze/compact';
export type { SddEnrichOptions } from './analyze/sdd';
export type { GatewayConfig } from './analyze/gateway';
export { resolveUiPathSession, gatewayUrlFromSession, } from './analyze/uipathSession';
export type { UiPathSession } from './analyze/uipathSession';
export { sddToMarkdown, testCasesToMarkdown } from './export/sddMarkdown';
export { exportDeliverables, fillSddDocx, fillTestCasesXlsx, } from './export';
export type { ExportPaths, TemplateOverrides } from './export';
export interface PipelineOptions {
    source: RepoSource;
    /** Force a platform instead of auto-detecting. */
    platformOverride?: import('./model/ir').Platform;
    enrich?: SddEnrichOptions;
    /**
     * Pre-authored analysis. When supplied, the analyze stage is skipped and this
     * SddModel is used directly (still validated). Lets an external analyst — e.g.
     * an agent grounded in the discovery context — provide the SDD content without
     * calling the LLM Gateway. Identity fields are backfilled.
     */
    model?: SddModel;
    /** ISO date string stamped onto documents (caller supplies for reproducibility). */
    generatedOn: string;
    onProgress?: (message: string) => void;
}
export interface PipelineResult {
    detection: DetectionResult;
    graph: ProcessGraph;
    model: SddModel;
    usedLlm: boolean;
}
/**
 * End-to-end: open repo -> detect -> parse -> analyze -> generate.
 * Cleans up any cloned temp dir before returning.
 */
export declare function runPipeline(options: PipelineOptions): Promise<PipelineResult>;
