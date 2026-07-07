/**
 * @instadocs/core — public API.
 *
 * The whole pipeline, plus the individual stages for callers (VS Code shell,
 * CLI, tests) that want finer control.
 */
import * as path from 'path';
import { openRepo, RepoSource } from './repo';
import { detectPlatform, DetectionResult } from './detect';
import { detectDocType, DocType } from './detect/docType';
import { discoverProjects, stripRole } from './detect/solution';
import { parseProject } from './parse';
import { loadProjectContext } from './context/projectContext';
import { folderTree } from './util/files';
import { enrichSdd, enrichSddSolution, mergeGraphs, SddEnrichOptions } from './analyze/sdd';
import { enrichAdd } from './analyze/add';
import { SddModel, SddModelSchema } from './model/sdd';
import { AddModel, AddModelSchema } from './model/add';
import { PLATFORM_LABELS, ProcessGraph } from './model/ir';

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
// LLM-only public surface: enrichSdd/enrichAdd require the UiPath LLM Gateway.
// (`deterministicSdd` is intentionally NOT re-exported — it is an offline test
//  scaffold only, never used by the pipeline.)
export { enrichSdd } from './analyze/sdd';
export { enrichAdd } from './analyze/add';
export type { AddEnrichOptions } from './analyze/add';
export { compactGraph } from './analyze/compact';
export type { SddEnrichOptions } from './analyze/sdd';
export type { GatewayConfig } from './analyze/gateway';
export { resolveUiPathSession } from './analyze/uipathSession';
export type { UiPathSession } from './analyze/uipathSession';
export {
  resolveGatewayConfig,
  loadInstadocsConfig,
  DEFAULT_GATEWAY_MODEL,
} from './analyze/gatewayConfig';
export type { InstadocsGatewayConfig, GatewayResolution } from './analyze/gatewayConfig';
export { sddToMarkdown, addToMarkdown, testCasesToMarkdown } from './export/sddMarkdown';
export {
  exportDeliverables,
  fillSddDocx,
  fillAddDocx,
  fillTestCasesXlsx,
} from './export';
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
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const { source, generatedOn, onProgress } = options;
  const step = (m: string) => onProgress?.(m);

  step('Opening repository…');
  const repo = await openRepo(source);
  try {
    // Multi-project solution (e.g. Dispatcher / Performer / Reporter)? Produce
    // one combined SDD with a high-level flow diagram per project.
    const projects = discoverProjects(repo.workingDir);
    if (projects.length > 1 && !options.model && options.docTypeOverride !== 'add') {
      return await runSolutionPipeline(projects, options, step);
    }

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

    // RPA (SDD) vs agentic (ADD): the agent parse already ran, so prefer that
    // signal, then fall back to file-signature detection.
    const docType: DocType =
      options.docTypeOverride ?? (graph.agent ? 'add' : detectDocType(repo.workingDir).docType);
    step(`Deliverable: ${docType === 'add' ? 'Agentic Design Document' : 'Solution Design Document'}.`);

    let model: SddModel | AddModel;
    let usedLlm: boolean;
    if (options.model) {
      step('Using pre-authored analysis (discovery-grounded)…');
      model = docType === 'add' ? AddModelSchema.parse(options.model) : SddModelSchema.parse(options.model);
      model.projectName ||= graph.projectName;
      if (docType === 'add') {
        (model as AddModel).agentName ||= graph.agent?.name ?? graph.projectName;
        (model as AddModel).platformLabel ||= PLATFORM_LABELS[graph.platform];
      } else {
        (model as SddModel).platformLabel ||= PLATFORM_LABELS[graph.platform];
      }
      usedLlm = true;
    } else if (docType === 'add') {
      step('Analyzing agentic design (role, tools, model, guardrails, evaluation)…');
      ({ model, usedLlm } = await enrichAdd(graph, { ...options.enrich, onProgress: step }));
    } else {
      step('Analyzing solution design (architecture, modules, exceptions)…');
      ({ model, usedLlm } = await enrichSdd(graph, { ...options.enrich, onProgress: step }));
    }

    // Accurate project folder structure straight from disk (single project).
    if (docType === 'sdd') {
      (model as SddModel).folderStructure = folderTree(repo.workingDir);
    }

    void generatedOn;
    return { detection, docType, graph, model, usedLlm };
  } finally {
    repo.cleanup();
  }
}

/**
 * Multi-project solution pipeline: parse each project, merge for solution-level
 * fields, and produce one combined SDD (with a high-level flow diagram per
 * project). Always an SDD deliverable.
 */
async function runSolutionPipeline(
  projects: import('./detect/solution').ProjectRef[],
  options: PipelineOptions,
  step: (m: string) => void
): Promise<PipelineResult> {
  step(`Solution detected: ${projects.length} projects (${projects.map((p) => p.name).join(', ')}).`);
  const platform = options.platformOverride ?? 'uipath';

  const parsed: { name: string; graph: ProcessGraph }[] = [];
  for (const p of projects) {
    step(`Parsing project "${p.name}"…`);
    const g = await parseProject(platform, p.dir);
    const ctx = loadProjectContext(p.dir);
    if (ctx) g.projectContext = ctx;
    parsed.push({ name: p.name, graph: g });
  }

  const solutionName = deriveSolutionName(projects);
  const merged = mergeGraphs(solutionName, parsed.map((p) => p.graph));
  step(`Solution name: ${solutionName}.`);
  step(`Extracted ${merged.nodes.length} activities across ${projects.length} projects.`);

  step('Analyzing solution design across all projects…');
  const { model, usedLlm } = await enrichSddSolution(solutionName, parsed, merged, {
    ...options.enrich,
    onProgress: step,
  });

  // Accurate folder structure — one tree per project.
  model.folderStructure = projects.map((p) => folderTree(p.dir)).join('\n\n');

  const detection: DetectionResult = {
    platform: 'uipath',
    confidence: 1,
    scores: { uipath: 1, powerAutomate: 0, blueprism: 0, automationAnywhere: 0, unknown: 0 },
    evidence: [`Solution with ${projects.length} UiPath projects`],
  };
  return { detection, docType: 'sdd', graph: merged, model, usedLlm };
}

/**
 * Solution / process name, in priority order:
 *  1. the shared "<ProcessName>" from "<ProcessName>_Dispatcher/_Performer/_Reporter"
 *     project names (when all projects share the same base),
 *  2. else the parent folder that contains the projects.
 */
function deriveSolutionName(projects: import('./detect/solution').ProjectRef[]): string {
  const bases = projects
    .map((p) => stripRole(p.fullName))
    .map((b) => b.trim())
    .filter(Boolean);
  if (bases.length && bases.every((b) => b.toLowerCase() === bases[0].toLowerCase())) {
    return bases[0];
  }
  const first = projects[0];
  if (first) {
    const parent = path.basename(path.dirname(first.dir));
    if (parent && !/^[a-z]:$/i.test(parent)) return parent;
  }
  return bases[0] || 'Solution';
}
