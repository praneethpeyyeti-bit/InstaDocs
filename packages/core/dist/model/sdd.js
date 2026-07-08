"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SddModelSchema = exports.TestScenarioSchema = void 0;
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
const zod_1 = require("zod");
const Revision = zod_1.z.object({
    rev: zod_1.z.string(),
    date: zod_1.z.string(),
    role: zod_1.z.string(),
    summary: zod_1.z.string(),
    author: zod_1.z.string(),
});
const Contact = zod_1.z.object({
    role: zod_1.z.string(),
    name: zod_1.z.string().default(''),
    email: zod_1.z.string().default(''),
    org: zod_1.z.string().default(''),
});
const SourceDoc = zod_1.z.object({
    title: zod_1.z.string(),
    author: zod_1.z.string().default(''),
    version: zod_1.z.string().default(''),
    date: zod_1.z.string().default(''),
});
const SystemReq = zod_1.z.object({ system: zod_1.z.string(), requisite: zod_1.z.string() });
const AccessRow = zod_1.z.object({
    system: zod_1.z.string(),
    detail: zod_1.z.string().default(''),
    level: zod_1.z.string().default(''),
    method: zod_1.z.string().default(''),
});
const ItemDesc = zod_1.z.object({ item: zod_1.z.string(), desc: zod_1.z.string() });
const ProcessRow = zod_1.z.object({
    name: zod_1.z.string(),
    folderPath: zod_1.z.string().default(''),
    description: zod_1.z.string().default(''),
});
const TriggerRow = zod_1.z.object({
    process: zod_1.z.string(),
    type: zod_1.z.string().default(''),
    recurrence: zod_1.z.string().default(''),
    folderPath: zod_1.z.string().default(''),
    notes: zod_1.z.string().default(''),
});
const QueueRow = zod_1.z.object({
    name: zod_1.z.string(),
    folderPath: zod_1.z.string().default(''),
    details: zod_1.z.string().default(''),
});
const ModuleRow = zod_1.z.object({
    name: zod_1.z.string(),
    parent: zod_1.z.string().default(''),
    arguments: zod_1.z.string().default(''),
    reusable: zod_1.z.string().default(''),
    folderPath: zod_1.z.string().default(''),
    description: zod_1.z.string().default(''),
});
const ExceptionRow = zod_1.z.object({
    code: zod_1.z.string(),
    detail: zod_1.z.string(),
    type: zod_1.z.string(), // Business | System | Application
    botAction: zod_1.z.string().default(''),
    notification: zod_1.z.string().default(''),
});
const LibraryRow = zod_1.z.object({
    name: zod_1.z.string(),
    version: zod_1.z.string().default(''),
    purpose: zod_1.z.string().default(''),
});
const GlossaryRow = zod_1.z.object({ term: zod_1.z.string(), definition: zod_1.z.string() });
exports.TestScenarioSchema = zod_1.z.object({
    id: zod_1.z.string(),
    title: zod_1.z.string(),
    type: zod_1.z.enum(['positive', 'negative', 'exception']),
    preconditions: zod_1.z.string().default(''),
    steps: zod_1.z.array(zod_1.z.string()).default([]),
    testData: zod_1.z.string().default(''),
    expectedResult: zod_1.z.string(),
    tracesTo: zod_1.z.string().optional(),
    /** For a multi-project solution: which project this test belongs to (drives a
     * separate Excel sheet per process). Empty for a single-process solution. */
    project: zod_1.z.string().optional(),
});
exports.SddModelSchema = zod_1.z.object({
    projectName: zod_1.z.string(),
    platformLabel: zod_1.z.string(),
    /** 1 – Purpose / Introduction (narrative). */
    purpose: zod_1.z.string(),
    /** 3.1 – Process overview summary (narrative). */
    summary: zod_1.z.string(),
    /** 2.1 – Architectural structure: a short 1-2 sentence intro. */
    architecture: zod_1.z.string().default(''),
    /**
     * Architectural structure broken into labelled points (Pattern, Components,
     * Data flow, Integrations, Configuration, Error handling, Scalability) so the
     * section reads as structured bullets instead of one wall of text.
     */
    architecturePoints: zod_1.z.array(zod_1.z.object({ aspect: zod_1.z.string(), detail: zod_1.z.string() })).default([]),
    /**
     * The main business steps of the process, in execution order — drives the
     * "High level process flow diagram". Short imperative phrases (business, not
     * framework plumbing), e.g. "Log in to System1", "Calculate SHA1 hash".
     */
    highLevelSteps: zod_1.z.array(zod_1.z.string()).default([]),
    /**
     * For a multi-project solution (e.g. Dispatcher / Performer / Reporter): the
     * high-level business steps of EACH project, so the SDD renders one high-level
     * flow diagram per project. Empty for a single-project solution.
     */
    projectFlows: zod_1.z
        .array(zod_1.z.object({
        project: zod_1.z.string(),
        steps: zod_1.z.array(zod_1.z.string()).default([]),
        // Whether this project's ACTUAL layout is REFramework (state swimlane) or
        // a plain flowchart/sequence. Set from the project graph, not the LLM.
        reframework: zod_1.z.boolean().optional(),
        // The project's REAL parsed StateMachine, when it has one — drives a
        // code-derived state diagram for that project. Set from the graph.
        stateMachine: zod_1.z.any().optional(),
    }))
        .default([]),
    /**
     * For a REFramework state-machine project: the real BUSINESS sub-steps of each
     * state (Initialization / Get Transaction Data / Process Transaction / End
     * Process), so each swimlane lane shows what the state actually does — "Read
     * config workbook", "Retrieve Orchestrator assets", "Log in to <app>" — instead
     * of just the invoked workflow file names. Filled by the analyzer from each
     * state's real activities + applications. Empty for non-REFramework projects.
     */
    stateFlows: zod_1.z
        .array(zod_1.z.object({ state: zod_1.z.string(), steps: zod_1.z.array(zod_1.z.string()).default([]) }))
        .default([]),
    revisions: zod_1.z.array(Revision).default([]),
    contacts: zod_1.z.array(Contact).default([]),
    sourceDocuments: zod_1.z.array(SourceDoc).default([]),
    systemsPrereq: zod_1.z.array(SystemReq).default([]),
    accessSettings: zod_1.z.array(AccessRow).default([]),
    robotInfo: zod_1.z.array(ItemDesc).default([]),
    processes: zod_1.z.array(ProcessRow).default([]),
    triggers: zod_1.z.array(TriggerRow).default([]),
    queues: zod_1.z.array(QueueRow).default([]),
    designSpecifications: zod_1.z.string().default(''),
    orchestratorFolders: zod_1.z.string().default(''),
    orchestratorAssets: zod_1.z.array(ItemDesc).default([]),
    /** Representative JSON of an Orchestrator queue item (from Add/Bulk Add Queue Item). */
    queueItemJson: zod_1.z.string().default(''),
    designConsiderations: zod_1.z.string().default(''),
    namingConventions: zod_1.z.array(zod_1.z.string()).default([]),
    modules: zod_1.z.array(ModuleRow).default([]),
    reporting: zod_1.z.string().default(''),
    folderStructure: zod_1.z.string().default(''),
    processRuns: zod_1.z.string().default(''),
    exceptions: zod_1.z.array(ExceptionRow).default([]),
    debuggingTips: zod_1.z.string().default(''),
    optimizations: zod_1.z.string().default(''),
    codeReview: zod_1.z.string().default(''),
    dependencies: zod_1.z.array(LibraryRow).default([]),
    externalLibraries: zod_1.z.array(LibraryRow).default([]),
    futureImprovements: zod_1.z.array(zod_1.z.string()).default([]),
    complianceItems: zod_1.z.array(ItemDesc).default([]),
    dataSecurity: zod_1.z.string().default(''),
    glossary: zod_1.z.array(GlossaryRow).default([]),
    /** UAT test scenarios — drive the separate Test Case (Excel) deliverable. */
    testScenarios: zod_1.z.array(exports.TestScenarioSchema).default([]),
});
//# sourceMappingURL=sdd.js.map