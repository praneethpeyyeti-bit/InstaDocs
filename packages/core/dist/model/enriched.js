"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnrichedModelSchema = exports.TestScenarioSchema = exports.ExceptionItemSchema = exports.IoItemSchema = exports.BusinessRuleSchema = exports.ProcessStepSchema = void 0;
/**
 * EnrichedModel — the output of the analyze stage.
 *
 * The deterministic parser gives us structure (ProcessGraph); the LLM Gateway
 * pass turns that into human-readable, business-level content: narrative,
 * ordered steps, inferred rules, I/O, exceptions and candidate test scenarios.
 *
 * The zod schema is the contract we force the LLM to satisfy — its JSON
 * response is validated against `EnrichedModelSchema` and retried/repaired on
 * mismatch, so downstream generators always receive well-formed data.
 */
const zod_1 = require("zod");
exports.ProcessStepSchema = zod_1.z.object({
    order: zod_1.z.number().int().positive(),
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    /** Systems/applications touched in this step (e.g. "SAP", "Outlook"). */
    systems: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.BusinessRuleSchema = zod_1.z.object({
    id: zod_1.z.string(), // e.g. "BR-01"
    description: zod_1.z.string(),
    /** Where in the process the rule applies (step title or node reference). */
    appliesTo: zod_1.z.string().optional(),
});
exports.IoItemSchema = zod_1.z.object({
    name: zod_1.z.string(),
    description: zod_1.z.string(),
    type: zod_1.z.string().optional(),
    source: zod_1.z.string().optional(), // where it comes from / goes to
});
exports.ExceptionItemSchema = zod_1.z.object({
    name: zod_1.z.string(),
    category: zod_1.z.enum(['business', 'system']),
    trigger: zod_1.z.string(),
    handling: zod_1.z.string(),
});
exports.TestScenarioSchema = zod_1.z.object({
    id: zod_1.z.string(), // e.g. "TC-01"
    title: zod_1.z.string(),
    type: zod_1.z.enum(['positive', 'negative', 'exception']),
    preconditions: zod_1.z.string().default(''),
    steps: zod_1.z.array(zod_1.z.string()).default([]),
    testData: zod_1.z.string().default(''),
    expectedResult: zod_1.z.string(),
    /** Traceability back to a process step or business rule. */
    tracesTo: zod_1.z.string().optional(),
});
exports.EnrichedModelSchema = zod_1.z.object({
    projectName: zod_1.z.string(),
    platformLabel: zod_1.z.string(),
    summary: zod_1.z.string(),
    businessObjective: zod_1.z.string(),
    applications: zod_1.z.array(zod_1.z.string()).default([]),
    steps: zod_1.z.array(exports.ProcessStepSchema).default([]),
    businessRules: zod_1.z.array(exports.BusinessRuleSchema).default([]),
    inputs: zod_1.z.array(exports.IoItemSchema).default([]),
    outputs: zod_1.z.array(exports.IoItemSchema).default([]),
    exceptions: zod_1.z.array(exports.ExceptionItemSchema).default([]),
    assumptions: zod_1.z.array(zod_1.z.string()).default([]),
    inScope: zod_1.z.array(zod_1.z.string()).default([]),
    outOfScope: zod_1.z.array(zod_1.z.string()).default([]),
    testScenarios: zod_1.z.array(exports.TestScenarioSchema).default([]),
});
//# sourceMappingURL=enriched.js.map