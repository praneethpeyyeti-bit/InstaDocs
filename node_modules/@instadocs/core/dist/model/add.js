"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddModelSchema = void 0;
/**
 * AddModel — the analyze-stage output for an Agentic (Solution) Design Document.
 *
 * It maps 1:1 to the sections of the branded ADD template
 * (`Templates/ADD.docx`). The deterministic parser gives the AgentSpec +
 * discovery context; the LLM Gateway pass turns that into the technical agentic
 * design content: role, tools, model config, guardrails, evaluation, deployment,
 * operations, compliance and NFRs.
 *
 * Anti-fabrication: sections with no derivable evidence must be filled with
 * "To be provided by SME" rather than invented content.
 */
const zod_1 = require("zod");
const sdd_1 = require("./sdd");
const VersionRow = zod_1.z.object({
    version: zod_1.z.string(),
    description: zod_1.z.string().default(''),
    status: zod_1.z.string().default(''),
    changedBy: zod_1.z.string().default(''),
    approvedBy: zod_1.z.string().default(''),
    date: zod_1.z.string().default(''),
});
const SignOffRow = zod_1.z.object({
    role: zod_1.z.string(),
    nameEmail: zod_1.z.string().default('To be completed by SME'),
    department: zod_1.z.string().default('To be completed by SME'),
    signature: zod_1.z.string().default(''),
    date: zod_1.z.string().default(''),
});
const Abbreviation = zod_1.z.object({
    term: zod_1.z.string(),
    description: zod_1.z.string().default(''),
    remarks: zod_1.z.string().default(''),
});
exports.AddModelSchema = zod_1.z.object({
    projectName: zod_1.z.string(),
    agentName: zod_1.z.string().default(''),
    platformLabel: zod_1.z.string().default('UiPath'),
    // 1 / 2 — control tables.
    versionHistory: zod_1.z.array(VersionRow).default([]),
    signOff: zod_1.z.array(SignOffRow).default([]),
    // 3 — Introduction.
    introOverview: zod_1.z.string().default(''),
    purposeScope: zod_1.z.string().default(''),
    objectives: zod_1.z.string().default(''),
    constraintsAssumptions: zod_1.z.string().default(''),
    // 4 — Architecture Overview.
    architectureOverview: zod_1.z.string().default(''),
    agenticEcosystem: zod_1.z.string().default(''),
    highLevelFlow: zod_1.z.string().default(''),
    // 5 — Agent Design Specification.
    designSpecOverview: zod_1.z.string().default(''),
    agentRoleGoals: zod_1.z.string().default(''),
    ioSchema: zod_1.z.string().default(''),
    toolsIntegrations: zod_1.z.string().default(''),
    contextKnowledge: zod_1.z.string().default(''),
    humanInLoop: zod_1.z.string().default(''),
    // 6 — Model Selection & Configuration.
    modelConfigOverview: zod_1.z.string().default(''),
    llmModels: zod_1.z.string().default(''),
    guardrails: zod_1.z.string().default(''),
    evaluationSettings: zod_1.z.string().default(''),
    // 7 — Development & Build Process.
    devOverview: zod_1.z.string().default(''),
    studioWebOverview: zod_1.z.string().default(''),
    workspacePanels: zod_1.z.string().default(''),
    testingPlayground: zod_1.z.string().default(''),
    // 8 — Evaluation & Optimization.
    evalOverview: zod_1.z.string().default(''),
    evalSets: zod_1.z.string().default(''),
    agentScoring: zod_1.z.string().default(''),
    autopilot: zod_1.z.string().default(''),
    monitoringTracing: zod_1.z.string().default(''),
    // 9 — Deployment Strategy.
    deployOverview: zod_1.z.string().default(''),
    environments: zod_1.z.string().default(''),
    maestroIntegration: zod_1.z.string().default(''),
    securityGovernance: zod_1.z.string().default(''),
    // 10 — Operational Management.
    opsOverview: zod_1.z.string().default(''),
    monitoringHealth: zod_1.z.string().default(''),
    selfHealing: zod_1.z.string().default(''),
    versioningUpdates: zod_1.z.string().default(''),
    // 11 — Compliance, Risk & Security.
    complianceOverview: zod_1.z.string().default(''),
    dataResidency: zod_1.z.string().default(''),
    trustLayer: zod_1.z.string().default(''),
    escalationControls: zod_1.z.string().default(''),
    // 12 — Non-functional Requirements.
    nfrOverview: zod_1.z.string().default(''),
    performance: zod_1.z.string().default(''),
    scalability: zod_1.z.string().default(''),
    reliability: zod_1.z.string().default(''),
    maintainability: zod_1.z.string().default(''),
    usability: zod_1.z.string().default(''),
    // 13 / 14 / 15 — References, Appendix, Abbreviations.
    references: zod_1.z.array(zod_1.z.string()).default([]),
    appendix: zod_1.z.string().default(''),
    abbreviations: zod_1.z.array(Abbreviation).default([]),
    /** Evaluation / UAT scenarios — drive the Test Case (Excel) deliverable. */
    testScenarios: zod_1.z.array(sdd_1.TestScenarioSchema).default([]),
});
//# sourceMappingURL=add.js.map