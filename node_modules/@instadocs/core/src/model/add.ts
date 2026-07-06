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
import { z } from 'zod';
import { TestScenarioSchema } from './sdd';

const VersionRow = z.object({
  version: z.string(),
  description: z.string().default(''),
  status: z.string().default(''),
  changedBy: z.string().default(''),
  approvedBy: z.string().default(''),
  date: z.string().default(''),
});

const SignOffRow = z.object({
  role: z.string(),
  nameEmail: z.string().default('To be completed by SME'),
  department: z.string().default('To be completed by SME'),
  signature: z.string().default(''),
  date: z.string().default(''),
});

const Abbreviation = z.object({
  term: z.string(),
  description: z.string().default(''),
  remarks: z.string().default(''),
});

export const AddModelSchema = z.object({
  projectName: z.string(),
  agentName: z.string().default(''),
  platformLabel: z.string().default('UiPath'),

  // 1 / 2 — control tables.
  versionHistory: z.array(VersionRow).default([]),
  signOff: z.array(SignOffRow).default([]),

  // 3 — Introduction.
  introOverview: z.string().default(''),
  purposeScope: z.string().default(''),
  objectives: z.string().default(''),
  constraintsAssumptions: z.string().default(''),

  // 4 — Architecture Overview.
  architectureOverview: z.string().default(''),
  agenticEcosystem: z.string().default(''),
  highLevelFlow: z.string().default(''),

  // 5 — Agent Design Specification.
  designSpecOverview: z.string().default(''),
  agentRoleGoals: z.string().default(''),
  ioSchema: z.string().default(''),
  toolsIntegrations: z.string().default(''),
  contextKnowledge: z.string().default(''),
  humanInLoop: z.string().default(''),

  // 6 — Model Selection & Configuration.
  modelConfigOverview: z.string().default(''),
  llmModels: z.string().default(''),
  guardrails: z.string().default(''),
  evaluationSettings: z.string().default(''),

  // 7 — Development & Build Process.
  devOverview: z.string().default(''),
  studioWebOverview: z.string().default(''),
  workspacePanels: z.string().default(''),
  testingPlayground: z.string().default(''),

  // 8 — Evaluation & Optimization.
  evalOverview: z.string().default(''),
  evalSets: z.string().default(''),
  agentScoring: z.string().default(''),
  autopilot: z.string().default(''),
  monitoringTracing: z.string().default(''),

  // 9 — Deployment Strategy.
  deployOverview: z.string().default(''),
  environments: z.string().default(''),
  maestroIntegration: z.string().default(''),
  securityGovernance: z.string().default(''),

  // 10 — Operational Management.
  opsOverview: z.string().default(''),
  monitoringHealth: z.string().default(''),
  selfHealing: z.string().default(''),
  versioningUpdates: z.string().default(''),

  // 11 — Compliance, Risk & Security.
  complianceOverview: z.string().default(''),
  dataResidency: z.string().default(''),
  trustLayer: z.string().default(''),
  escalationControls: z.string().default(''),

  // 12 — Non-functional Requirements.
  nfrOverview: z.string().default(''),
  performance: z.string().default(''),
  scalability: z.string().default(''),
  reliability: z.string().default(''),
  maintainability: z.string().default(''),
  usability: z.string().default(''),

  // 13 / 14 / 15 — References, Appendix, Abbreviations.
  references: z.array(z.string()).default([]),
  appendix: z.string().default(''),
  abbreviations: z.array(Abbreviation).default([]),

  /** Evaluation / UAT scenarios — drive the Test Case (Excel) deliverable. */
  testScenarios: z.array(TestScenarioSchema).default([]),
});

export type AddModel = z.infer<typeof AddModelSchema>;
export type AddVersionRow = z.infer<typeof VersionRow>;
export type AddSignOffRow = z.infer<typeof SignOffRow>;
export type AddAbbreviation = z.infer<typeof Abbreviation>;
