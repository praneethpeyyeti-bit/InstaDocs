"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichAdd = enrichAdd;
const ir_1 = require("../model/ir");
const add_1 = require("../model/add");
const gateway_1 = require("./gateway");
const compact_1 = require("./compact");
const uipathSession_1 = require("./uipathSession");
const SYSTEM_PROMPT = `You are a senior UiPath AI/agentic solution architect writing an Agentic (Solution) Design Document (ADD/ASDD) — the technical design record for an AI Agent built on the UiPath Platform (Agent Builder, Studio Web, Maestro, AI Trust Layer, Orchestrator), aimed at developers, architects, MLOps and governance reviewers.

You are given EVIDENCE about a UiPath AI Agent: a parsed agent spec (name, prompts, model, tools, inputs/outputs, knowledge/context sources, escalations, guardrails), a project-discovery context when present, and any surrounding workflow outline. Use it to describe the agentic SOLUTION DESIGN accurately and concretely.

Fill every section from the evidence. Be technical and specific: name the real agent, its actual system/user prompts (paraphrase, don't dump verbatim), the real model, the real tools/integrations, the real inputs/outputs, real knowledge sources and escalations. Where something is genuinely NOT derivable from the evidence (e.g. a production schedule, a person's email, an SLA target, data-residency region, evaluation metrics not defined in the project), write exactly "To be provided by SME" — do NOT invent models, providers, metrics, policies, or numbers.

Guidance per field (all are prose strings unless noted):
- introOverview: 2-4 sentences introducing this specific agent solution and why it exists.
- purposeScope: what the agent achieves and its boundaries (in/out of scope).
- objectives: measurable goals (efficiency, coverage, accuracy, AHT) if implied by the agent's purpose; else "To be provided by SME".
- constraintsAssumptions: model/provider availability, permissions, rate limits, data availability, integration readiness — grounded in the evidence.
- architectureOverview: how the agent fits the UiPath agentic architecture (LLM + tools + orchestration).
- agenticEcosystem: how the agent interacts with RPA bots, humans, APIs and orchestration (Maestro/Orchestrator).
- highLevelFlow: a short textual walkthrough of the agent lifecycle (intent → reason → tool calls → escalation → output). A diagram is rendered separately from the evidence.
- designSpecOverview: how the agent is configured overall.
- agentRoleGoals: the agent's role, allowed behaviours and real-world goals (from the system prompt).
- ioSchema: the structured inputs the agent accepts and the output format it returns (from parsed inputs/outputs).
- toolsIntegrations: each tool/integration/RPA-or-API workflow the agent can call, with its purpose.
- contextKnowledge: memory, grounding data, context-grounding indexes used.
- humanInLoop: escalation/HITL and fallback behaviour (from parsed escalations).
- modelConfigOverview: overview of model selection and configuration.
- llmModels: the LLM provider + model version + settings (temperature, max tokens) actually configured.
- guardrails: safety/ethical constraints and Trust Layer settings observed; else "To be provided by SME".
- evaluationSettings: how responses are evaluated (JSON schema / LLM-judge) if defined; else "To be provided by SME".
- devOverview/studioWebOverview/workspacePanels/testingPlayground: how the agent is/was built and tested in Agent Builder/Studio Web (describe realistically for this agent; mark unknowns).
- evalOverview/evalSets/agentScoring/autopilot/monitoringTracing: evaluation & optimization approach; mark unknowns as SME.
- deployOverview/environments/maestroIntegration/securityGovernance: deployment across Dev/QA/Prod, Maestro routing, permission model — mark unknowns as SME.
- opsOverview/monitoringHealth/selfHealing/versioningUpdates: run-time operations & maintenance.
- complianceOverview/dataResidency/trustLayer/escalationControls: risk, privacy, Trust Layer policies, human-safety thresholds — note real findings (e.g. PII in prompts) as facts; mark unknowns as SME.
- nfrOverview/performance/scalability/reliability/maintainability/usability: NFRs; mark unknown targets as "To be provided by SME".
- references: list of relevant UiPath docs / sources (short strings).
- appendix: any embeddings/payload schemas/integration configs worth referencing; else "To be provided by SME".
- versionHistory: at least one row [{version:"0.1",description:"Initial draft auto-generated from source",status:"Draft",changedBy:"InstaDocs",approvedBy:"",date:""}].
- signOff: standard stakeholder rows [{role:"Process Owner"},{role:"Solution Architect"},{role:"Technical Lead"}] with nameEmail/department = "To be completed by SME".
- abbreviations: key terms/acronyms used [{term,description,remarks}] (include AI/RPA/LLM/HITL/ADD and any domain terms).
- testScenarios: evaluation/UAT scenarios covering the happy path, each tool/branch, and each escalation/guardrail (id like TC-01, title, type positive/negative/exception, preconditions, steps[], testData, expectedResult, tracesTo).

Respond with ONLY a single JSON object matching the schema. No markdown, no commentary.`;
const SCHEMA_HINT = [
    'projectName, agentName, platformLabel,',
    'versionHistory:[{version,description,status,changedBy,approvedBy,date}], signOff:[{role,nameEmail,department,signature,date}],',
    'introOverview, purposeScope, objectives, constraintsAssumptions,',
    'architectureOverview, agenticEcosystem, highLevelFlow,',
    'designSpecOverview, agentRoleGoals, ioSchema, toolsIntegrations, contextKnowledge, humanInLoop,',
    'modelConfigOverview, llmModels, guardrails, evaluationSettings,',
    'devOverview, studioWebOverview, workspacePanels, testingPlayground,',
    'evalOverview, evalSets, agentScoring, autopilot, monitoringTracing,',
    'deployOverview, environments, maestroIntegration, securityGovernance,',
    'opsOverview, monitoringHealth, selfHealing, versioningUpdates,',
    'complianceOverview, dataResidency, trustLayer, escalationControls,',
    'nfrOverview, performance, scalability, reliability, maintainability, usability,',
    'references:[string], appendix, abbreviations:[{term,description,remarks}],',
    'testScenarios:[{id,title,type:"positive"|"negative"|"exception",preconditions,steps:[string],testData,expectedResult,tracesTo}]',
].join(' ');
/**
 * Enrich a ProcessGraph (carrying an AgentSpec) into an AddModel via the LLM
 * Gateway. LLM-only — no deterministic fallback: if the Gateway is unavailable
 * or every attempt fails, this throws so the caller surfaces the error.
 */
async function enrichAdd(graph, options = {}) {
    const { gateway, maxRetries = 2, onProgress } = options;
    if (!gateway) {
        throw new Error('InstaDocs requires the UiPath LLM Gateway (no deterministic mode). ' +
            'Run `uip login` (staging: `uip login --authority https://staging.uipath.com --organization <org> --tenant <tenant>`) or set INSTADOCS_GATEWAY_URL/TOKEN.');
    }
    const compact = (0, compact_1.compactGraph)(graph);
    const userPrompt = [
        `Project: ${graph.projectName}`,
        `Agent: ${graph.agent?.name ?? graph.projectName}`,
        `Platform: ${ir_1.PLATFORM_LABELS[graph.platform]} (Agentic)`,
        `Entry points: ${graph.entryPoints.join(', ') || '(unknown)'}`,
        '',
        'EVIDENCE (agent spec + project-discovery context + normalized workflow):',
        compact,
        '',
        'Write the Agentic Design Document JSON now, technical and grounded in the evidence.',
    ].join('\n');
    let lastErr;
    let token = gateway.token;
    let refreshedOnce = false;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            onProgress?.(`Calling UiPath LLM Gateway (attempt ${attempt})…`);
            const raw = await (0, gateway_1.chat)({ ...gateway, token }, [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
                { role: 'user', content: `JSON Schema (informal): ${SCHEMA_HINT}` },
            ]);
            const model = add_1.AddModelSchema.parse(extractJson(raw));
            model.projectName ||= graph.projectName;
            model.agentName ||= graph.agent?.name ?? graph.projectName;
            model.platformLabel ||= ir_1.PLATFORM_LABELS[graph.platform];
            backfill(model, graph);
            return { model, usedLlm: true };
        }
        catch (err) {
            lastErr = err;
            if (err instanceof gateway_1.GatewayError && err.status === 401 && !refreshedOnce) {
                refreshedOnce = true;
                onProgress?.('Access token expired — refreshing uip session…');
                const fresh = (0, uipathSession_1.refreshUiPathSession)();
                if (fresh?.token && fresh.token !== token) {
                    token = fresh.token;
                    attempt--;
                    continue;
                }
            }
            onProgress?.(`Attempt ${attempt} failed: ${err.message}`);
        }
    }
    throw new Error(`LLM Gateway enrichment failed after ${maxRetries + 1} attempt(s): ${lastErr?.message ?? lastErr}`);
}
/** Ensure the control tables always have at least the baseline structure. */
function backfill(model, graph) {
    if (!model.versionHistory.length) {
        model.versionHistory = [
            { version: '0.1', description: 'Initial draft auto-generated from source', status: 'Draft', changedBy: 'InstaDocs', approvedBy: '', date: '' },
        ];
    }
    if (!model.signOff.length) {
        model.signOff = ['Process Owner', 'Solution Architect', 'Technical Lead'].map((role) => ({
            role,
            nameEmail: 'To be completed by SME',
            department: 'To be completed by SME',
            signature: '',
            date: '',
        }));
    }
    void graph;
}
function extractJson(raw) {
    const t = raw.trim().replace(/^```[a-zA-Z]*\n?|\n?```$/g, '').trim();
    try {
        return JSON.parse(t);
    }
    catch {
        const s = t.indexOf('{');
        const e = t.lastIndexOf('}');
        if (s >= 0 && e > s)
            return JSON.parse(t.slice(s, e + 1));
        throw new Error('Response did not contain valid JSON.');
    }
}
//# sourceMappingURL=add.js.map