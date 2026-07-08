/**
 * SddModel — the analyze-stage output for a Solution Design Document.
 *
 * The deterministic parser gives structure (ProcessGraph + discovery context);
 * the LLM Gateway pass turns that into the technical SDD content: architecture,
 * modules, orchestrator resources, exceptions, conventions, and considerations.
 *
 * The zod schema is the contract the LLM must satisfy; downstream template
 * filling ([export/sddTemplate.ts]) always receives well-formed data.
 */
import { z } from 'zod';

const Revision = z.object({
  rev: z.string(),
  date: z.string(),
  role: z.string(),
  summary: z.string(),
  author: z.string(),
});
const Contact = z.object({
  role: z.string(),
  name: z.string().default(''),
  email: z.string().default(''),
  org: z.string().default(''),
});
const SourceDoc = z.object({
  title: z.string(),
  author: z.string().default(''),
  version: z.string().default(''),
  date: z.string().default(''),
});
const SystemReq = z.object({ system: z.string(), requisite: z.string() });
const AccessRow = z.object({
  system: z.string(),
  detail: z.string().default(''),
  level: z.string().default(''),
  method: z.string().default(''),
});
const ItemDesc = z.object({ item: z.string(), desc: z.string() });
const ProcessRow = z.object({
  name: z.string(),
  folderPath: z.string().default(''),
  description: z.string().default(''),
});
const TriggerRow = z.object({
  process: z.string(),
  type: z.string().default(''),
  recurrence: z.string().default(''),
  folderPath: z.string().default(''),
  notes: z.string().default(''),
});
const QueueRow = z.object({
  name: z.string(),
  folderPath: z.string().default(''),
  details: z.string().default(''),
});
const ModuleRow = z.object({
  name: z.string(),
  parent: z.string().default(''),
  arguments: z.string().default(''),
  reusable: z.string().default(''),
  folderPath: z.string().default(''),
  description: z.string().default(''),
});
const ExceptionRow = z.object({
  code: z.string(),
  detail: z.string(),
  type: z.string(), // Business | System | Application
  botAction: z.string().default(''),
  notification: z.string().default(''),
});
const LibraryRow = z.object({
  name: z.string(),
  version: z.string().default(''),
  purpose: z.string().default(''),
});
const GlossaryRow = z.object({ term: z.string(), definition: z.string() });

export const TestScenarioSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['positive', 'negative', 'exception']),
  preconditions: z.string().default(''),
  steps: z.array(z.string()).default([]),
  testData: z.string().default(''),
  expectedResult: z.string(),
  tracesTo: z.string().optional(),
  /** For a multi-project solution: which project this test belongs to (drives a
   * separate Excel sheet per process). Empty for a single-process solution. */
  project: z.string().optional(),
});
export type TestScenario = z.infer<typeof TestScenarioSchema>;

export const SddModelSchema = z.object({
  projectName: z.string(),
  platformLabel: z.string(),
  /** 1 – Purpose / Introduction (narrative). */
  purpose: z.string(),
  /** 3.1 – Process overview summary (narrative). */
  summary: z.string(),
  /** 2.1 – Architectural structure: a short 1-2 sentence intro. */
  architecture: z.string().default(''),
  /**
   * Architectural structure broken into labelled points (Pattern, Components,
   * Data flow, Integrations, Configuration, Error handling, Scalability) so the
   * section reads as structured bullets instead of one wall of text.
   */
  architecturePoints: z.array(z.object({ aspect: z.string(), detail: z.string() })).default([]),
  /**
   * The main business steps of the process, in execution order — drives the
   * "High level process flow diagram". Short imperative phrases (business, not
   * framework plumbing), e.g. "Log in to System1", "Calculate SHA1 hash".
   */
  highLevelSteps: z.array(z.string()).default([]),
  /**
   * For a multi-project solution (e.g. Dispatcher / Performer / Reporter): the
   * high-level business steps of EACH project, so the SDD renders one high-level
   * flow diagram per project. Empty for a single-project solution.
   */
  projectFlows: z
    .array(
      z.object({
        project: z.string(),
        steps: z.array(z.string()).default([]),
        // Whether this project's ACTUAL layout is REFramework (state swimlane) or
        // a plain flowchart/sequence. Set from the project graph, not the LLM.
        reframework: z.boolean().optional(),
        // The project's REAL parsed StateMachine, when it has one — drives a
        // code-derived state diagram for that project. Set from the graph.
        stateMachine: z.any().optional(),
      })
    )
    .default([]),
  /**
   * For a REFramework state-machine project: the real BUSINESS sub-steps of each
   * state (Initialization / Get Transaction Data / Process Transaction / End
   * Process), so each swimlane lane shows what the state actually does — "Read
   * config workbook", "Retrieve Orchestrator assets", "Log in to <app>" — instead
   * of just the invoked workflow file names. Filled by the analyzer from each
   * state's real activities + applications. Empty for non-REFramework projects.
   */
  stateFlows: z
    .array(z.object({ state: z.string(), steps: z.array(z.string()).default([]) }))
    .default([]),

  revisions: z.array(Revision).default([]),
  contacts: z.array(Contact).default([]),
  sourceDocuments: z.array(SourceDoc).default([]),

  systemsPrereq: z.array(SystemReq).default([]),
  accessSettings: z.array(AccessRow).default([]),
  robotInfo: z.array(ItemDesc).default([]),
  processes: z.array(ProcessRow).default([]),
  triggers: z.array(TriggerRow).default([]),
  queues: z.array(QueueRow).default([]),

  designSpecifications: z.string().default(''),
  orchestratorFolders: z.string().default(''),
  orchestratorAssets: z.array(ItemDesc).default([]),
  /** Representative JSON of an Orchestrator queue item (from Add/Bulk Add Queue Item). */
  queueItemJson: z.string().default(''),

  designConsiderations: z.string().default(''),
  namingConventions: z.array(z.string()).default([]),
  modules: z.array(ModuleRow).default([]),
  reporting: z.string().default(''),
  folderStructure: z.string().default(''),

  processRuns: z.string().default(''),
  exceptions: z.array(ExceptionRow).default([]),
  debuggingTips: z.string().default(''),
  optimizations: z.string().default(''),
  codeReview: z.string().default(''),
  dependencies: z.array(LibraryRow).default([]),
  externalLibraries: z.array(LibraryRow).default([]),
  futureImprovements: z.array(z.string()).default([]),
  complianceItems: z.array(ItemDesc).default([]),
  dataSecurity: z.string().default(''),

  glossary: z.array(GlossaryRow).default([]),

  /** UAT test scenarios — drive the separate Test Case (Excel) deliverable. */
  testScenarios: z.array(TestScenarioSchema).default([]),
});

export type SddModel = z.infer<typeof SddModelSchema>;
export type SddModule = z.infer<typeof ModuleRow>;
export type SddException = z.infer<typeof ExceptionRow>;
