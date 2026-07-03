"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrich = enrich;
const ir_1 = require("../model/ir");
const enriched_1 = require("../model/enriched");
const gateway_1 = require("./gateway");
const compact_1 = require("./compact");
const fallback_1 = require("./fallback");
const SYSTEM_PROMPT = `You are a senior RPA business analyst writing a Process Design Document (PDD) for a BUSINESS audience (process owners, SMEs, managers) — NOT for developers.

You are given a normalized description of an automation (project-discovery context, arguments, variables, activity outline, invocations, exception handlers). Use it as EVIDENCE to understand what the process actually does, then WRITE ABOUT THE BUSINESS PROCESS — what it accomplishes and why — not the code.

Hard rules for the writing:
- Lead with the PROJECT CONTEXT (discovery) to establish the real business purpose; the activity list is supporting detail, not the story.
- DO NOT echo activity names, workflow file names, variable names, or technical verbs (Assign, HTTP Request, Invoke, Deserialize, For Each, Rethrow, Try/Catch). Translate everything into plain business language a non-technical reader understands.
- Synthesize: group the low-level activities into a SMALL set of meaningful business steps (aim for 8–16 ordered steps), each describing an outcome ("Sign in and obtain authorisation", "Create the test set", "Wait for the run to finish"), not a mechanical action.
- Business rules = the real decisions/policies the process enforces (matching, thresholds, retries, status handling), in plain terms — not raw code conditions.
- Inputs/outputs = process-level run data (request data, configuration, produced reports, logs) — NEVER list workflow arguments as I/O.
- Exceptions = business vs system, each with a plain-language trigger and how it is handled.
- Be concrete and grounded; do not invent systems, numbers, or steps not implied by the evidence. Where a metric is unknown, omit it rather than fabricate.

Respond with ONLY a single JSON object matching the provided schema. No markdown, no commentary.`;
/**
 * Enrich a ProcessGraph into an EnrichedModel.
 *
 * Hybrid strategy: the deterministic parser already gave us structure; here the
 * LLM Gateway writes the narrative and infers rules/exceptions. If no gateway
 * is configured, or every attempt fails schema validation, we fall back to a
 * deterministic model so the pipeline NEVER hard-fails during a demo.
 */
async function enrich(graph, options = {}) {
    const { gateway, maxRetries = 2, strict = false, onProgress } = options;
    if (!gateway) {
        if (strict) {
            throw new Error('LLM Gateway required (strict mode) but not configured. Set the Gateway URL, ' +
                'model, and a valid UiPath token (or sign in with `uip login`).');
        }
        onProgress?.('No LLM Gateway configured — using deterministic analysis.');
        return { model: (0, fallback_1.deterministicEnrich)(graph), usedLlm: false };
    }
    const compact = (0, compact_1.compactGraph)(graph);
    const userPrompt = buildUserPrompt(graph, compact);
    let lastErr;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            onProgress?.(`Calling UiPath LLM Gateway (attempt ${attempt})…`);
            const raw = await (0, gateway_1.chat)(gateway, [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userPrompt },
                { role: 'user', content: `JSON Schema (informal): ${SCHEMA_HINT}` },
            ]);
            const json = extractJson(raw);
            const model = enriched_1.EnrichedModelSchema.parse(json);
            // Ensure identity fields are always present/correct.
            model.projectName ||= graph.projectName;
            model.platformLabel ||= ir_1.PLATFORM_LABELS[graph.platform];
            return { model, usedLlm: true };
        }
        catch (err) {
            lastErr = err;
            onProgress?.(`Attempt ${attempt} failed: ${err.message}`);
        }
    }
    if (strict) {
        throw new Error(`LLM Gateway enrichment failed after ${maxRetries + 1} attempt(s): ${lastErr?.message ?? lastErr}`);
    }
    onProgress?.('LLM enrichment failed — falling back to deterministic analysis.');
    void lastErr;
    return { model: (0, fallback_1.deterministicEnrich)(graph), usedLlm: false };
}
function buildUserPrompt(graph, compact) {
    return [
        `Project: ${graph.projectName}`,
        `Platform: ${ir_1.PLATFORM_LABELS[graph.platform]}`,
        `Entry points: ${graph.entryPoints.join(', ') || '(unknown)'}`,
        '',
        'EVIDENCE (project-discovery context + normalized workflow). Read it to understand the',
        'business process, then write the PDD in business language per the rules. Remember: the',
        'reader is a business stakeholder, so explain WHAT the process achieves and WHY, and do',
        'not reproduce the activity/workflow/variable names below verbatim.',
        '',
        compact,
    ].join('\n');
}
/** Pull the first JSON object out of an LLM response, tolerating stray text. */
function extractJson(raw) {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    }
    catch {
        const start = trimmed.indexOf('{');
        const end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return JSON.parse(trimmed.slice(start, end + 1));
        }
        throw new Error('Response did not contain valid JSON.');
    }
}
const SCHEMA_HINT = [
    'projectName:string, platformLabel:string, summary:string, businessObjective:string,',
    'applications:string[], steps:[{order:int,title,description,systems:string[]}],',
    'businessRules:[{id,description,appliesTo?}], inputs/outputs:[{name,description,type?,source?}],',
    'exceptions:[{name,category:"business"|"system",trigger,handling}], assumptions:string[],',
    'inScope:string[], outOfScope:string[],',
    'testScenarios:[{id,title,type:"positive"|"negative"|"exception",preconditions,steps:string[],testData,expectedResult,tracesTo?}]',
].join(' ');
//# sourceMappingURL=enrich.js.map