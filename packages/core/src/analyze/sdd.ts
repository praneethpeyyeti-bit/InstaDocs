import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { PLATFORM_LABELS, ProcessGraph, emptyGraph } from '../model/ir';
import { SddModel, SddModelSchema } from '../model/sdd';
import { GatewayConfig, GatewayError, chat } from './gateway';
import { compactGraph } from './compact';
import { refreshUiPathSession } from './uipathSession';
import { dependenciesToApplications } from '../context/projectContext';
import { isReframework } from '../export/flowchart';

/** Cache file for a given (model + prompt) — lets re-runs of the same project skip the LLM. */
function cachePath(model: string, prompt: string): string {
  const key = crypto.createHash('sha256').update(`${model}\n${prompt}`).digest('hex').slice(0, 32);
  return path.join(os.tmpdir(), 'instadocs-cache', `sdd-${key}.json`);
}

/** Apply the code-authoritative backfills to a parsed SddModel (shared by fresh + cached paths). */
function finalizeModel(model: SddModel, graph: ProcessGraph): SddModel {
  model.projectName ||= graph.projectName;
  model.platformLabel ||= PLATFORM_LABELS[graph.platform];
  if (!model.dependencies.length) model.dependencies = deriveDependencies(graph);
  backfillDependencyVersions(model, graph);
  model.queueItemJson = buildQueueItemJson(graph);
  return model;
}

export interface SddEnrichOptions {
  gateway?: GatewayConfig;
  maxRetries?: number;
  onProgress?: (message: string) => void;
}

const SYSTEM_PROMPT = `You are a senior RPA solution architect writing a Solution Design Document (SDD) — the TECHNICAL design record for an automation, aimed at developers, architects and support engineers.

You are given EVIDENCE about a UiPath automation: a project-discovery context (authoritative summary of structure, dependencies, conventions, key workflows, architecture) plus a compacted technical outline (arguments, activities, invocations, exception handlers). Use it to describe the SOLUTION DESIGN accurately and concretely.

Fill every section from the evidence. Be technical and specific (name the real workflows, dependencies, config keys, queues, exceptions). Where something is genuinely not derivable (e.g. a person's email, a production schedule), use "To be provided by SME" rather than inventing it. Do not fabricate systems, versions, or values not implied by the evidence.

BE CONCISE — this is a reference design document, not prose. Keep every narrative field to 2-4 sentences, and every list/table to its most relevant items (typically 4-8 rows, more only when the evidence clearly warrants it). Do not pad, repeat, or restate. Shorter, accurate output is strongly preferred — it is faster and easier to read.

Guidance per field:
- purpose: what the solution does and why it exists (2-4 sentences, technical but clear).
- summary: a technical overview of how the automation is structured and runs.
- architecture: a SHORT 1-2 sentence overview only. Put the detail in architecturePoints (do NOT write one long paragraph here).
- architecturePoints: the architecture broken into 4-8 labelled points, each {aspect, detail}. Cover, where applicable: Pattern (e.g. REFramework state machine / linear Sequence / Flowchart / other), Key components & workflows, Data flow, External integrations, Configuration, Error handling & retry, Scalability. Keep each detail to one or two sentences.
- highLevelSteps: the main BUSINESS steps of the process in execution order, as an array of 4-12 short imperative phrases (e.g. "Log in to System1", "Retrieve work item details", "Calculate SHA1 security hash", "Update work item", "Set transaction status"). These drive the high-level process flow diagram, so describe the real business flow — NOT framework plumbing (no "Initialize", "Get Transaction Data", "Kill processes"). For a MULTI-PROJECT solution leave this empty and use projectFlows instead.
- projectFlows: ONLY for a multi-project solution (e.g. Dispatcher / Performer / Reporter). One entry per project: { project: <its name>, steps: [4-12 high-level business steps for that project] }. Each project gets its own high-level flow diagram. Leave empty for a single-project solution.
- stateFlows: ONLY for a REFramework state-machine project (when the evidence has a "REFRAMEWORK STATES" section). One entry per state, using the EXACT state names listed there (e.g. Initialization, Get Transaction Data, Process Transaction, End Process). Each: { state, steps: [2-6 SHORT business steps, each ≤6 words, describing what that state ACTUALLY DOES and naming the real application(s) — e.g. "Read config workbook", "Retrieve Orchestrator assets", "Log in to ACME System1", "Calculate SHA1 hash", "Update work item status", "Close all applications"] }. Ground every step in that state's invoked workflows / activities / apps from the evidence. Do NOT restate the workflow file names. Leave EMPTY for non-REFramework projects.
- systemsPrereq: systems/applications the bot needs and the requisite for each (access, license, network).
- accessSettings: per system — access detail, access level (read/write), access method (API/UI/DB).
- robotInfo: key/value robot & process facts (robot type, execution target, concurrency, unattended/attended, entry point, in/out arguments).
- processes: the deployable process(es) — name, Orchestrator folder path (if known else "To be confirmed"), description.
- triggers: how it is started (queue trigger, time trigger, manual) — use "To be provided by SME" for unknown schedules.
- queues: Orchestrator queues used (from config), folder path, details.
- orchestratorAssets: assets/credentials the process reads (from config), each as item + description.
- designSpecifications / designConsiderations: notable design decisions and constraints. Write as SEVERAL concise bullet points, ONE PER LINE (separate points with a newline "\n"), not one long paragraph.
- namingConventions: the conventions actually observed (arguments in_/out_/io_, PascalCase workflows, etc.) as a list of short strings.
- modules: EACH workflow/module — name, parent/wrapper, arguments (brief), Is Reusable (Yes/No), project folder path, short description. Cover framework AND business workflows.
- reporting: what reports/logs the process produces — as bullet points, ONE PER LINE (newline-separated).
- folderStructure: the project folder layout (as a short text tree, one entry per line).
- processRuns: how a run proceeds end to end — as ordered bullet points, ONE PER LINE (newline-separated).
- exceptions: EACH meaningful exception — code/name, detail, type (Business/System/Application), bot action, notification details.
- debuggingTips, optimizations, codeReview: practical technical notes grounded in the code — each as bullet points, ONE PER LINE (newline-separated), not a paragraph.
- dependencies: UiPath activity packages used (name, version, purpose).
- externalLibraries: non-UiPath / third-party libraries or custom code libraries (empty if none).
- futureImprovements: concrete improvement ideas (list).
- complianceItems: handling of credentials, PII, secrets, audit (note real findings, e.g. hardcoded credentials, as facts).
- dataSecurity: credential/PII/secret handling and audit — as bullet points, ONE PER LINE (newline-separated).
- glossary: key terms/abbreviations used (term + definition).
- testScenarios: UAT test cases covering the happy path, each major branch, and each exception (id like TC-01, title, type positive/negative/exception, preconditions, steps[], testData, expectedResult, tracesTo).

Respond with ONLY a single JSON object matching the schema. No markdown, no commentary.`;

const SCHEMA_HINT = [
  'projectName, platformLabel, purpose, summary, architecture, architecturePoints:[{aspect,detail}], highLevelSteps:[string], projectFlows:[{project,steps:[string]}], stateFlows:[{state,steps:[string]}],',
  'revisions:[{rev,date,role,summary,author}], contacts:[{role,name,email,org}], sourceDocuments:[{title,author,version,date}],',
  'systemsPrereq:[{system,requisite}], accessSettings:[{system,detail,level,method}], robotInfo:[{item,desc}],',
  'processes:[{name,folderPath,description}], triggers:[{process,type,recurrence,folderPath,notes}], queues:[{name,folderPath,details}],',
  'designSpecifications, orchestratorFolders, orchestratorAssets:[{item,desc}], designConsiderations, namingConventions:[string],',
  'modules:[{name,parent,arguments,reusable,folderPath,description}], reporting, folderStructure, processRuns,',
  'exceptions:[{code,detail,type,botAction,notification}], debuggingTips, optimizations, codeReview,',
  'dependencies:[{name,version,purpose}], externalLibraries:[{name,version,purpose}], futureImprovements:[string],',
  'complianceItems:[{item,desc}], dataSecurity, glossary:[{term,definition}],',
  'testScenarios:[{id,title,type:"positive"|"negative"|"exception",preconditions,steps:[string],testData,expectedResult,tracesTo}]',
].join(' ');

/**
 * Enrich a ProcessGraph into an SddModel via the LLM Gateway. LLM-only — there
 * is no deterministic fallback: if the Gateway is unavailable or every attempt
 * fails, this throws so the caller surfaces the error rather than emitting a
 * mechanical document.
 */
export async function enrichSdd(
  graph: ProcessGraph,
  options: SddEnrichOptions = {}
): Promise<{ model: SddModel; usedLlm: boolean }> {
  const { gateway, maxRetries = 2, onProgress } = options;

  if (!gateway) {
    throw new Error(
      'InstaDocs requires the UiPath LLM Gateway (no deterministic mode). ' +
        'Run `uip login` (staging: `uip login --authority https://staging.uipath.com --organization <org> --tenant <tenant>`) or set INSTADOCS_GATEWAY_URL/TOKEN.'
    );
  }

  const compact = compactGraph(graph);
  const userPrompt = [
    `Project: ${graph.projectName}`,
    `Platform: ${PLATFORM_LABELS[graph.platform]}`,
    `Entry points: ${graph.entryPoints.join(', ') || '(unknown)'}`,
    '',
    'EVIDENCE (project-discovery context + normalized workflow):',
    compact,
    '',
    'Write the SDD JSON now, technical and grounded in the evidence.',
  ].join('\n');

  // Cache: identical project + model => reuse the prior LLM output (instant).
  const cacheEnabled = !process.env.INSTADOCS_NO_CACHE;
  const cp = cachePath(gateway.model, userPrompt);
  if (cacheEnabled) {
    try {
      if (fs.existsSync(cp)) {
        const model = finalizeModel(SddModelSchema.parse(extractJson(fs.readFileSync(cp, 'utf8'))), graph);
        onProgress?.('Using cached analysis (same project + model) — skipping the Gateway call.');
        return { model, usedLlm: true };
      }
    } catch {
      /* stale/corrupt cache — fall through to a fresh call */
    }
  }

  let lastErr: unknown;
  let token = gateway.token;
  let refreshedOnce = false;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      onProgress?.(`Calling UiPath LLM Gateway (attempt ${attempt})…`);
      const raw = await chat({ ...gateway, token }, [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
        { role: 'user', content: `JSON Schema (informal): ${SCHEMA_HINT}` },
      ]);
      const model = finalizeModel(SddModelSchema.parse(extractJson(raw)), graph);
      if (cacheEnabled) {
        try {
          fs.mkdirSync(path.dirname(cp), { recursive: true });
          fs.writeFileSync(cp, raw);
        } catch {
          /* cache write is best-effort */
        }
      }
      return { model, usedLlm: true };
    } catch (err) {
      lastErr = err;
      // Auto-refresh the uip session on an expired-token 401 and retry once
      // (this attempt is not consumed).
      if (err instanceof GatewayError && err.status === 401 && !refreshedOnce) {
        refreshedOnce = true;
        onProgress?.('Access token expired — refreshing uip session…');
        const fresh = refreshUiPathSession();
        if (fresh?.token && fresh.token !== token) {
          token = fresh.token;
          attempt--; // retry with the refreshed token without counting this attempt
          continue;
        }
      }
      onProgress?.(`Attempt ${attempt} failed: ${(err as Error).message}`);
    }
  }

  throw new Error(`LLM Gateway enrichment failed after ${maxRetries + 1} attempt(s): ${(lastErr as Error)?.message ?? lastErr}`);
}

/**
 * Enrich a MULTI-PROJECT solution (e.g. Dispatcher / Performer / Reporter) into
 * a single combined SddModel. Each project's compacted evidence is included and
 * the LLM is asked for solution-level content plus one `projectFlows` entry per
 * project (each drives its own high-level flow diagram). LLM-only.
 */
export async function enrichSddSolution(
  solutionName: string,
  projects: { name: string; graph: ProcessGraph }[],
  merged: ProcessGraph,
  options: SddEnrichOptions = {}
): Promise<{ model: SddModel; usedLlm: boolean }> {
  const { gateway, maxRetries = 2, onProgress } = options;
  if (!gateway) {
    throw new Error(
      'InstaDocs requires the UiPath LLM Gateway (no deterministic mode). Run `uip login` or set INSTADOCS_GATEWAY_URL/TOKEN.'
    );
  }

  const evidence = projects
    .map((p) => `=== PROJECT: ${p.name} ===\n${compactGraph(p.graph)}`)
    .join('\n\n');
  const userPrompt = [
    `Solution: ${solutionName}`,
    `Platform: ${PLATFORM_LABELS[merged.platform]}`,
    `This is a MULTI-PROJECT solution with ${projects.length} projects: ${projects.map((p) => p.name).join(', ')}.`,
    'Produce ONE solution-level SDD covering all projects. Set projectName to the solution name.',
    'Leave top-level highLevelSteps EMPTY and instead fill projectFlows with one entry per project (project = its name, steps = its high-level business steps).',
    'Combine dependencies, modules and exceptions across all projects.',
    `For testScenarios: provide coverage for EACH project and set every scenario's "project" field to the exact project name it tests (one of: ${projects.map((p) => p.name).join(', ')}). Give each project its own happy-path, branch and exception cases.`,
    '',
    'EVIDENCE (per project):',
    evidence,
    '',
    'Write the solution SDD JSON now, technical and grounded in the evidence.',
  ].join('\n');

  let lastErr: unknown;
  let token = gateway.token;
  let refreshedOnce = false;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      onProgress?.(`Calling UiPath LLM Gateway for solution (attempt ${attempt})…`);
      const raw = await chat({ ...gateway, token }, [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
        { role: 'user', content: `JSON Schema (informal): ${SCHEMA_HINT}` },
      ]);
      const model = SddModelSchema.parse(extractJson(raw));
      model.projectName ||= solutionName;
      model.platformLabel ||= PLATFORM_LABELS[merged.platform];
      if (!model.dependencies.length) model.dependencies = deriveDependencies(merged);
      backfillDependencyVersions(model, merged);
      model.queueItemJson = buildQueueItemJson(merged); // authoritative — from code
      // Ensure every project has a flow entry even if the LLM missed one, and
      // stamp each flow with its project's ACTUAL layout so the exporter draws a
      // REFramework state swimlane only for genuine REFramework projects (a
      // Flowchart dispatcher stays a normal flowchart).
      for (const p of projects) {
        const isRef = p.graph.layout === 'statemachine' || (!p.graph.layout && isReframework(p.graph));
        const sm = p.graph.stateMachine; // real parsed state machine, when present
        const existing = model.projectFlows.find((f) => f.project.toLowerCase() === p.name.toLowerCase());
        if (existing) {
          existing.reframework = isRef;
          if (sm) existing.stateMachine = sm;
        } else {
          model.projectFlows.push({ project: p.name, steps: deriveHighLevelSteps(p.graph), reframework: isRef, stateMachine: sm });
        }
      }
      return { model, usedLlm: true };
    } catch (err) {
      lastErr = err;
      if (err instanceof GatewayError && err.status === 401 && !refreshedOnce) {
        refreshedOnce = true;
        onProgress?.('Access token expired — refreshing uip session…');
        const fresh = refreshUiPathSession();
        if (fresh?.token && fresh.token !== token) {
          token = fresh.token;
          attempt--;
          continue;
        }
      }
      onProgress?.(`Attempt ${attempt} failed: ${(err as Error).message}`);
    }
  }
  throw new Error(`LLM Gateway solution enrichment failed after ${maxRetries + 1} attempt(s): ${(lastErr as Error)?.message ?? lastErr}`);
}

/** Merge several project graphs into one graph for solution-level fields. */
export function mergeGraphs(name: string, graphs: ProcessGraph[]): ProcessGraph {
  const merged = emptyGraph('uipath', name);
  const depSeen = new Set<string>();
  for (const g of graphs) {
    merged.nodes.push(...g.nodes);
    merged.edges.push(...g.edges);
    merged.arguments.push(...g.arguments);
    merged.variables.push(...g.variables);
    merged.invocations.push(...g.invocations);
    merged.tryCatches.push(...g.tryCatches);
    for (const e of g.entryPoints) merged.entryPoints.push(e);
    for (const d of g.dependencies ?? []) {
      const key = d.package.toLowerCase();
      if (!depSeen.has(key)) {
        depSeen.add(key);
        (merged.dependencies ??= []).push(d);
      }
    }
    for (const q of g.queueItems ?? []) (merged.queueItems ??= []).push(q);
  }
  return merged;
}

/**
 * Parse the model's JSON robustly. LLMs (esp. faster models) frequently emit
 * (a) raw control characters inside string values and (b) truncated JSON when
 * the output is cut off — both make JSON.parse throw, which otherwise wastes a
 * ~2-minute retry per failure. We try direct → control-char-sanitized →
 * truncation-repaired, so the FIRST attempt usually succeeds.
 */
function extractJson(raw: string): unknown {
  let t = raw.trim().replace(/^```[a-zA-Z]*\n?|\n?```$/g, '').trim();
  const s = t.indexOf('{');
  if (s > 0) t = t.slice(s); // drop any preamble before the object
  const attempts = [t, sanitizeControlChars(t), repairJson(sanitizeControlChars(t))];
  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      /* try the next, more-repaired form */
    }
  }
  throw new Error('Response did not contain valid JSON.');
}

/** Escape raw control characters (newlines/tabs/etc.) that appear INSIDE JSON strings. */
function sanitizeControlChars(s: string): string {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = s.charCodeAt(i);
    if (inStr) {
      if (esc) {
        out += ch;
        esc = false;
      } else if (ch === '\\') {
        out += ch;
        esc = true;
      } else if (ch === '"') {
        out += ch;
        inStr = false;
      } else if (code < 0x20) {
        out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : '\\u' + code.toString(16).padStart(4, '0');
      } else {
        out += ch;
      }
    } else {
      out += ch;
      if (ch === '"') inStr = true;
    }
  }
  return out;
}

/** Repair truncated JSON: close a dangling string, drop a trailing partial token, close open brackets. */
function repairJson(s: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  let out = s;
  if (inStr) out += '"'; // close a dangling string
  out = out.replace(/,\s*$/, '').replace(/:\s*$/, ': null'); // drop trailing comma / dangling key
  while (stack.length) out += stack.pop();
  return out;
}

function deriveDependencies(graph: ProcessGraph): SddModel['dependencies'] {
  const ctx = graph.projectContext;
  // Prefer discovery context (has descriptions); else project.json dependencies.
  if (ctx?.dependencies?.length) {
    return ctx.dependencies.map((d) => ({
      name: d.package,
      version: d.version ?? '',
      purpose: d.description || d.category || 'UiPath activity package',
    }));
  }
  return (graph.dependencies ?? []).map((d) => ({
    name: d.package,
    version: d.version ?? '',
    purpose: 'UiPath activity package',
  }));
}

// REFramework plumbing workflow names to exclude from the high-level flow.
const FRAMEWORK_WF =
  /InitAllSettings|InitAllApplications|CloseAllApplications|KillAllProcesses|GetTransactionData|SetTransactionStatus|RetryCurrentTransaction|TakeScreenshot|SendExceptionEmail|^Process\b|^Main\b|CloseAllApplications/i;

/**
 * Best-effort high-level business steps from the invoked workflows, excluding
 * REFramework plumbing and framework-folder files. Used only as an offline
 * fallback; the LLM path supplies richer steps.
 */
function deriveHighLevelSteps(graph: ProcessGraph): string[] {
  const seen = new Set<string>();
  const steps: string[] = [];
  for (const inv of graph.invocations) {
    const base = inv.target.split(/[\\/]/).pop() ?? inv.target;
    const name = base.replace(/\.xaml$/i, '');
    if (!name || /framework/i.test(inv.target) || FRAMEWORK_WF.test(name)) continue;
    const label = humanizeWorkflow(name);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    steps.push(label);
    if (steps.length >= 12) break;
  }
  return steps;
}

/** "System1_Login" / "GenerateSHA1Hash" -> "System1 Login" / "Generate SHA1 Hash". */
function humanizeWorkflow(name: string): string {
  return name
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a representative Orchestrator queue-item JSON from the Add/Bulk Add
 * Queue Item activities found in the code (the fields actually uploaded), so the
 * SDD shows the real queue-item shape rather than a guess.
 */
export function buildQueueItemJson(graph: ProcessGraph): string {
  const items = graph.queueItems ?? [];
  if (!items.length) return '';
  const fields = new Map<string, string>();
  let reference: string | undefined;
  let priority = 'Normal';
  let queue: string | undefined;
  let bulk = false;
  for (const it of items) {
    if (it.reference && !reference) reference = it.reference;
    if (it.priority) priority = it.priority;
    if (it.queue && !queue) queue = it.queue;
    if (it.bulk) bulk = true;
    for (const f of it.fields) if (!fields.has(f.name)) fields.set(f.name, f.type || 'String');
  }
  const specific: Record<string, unknown> = {};
  for (const [k, t] of fields) specific[k] = jsonExample(t);
  const refField = reference?.match(/"([^"]+)"/)?.[1] ?? reference;
  void queue; // the queue name is documented in the Queues table, not the item shape
  const obj = {
    Priority: priority,
    Reference: refField ? `<${refField}>` : '<unique reference>',
    SpecificContent: Object.keys(specific).length
      ? specific
      : bulk
        ? { '<column>': '<value from the source DataTable>' }
        : { '<field>': '<value>' },
  };
  return JSON.stringify(obj, null, 2);
}

function jsonExample(type: string): unknown {
  const t = (type || '').toLowerCase();
  if (/int|long|double|decimal|number|float/.test(t)) return 0;
  if (/bool/.test(t)) return false;
  if (/date/.test(t)) return '2026-01-01T00:00:00';
  return 'string';
}

/** All dependencies as ContextDependency shape (for application inference). */
function allDependencies(graph: ProcessGraph): { package: string; version?: string }[] {
  if (graph.projectContext?.dependencies?.length) return graph.projectContext.dependencies;
  return graph.dependencies ?? [];
}

/**
 * Fill in dependency versions the LLM left blank or marked "to be confirmed"
 * from the authoritative project.json versions (matched by package name).
 */
function backfillDependencyVersions(model: SddModel, graph: ProcessGraph): void {
  const real = graph.dependencies ?? [];
  if (!real.length) return;
  const find = (name: string) =>
    real.find((d) => d.package.toLowerCase() === name.toLowerCase()) ??
    real.find((d) => d.package.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(d.package.toLowerCase()));
  for (const dep of model.dependencies) {
    const missing = !dep.version || /to be confirmed|tbd|unknown|n\/?a/i.test(dep.version);
    if (missing) {
      const match = find(dep.name);
      if (match?.version) dep.version = match.version;
    }
  }
  // Add any project.json dependency the LLM omitted entirely.
  for (const d of real) {
    if (!model.dependencies.some((m) => m.name.toLowerCase() === d.package.toLowerCase())) {
      model.dependencies.push({ name: d.package, version: d.version ?? '', purpose: 'UiPath activity package' });
    }
  }
}

/**
 * Deterministic SDD — no LLM. TEST/OFFLINE SCAFFOLD ONLY: it is not wired into
 * the pipeline (which is LLM-only) and is not part of the public API. Tests use
 * it as a deterministic model source to exercise template filling without a
 * live LLM Gateway. Produces a structurally-complete (if terse) model straight
 * from the ProcessGraph + discovery context.
 */
export function deterministicSdd(graph: ProcessGraph): SddModel {
  const ctx = graph.projectContext;
  const platformLabel = PLATFORM_LABELS[graph.platform];
  const deps = deriveDependencies(graph);
  const apps = dependenciesToApplications(allDependencies(graph));

  const modules: SddModel['modules'] = (ctx?.keyWorkflows ?? []).map((w) => ({
    name: w.workflow,
    parent: '',
    arguments: '',
    reusable: /reusable|library|helper/i.test(w.purpose ?? '') ? 'Yes' : '',
    folderPath: '',
    description: w.purpose ?? '',
  }));
  // Fall back to invocation targets when no discovery workflow list is present.
  if (!modules.length) {
    for (const inv of graph.invocations) modules.push({ name: inv.target, parent: '', arguments: '', reusable: '', folderPath: '', description: 'Invoked workflow.' });
  }

  const exceptions: SddModel['exceptions'] = [];
  for (const t of graph.tryCatches) {
    exceptions.push({ code: t.exceptionType ?? 'System exception', detail: t.handlerSummary ?? 'A step inside a try/catch failed.', type: 'System', botAction: 'Caught and handled by the workflow.', notification: '' });
  }
  for (const n of graph.nodes.filter((x) => x.kind === 'throw')) {
    exceptions.push({ code: n.displayName, detail: 'Business rule violation raised by the workflow.', type: 'Business', botAction: 'Process raises to signal the violation.', notification: '' });
  }

  return {
    projectName: graph.projectName,
    platformLabel,
    purpose: `Solution Design Document for "${graph.projectName}", a ${platformLabel} automation comprising ${graph.nodes.length} activities across ${graph.entryPoints.length || 1} entry point(s). Configure the UiPath LLM Gateway for a fuller technical narrative.`,
    summary: ctx?.overview?.description || `Automation "${graph.projectName}" built on ${platformLabel}.`,
    architecture: ctx?.architecture || '',
    architecturePoints: [],
    highLevelSteps: deriveHighLevelSteps(graph),
    projectFlows: [],
    stateFlows: [],
    revisions: [],
    contacts: [],
    sourceDocuments: [],
    systemsPrereq: apps.map((a) => ({ system: a, requisite: 'Access provisioned for the bot and developer.' })),
    accessSettings: apps.map((a) => ({ system: a, detail: 'Used during processing', level: 'Read/Write', method: /API|HTTP/i.test(a) ? 'API' : 'UI' })),
    robotInfo: [
      { item: 'Entry point', desc: graph.entryPoints.join(', ') || 'Main' },
      { item: 'Activities', desc: String(graph.nodes.length) },
      { item: 'Arguments', desc: String(graph.arguments.length) },
    ],
    processes: [{ name: graph.projectName, folderPath: 'To be confirmed', description: ctx?.overview?.description || '' }],
    triggers: [{ process: graph.projectName, type: 'To be provided by SME', recurrence: '', folderPath: '', notes: '' }],
    queues: [],
    designSpecifications: '',
    orchestratorFolders: '',
    orchestratorAssets: [],
    queueItemJson: buildQueueItemJson(graph),
    designConsiderations: '',
    namingConventions: ctx?.conventions?.slice(0, 10) ?? [],
    modules,
    reporting: '',
    folderStructure: '',
    processRuns: '',
    exceptions,
    debuggingTips: '',
    optimizations: '',
    codeReview: '',
    dependencies: deps,
    externalLibraries: [],
    futureImprovements: [],
    complianceItems: [],
    dataSecurity: '',
    glossary: [
      { term: 'RPA', definition: 'Robotic Process Automation' },
      { term: 'SDD', definition: 'Solution Design Document' },
    ],
    testScenarios: deriveTests(graph),
  };
}

function deriveTests(graph: ProcessGraph): SddModel['testScenarios'] {
  const tests: SddModel['testScenarios'] = [
    {
      id: 'TC-01',
      title: 'Happy path — process completes successfully',
      type: 'positive',
      preconditions: 'Valid inputs supplied; all systems available.',
      steps: ['Provide valid inputs', 'Run the process end to end'],
      testData: 'Representative valid input set',
      expectedResult: 'Process completes and produces expected outputs.',
      tracesTo: graph.entryPoints[0] ?? 'Main',
    },
  ];
  let n = 2;
  for (const b of graph.nodes.filter((x) => x.kind === 'if' || x.kind === 'switch').slice(0, 6)) {
    tests.push({
      id: `TC-${String(n++).padStart(2, '0')}`,
      title: `Branch coverage — ${b.displayName}`,
      type: 'negative',
      preconditions: 'Inputs that exercise the alternate branch.',
      steps: [`Drive the decision at "${b.displayName}" to its non-default outcome`],
      testData: 'Alternate-branch data',
      expectedResult: 'Alternate branch executes as designed.',
      tracesTo: b.displayName,
    });
  }
  if (graph.tryCatches.length) {
    tests.push({
      id: `TC-${String(n++).padStart(2, '0')}`,
      title: 'Exception handling — failure is caught',
      type: 'exception',
      preconditions: 'Force a failure inside a handled step.',
      steps: ['Trigger a system/business error within a try/catch scope'],
      testData: 'Invalid input or unavailable system',
      expectedResult: 'Exception is caught and handled per design; no unhandled crash.',
      tracesTo: 'Exception handlers',
    });
  }
  return tests;
}
