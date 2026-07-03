/**
 * @instadocs/core — public API.
 *
 * The whole pipeline, plus the individual stages for callers (VS Code shell,
 * CLI, tests) that want finer control.
 */
import { openRepo, RepoSource } from './repo';
import { detectPlatform, DetectionResult } from './detect';
import { parseProject } from './parse';
import { loadProjectContext } from './context/projectContext';
import { enrichSdd, SddEnrichOptions } from './analyze/sdd';
import { SddModel, SddModelSchema } from './model/sdd';
import { PLATFORM_LABELS, ProcessGraph } from './model/ir';

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
export {
  resolveUiPathSession,
  gatewayUrlFromSession,
} from './analyze/uipathSession';
export type { UiPathSession } from './analyze/uipathSession';
export { sddToMarkdown, testCasesToMarkdown } from './export/sddMarkdown';
export {
  exportDeliverables,
  fillSddDocx,
  fillTestCasesXlsx,
} from './export';
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
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { source, generatedOn, onProgress } = options;
  const step = (m: string) => onProgress?.(m);

  step('Opening repository…');
  const repo = await openRepo(source);
  try {
    step('Detecting source platform…');
    const detection = detectPlatform(repo.workingDir);
    const platform = options.platformOverride ?? detection.platform;
    step(`Platform: ${platform} (confidence ${(detection.confidence * 100) | 0}%)`);

    step('Parsing workflow logic…');
    const graph = await parseProject(platform, repo.workingDir);
    step(`Extracted ${graph.nodes.length} activities, ${graph.arguments.length} arguments.`);

    // Fold in UiPath project-discovery context (AGENTS.md) when present.
    const projectContext = loadProjectContext(repo.workingDir);
    if (projectContext) {
      graph.projectContext = projectContext;
      step(
        `Loaded project context from ${projectContext.source} ` +
          `(${projectContext.dependencies.length} dependencies).`
      );
    }

    let model: SddModel;
    let usedLlm: boolean;
    if (options.model) {
      step('Using pre-authored analysis (discovery-grounded)…');
      model = SddModelSchema.parse(options.model);
      model.projectName ||= graph.projectName;
      model.platformLabel ||= PLATFORM_LABELS[graph.platform];
      usedLlm = true;
    } else {
      step('Analyzing solution design (architecture, modules, exceptions)…');
      ({ model, usedLlm } = await enrichSdd(graph, {
        ...options.enrich,
        onProgress: step,
      }));
    }

    void generatedOn;
    return { detection, graph, model, usedLlm };
  } finally {
    repo.cleanup();
  }
}
