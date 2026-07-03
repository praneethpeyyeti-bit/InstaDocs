import { PLATFORM_LABELS, ProcessGraph } from '../model/ir';
import { SddModel, SddModelSchema } from '../model/sdd';
import { GatewayConfig, GatewayError, chat } from './gateway';
import { compactGraph } from './compact';
import { refreshUiPathSession } from './uipathSession';
import { dependenciesToApplications } from '../context/projectContext';

export interface SddEnrichOptions {
  gateway?: GatewayConfig;
  maxRetries?: number;
  onProgress?: (message: string) => void;
}

const SYSTEM_PROMPT = `You are a senior RPA solution architect writing a Solution Design Document (SDD) — the TECHNICAL design record for an automation, aimed at developers, architects and support engineers.

You are given EVIDENCE about a UiPath automation: a project-discovery context (authoritative summary of structure, dependencies, conventions, key workflows, architecture) plus a compacted technical outline (arguments, activities, invocations, exception handlers). Use it to describe the SOLUTION DESIGN accurately and concretely.

Fill every section from the evidence. Be technical and specific (name the real workflows, dependencies, config keys, queues, exceptions). Where something is genuinely not derivable (e.g. a person's email, a production schedule), use "To be provided by SME" rather than inventing it. Do not fabricate systems, versions, or values not implied by the evidence.

Guidance per field:
- purpose: what the solution does and why it exists (2-4 sentences, technical but clear).
- summary: a technical overview of how the automation is structured and runs.
- architecture: the architectural pattern (e.g. REFramework state machine), data flow between components, external integrations.
- systemsPrereq: systems/applications the bot needs and the requisite for each (access, license, network).
- accessSettings: per system — access detail, access level (read/write), access method (API/UI/DB).
- robotInfo: key/value robot & process facts (robot type, execution target, concurrency, unattended/attended, entry point, in/out arguments).
- processes: the deployable process(es) — name, Orchestrator folder path (if known else "To be confirmed"), description.
- triggers: how it is started (queue trigger, time trigger, manual) — use "To be provided by SME" for unknown schedules.
- queues: Orchestrator queues used (from config), folder path, details.
- orchestratorAssets: assets/credentials the process reads (from config), each as item + description.
- designSpecifications / designConsiderations: notable design decisions and constraints.
- namingConventions: the conventions actually observed (arguments in_/out_/io_, PascalCase workflows, etc.) as a list of short strings.
- modules: EACH workflow/module — name, parent/wrapper, arguments (brief), Is Reusable (Yes/No), project folder path, short description. Cover framework AND business workflows.
- reporting: what reports/logs the process produces.
- folderStructure: the project folder layout (as a short text tree).
- processRuns: how a run proceeds end to end.
- exceptions: EACH meaningful exception — code/name, detail, type (Business/System/Application), bot action, notification details.
- debuggingTips, optimizations, codeReview: practical technical notes grounded in the code.
- dependencies: UiPath activity packages used (name, version, purpose).
- externalLibraries: non-UiPath / third-party libraries or custom code libraries (empty if none).
- futureImprovements: concrete improvement ideas (list).
- complianceItems / dataSecurity: handling of credentials, PII, secrets, audit (note real findings, e.g. hardcoded credentials, as facts).
- glossary: key terms/abbreviations used (term + definition).
- testScenarios: UAT test cases covering the happy path, each major branch, and each exception (id like TC-01, title, type positive/negative/exception, preconditions, steps[], testData, expectedResult, tracesTo).

Respond with ONLY a single JSON object matching the schema. No markdown, no commentary.`;

const SCHEMA_HINT = [
  'projectName, platformLabel, purpose, summary, architecture,',
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
      const model = SddModelSchema.parse(extractJson(raw));
      model.projectName ||= graph.projectName;
      model.platformLabel ||= PLATFORM_LABELS[graph.platform];
      // Always ensure the flow diagram + dependencies are grounded in real data.
      if (!model.dependencies.length) model.dependencies = deriveDependencies(graph);
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

function extractJson(raw: string): unknown {
  const t = raw.trim().replace(/^```[a-zA-Z]*\n?|\n?```$/g, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(t.slice(s, e + 1));
    throw new Error('Response did not contain valid JSON.');
  }
}

function deriveDependencies(graph: ProcessGraph): SddModel['dependencies'] {
  const ctx = graph.projectContext;
  if (!ctx?.dependencies?.length) return [];
  return ctx.dependencies.map((d) => ({
    name: d.package,
    version: d.version ?? '',
    purpose: d.description || d.category || 'UiPath activity package',
  }));
}

/**
 * Deterministic SDD — no LLM. Produces a structurally-complete (if terse) model
 * straight from the ProcessGraph + discovery context so the pipeline never fails.
 */
export function deterministicSdd(graph: ProcessGraph): SddModel {
  const ctx = graph.projectContext;
  const platformLabel = PLATFORM_LABELS[graph.platform];
  const deps = deriveDependencies(graph);
  const apps = ctx ? dependenciesToApplications(ctx.dependencies) : [];

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
