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
import { z } from 'zod';
export declare const ProcessStepSchema: z.ZodObject<{
    order: z.ZodNumber;
    title: z.ZodString;
    description: z.ZodString;
    /** Systems/applications touched in this step (e.g. "SAP", "Outlook"). */
    systems: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    order: number;
    title: string;
    description: string;
    systems: string[];
}, {
    order: number;
    title: string;
    description: string;
    systems?: string[] | undefined;
}>;
export declare const BusinessRuleSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    /** Where in the process the rule applies (step title or node reference). */
    appliesTo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    id: string;
    appliesTo?: string | undefined;
}, {
    description: string;
    id: string;
    appliesTo?: string | undefined;
}>;
export declare const IoItemSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    type: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    type?: string | undefined;
    source?: string | undefined;
}, {
    name: string;
    description: string;
    type?: string | undefined;
    source?: string | undefined;
}>;
export declare const ExceptionItemSchema: z.ZodObject<{
    name: z.ZodString;
    category: z.ZodEnum<["business", "system"]>;
    trigger: z.ZodString;
    handling: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    category: "business" | "system";
    trigger: string;
    handling: string;
}, {
    name: string;
    category: "business" | "system";
    trigger: string;
    handling: string;
}>;
export declare const TestScenarioSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<["positive", "negative", "exception"]>;
    preconditions: z.ZodDefault<z.ZodString>;
    steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    testData: z.ZodDefault<z.ZodString>;
    expectedResult: z.ZodString;
    /** Traceability back to a process step or business rule. */
    tracesTo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "positive" | "negative" | "exception";
    title: string;
    id: string;
    preconditions: string;
    steps: string[];
    testData: string;
    expectedResult: string;
    tracesTo?: string | undefined;
}, {
    type: "positive" | "negative" | "exception";
    title: string;
    id: string;
    expectedResult: string;
    preconditions?: string | undefined;
    steps?: string[] | undefined;
    testData?: string | undefined;
    tracesTo?: string | undefined;
}>;
export declare const EnrichedModelSchema: z.ZodObject<{
    projectName: z.ZodString;
    platformLabel: z.ZodString;
    summary: z.ZodString;
    businessObjective: z.ZodString;
    applications: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    steps: z.ZodDefault<z.ZodArray<z.ZodObject<{
        order: z.ZodNumber;
        title: z.ZodString;
        description: z.ZodString;
        /** Systems/applications touched in this step (e.g. "SAP", "Outlook"). */
        systems: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        order: number;
        title: string;
        description: string;
        systems: string[];
    }, {
        order: number;
        title: string;
        description: string;
        systems?: string[] | undefined;
    }>, "many">>;
    businessRules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        /** Where in the process the rule applies (step title or node reference). */
        appliesTo: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        id: string;
        appliesTo?: string | undefined;
    }, {
        description: string;
        id: string;
        appliesTo?: string | undefined;
    }>, "many">>;
    inputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        source: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        type?: string | undefined;
        source?: string | undefined;
    }, {
        name: string;
        description: string;
        type?: string | undefined;
        source?: string | undefined;
    }>, "many">>;
    outputs: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        type: z.ZodOptional<z.ZodString>;
        source: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        type?: string | undefined;
        source?: string | undefined;
    }, {
        name: string;
        description: string;
        type?: string | undefined;
        source?: string | undefined;
    }>, "many">>;
    exceptions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        category: z.ZodEnum<["business", "system"]>;
        trigger: z.ZodString;
        handling: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        category: "business" | "system";
        trigger: string;
        handling: string;
    }, {
        name: string;
        category: "business" | "system";
        trigger: string;
        handling: string;
    }>, "many">>;
    assumptions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    inScope: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    outOfScope: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    testScenarios: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        type: z.ZodEnum<["positive", "negative", "exception"]>;
        preconditions: z.ZodDefault<z.ZodString>;
        steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        testData: z.ZodDefault<z.ZodString>;
        expectedResult: z.ZodString;
        /** Traceability back to a process step or business rule. */
        tracesTo: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "positive" | "negative" | "exception";
        title: string;
        id: string;
        preconditions: string;
        steps: string[];
        testData: string;
        expectedResult: string;
        tracesTo?: string | undefined;
    }, {
        type: "positive" | "negative" | "exception";
        title: string;
        id: string;
        expectedResult: string;
        preconditions?: string | undefined;
        steps?: string[] | undefined;
        testData?: string | undefined;
        tracesTo?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    steps: {
        order: number;
        title: string;
        description: string;
        systems: string[];
    }[];
    projectName: string;
    platformLabel: string;
    summary: string;
    businessObjective: string;
    applications: string[];
    businessRules: {
        description: string;
        id: string;
        appliesTo?: string | undefined;
    }[];
    inputs: {
        name: string;
        description: string;
        type?: string | undefined;
        source?: string | undefined;
    }[];
    outputs: {
        name: string;
        description: string;
        type?: string | undefined;
        source?: string | undefined;
    }[];
    exceptions: {
        name: string;
        category: "business" | "system";
        trigger: string;
        handling: string;
    }[];
    assumptions: string[];
    inScope: string[];
    outOfScope: string[];
    testScenarios: {
        type: "positive" | "negative" | "exception";
        title: string;
        id: string;
        preconditions: string;
        steps: string[];
        testData: string;
        expectedResult: string;
        tracesTo?: string | undefined;
    }[];
}, {
    projectName: string;
    platformLabel: string;
    summary: string;
    businessObjective: string;
    steps?: {
        order: number;
        title: string;
        description: string;
        systems?: string[] | undefined;
    }[] | undefined;
    applications?: string[] | undefined;
    businessRules?: {
        description: string;
        id: string;
        appliesTo?: string | undefined;
    }[] | undefined;
    inputs?: {
        name: string;
        description: string;
        type?: string | undefined;
        source?: string | undefined;
    }[] | undefined;
    outputs?: {
        name: string;
        description: string;
        type?: string | undefined;
        source?: string | undefined;
    }[] | undefined;
    exceptions?: {
        name: string;
        category: "business" | "system";
        trigger: string;
        handling: string;
    }[] | undefined;
    assumptions?: string[] | undefined;
    inScope?: string[] | undefined;
    outOfScope?: string[] | undefined;
    testScenarios?: {
        type: "positive" | "negative" | "exception";
        title: string;
        id: string;
        expectedResult: string;
        preconditions?: string | undefined;
        steps?: string[] | undefined;
        testData?: string | undefined;
        tracesTo?: string | undefined;
    }[] | undefined;
}>;
export type ProcessStep = z.infer<typeof ProcessStepSchema>;
export type BusinessRule = z.infer<typeof BusinessRuleSchema>;
export type IoItem = z.infer<typeof IoItemSchema>;
export type ExceptionItem = z.infer<typeof ExceptionItemSchema>;
export type TestScenario = z.infer<typeof TestScenarioSchema>;
export type EnrichedModel = z.infer<typeof EnrichedModelSchema>;
