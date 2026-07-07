import { RepoSource } from './repo';
import { DetectionResult } from './detect';
import { DocType } from './detect/docType';
import { SddEnrichOptions } from './analyze/sdd';
import { SddModel } from './model/sdd';
import { AddModel } from './model/add';
import { ProcessGraph } from './model/ir';
export * from './model/ir';
export * from './model/sdd';
export * from './model/add';
export * from './model/agent';
export * from './model/context';
export { loadProjectContext } from './context/projectContext';
export { detectPlatform } from './detect';
export type { DetectionResult } from './detect';
export { detectDocType } from './detect/docType';
export type { DocType, DocTypeResult } from './detect/docType';
export { discoverProjects, isSolution } from './detect/solution';
export type { ProjectRef } from './detect/solution';
export { openRepo } from './repo';
export type { RepoSource } from './repo';
export { parseProject } from './parse';
export { parseAgent } from './parse/agent';
export { enrichSdd } from './analyze/sdd';
export { enrichAdd } from './analyze/add';
export type { AddEnrichOptions } from './analyze/add';
export { compactGraph } from './analyze/compact';
export type { SddEnrichOptions } from './analyze/sdd';
export type { GatewayConfig } from './analyze/gateway';
export { resolveUiPathSession } from './analyze/uipathSession';
export type { UiPathSession } from './analyze/uipathSession';
export { resolveGatewayConfig, loadInstadocsConfig, DEFAULT_GATEWAY_MODEL, } from './analyze/gatewayConfig';
export type { InstadocsGatewayConfig, GatewayResolution } from './analyze/gatewayConfig';
export { sddToMarkdown, addToMarkdown, testCasesToMarkdown } from './export/sddMarkdown';
export { exportDeliverables, fillSddDocx, fillAddDocx, fillTestCasesXlsx, } from './export';
export type { ExportPaths, TemplateOverrides } from './export';
export interface PipelineOptions {
    source: RepoSource;
    /** Force a platform instead of auto-detecting. */
    platformOverride?: import('./model/ir').Platform;
    /** Force the deliverable type instead of auto-detecting RPA vs agentic. */
    docTypeOverride?: DocType;
    enrich?: SddEnrichOptions;
    /**
     * Pre-authored analysis. When supplied, the analyze stage is skipped and this
     * model is used directly (still validated). Lets an external analyst — e.g.
     * an agent grounded in the discovery context — provide the content without
     * calling the LLM Gateway. Must match the resolved doc type (SddModel for RPA,
     * AddModel for agentic). Identity fields are backfilled.
     */
    model?: SddModel | AddModel;
    /** ISO date string stamped onto documents (caller supplies for reproducibility). */
    generatedOn: string;
    onProgress?: (message: string) => void;
}
export interface PipelineResult {
    detection: DetectionResult;
    /** 'sdd' (RPA) or 'add' (agentic). */
    docType: DocType;
    graph: ProcessGraph;
    model: SddModel | AddModel;
    usedLlm: boolean;
}
/**
 * End-to-end: open repo -> detect -> parse -> analyze -> generate.
 * Cleans up any cloned temp dir before returning.
 */
export declare function runPipeline(options: PipelineOptions): Promise<PipelineResult>;
