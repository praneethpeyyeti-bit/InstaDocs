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
declare const VersionRow: z.ZodObject<{
    version: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    status: z.ZodDefault<z.ZodString>;
    changedBy: z.ZodDefault<z.ZodString>;
    approvedBy: z.ZodDefault<z.ZodString>;
    date: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    date: string;
    status: string;
    version: string;
    changedBy: string;
    approvedBy: string;
}, {
    version: string;
    description?: string | undefined;
    date?: string | undefined;
    status?: string | undefined;
    changedBy?: string | undefined;
    approvedBy?: string | undefined;
}>;
declare const SignOffRow: z.ZodObject<{
    role: z.ZodString;
    nameEmail: z.ZodDefault<z.ZodString>;
    department: z.ZodDefault<z.ZodString>;
    signature: z.ZodDefault<z.ZodString>;
    date: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    role: string;
    date: string;
    nameEmail: string;
    department: string;
    signature: string;
}, {
    role: string;
    date?: string | undefined;
    nameEmail?: string | undefined;
    department?: string | undefined;
    signature?: string | undefined;
}>;
declare const Abbreviation: z.ZodObject<{
    term: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    remarks: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    term: string;
    remarks: string;
}, {
    term: string;
    description?: string | undefined;
    remarks?: string | undefined;
}>;
export declare const AddModelSchema: z.ZodObject<{
    projectName: z.ZodString;
    agentName: z.ZodDefault<z.ZodString>;
    platformLabel: z.ZodDefault<z.ZodString>;
    versionHistory: z.ZodDefault<z.ZodArray<z.ZodObject<{
        version: z.ZodString;
        description: z.ZodDefault<z.ZodString>;
        status: z.ZodDefault<z.ZodString>;
        changedBy: z.ZodDefault<z.ZodString>;
        approvedBy: z.ZodDefault<z.ZodString>;
        date: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        date: string;
        status: string;
        version: string;
        changedBy: string;
        approvedBy: string;
    }, {
        version: string;
        description?: string | undefined;
        date?: string | undefined;
        status?: string | undefined;
        changedBy?: string | undefined;
        approvedBy?: string | undefined;
    }>, "many">>;
    signOff: z.ZodDefault<z.ZodArray<z.ZodObject<{
        role: z.ZodString;
        nameEmail: z.ZodDefault<z.ZodString>;
        department: z.ZodDefault<z.ZodString>;
        signature: z.ZodDefault<z.ZodString>;
        date: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        role: string;
        date: string;
        nameEmail: string;
        department: string;
        signature: string;
    }, {
        role: string;
        date?: string | undefined;
        nameEmail?: string | undefined;
        department?: string | undefined;
        signature?: string | undefined;
    }>, "many">>;
    introOverview: z.ZodDefault<z.ZodString>;
    purposeScope: z.ZodDefault<z.ZodString>;
    objectives: z.ZodDefault<z.ZodString>;
    constraintsAssumptions: z.ZodDefault<z.ZodString>;
    architectureOverview: z.ZodDefault<z.ZodString>;
    agenticEcosystem: z.ZodDefault<z.ZodString>;
    highLevelFlow: z.ZodDefault<z.ZodString>;
    designSpecOverview: z.ZodDefault<z.ZodString>;
    agentRoleGoals: z.ZodDefault<z.ZodString>;
    ioSchema: z.ZodDefault<z.ZodString>;
    toolsIntegrations: z.ZodDefault<z.ZodString>;
    contextKnowledge: z.ZodDefault<z.ZodString>;
    humanInLoop: z.ZodDefault<z.ZodString>;
    modelConfigOverview: z.ZodDefault<z.ZodString>;
    llmModels: z.ZodDefault<z.ZodString>;
    guardrails: z.ZodDefault<z.ZodString>;
    evaluationSettings: z.ZodDefault<z.ZodString>;
    devOverview: z.ZodDefault<z.ZodString>;
    studioWebOverview: z.ZodDefault<z.ZodString>;
    workspacePanels: z.ZodDefault<z.ZodString>;
    testingPlayground: z.ZodDefault<z.ZodString>;
    evalOverview: z.ZodDefault<z.ZodString>;
    evalSets: z.ZodDefault<z.ZodString>;
    agentScoring: z.ZodDefault<z.ZodString>;
    autopilot: z.ZodDefault<z.ZodString>;
    monitoringTracing: z.ZodDefault<z.ZodString>;
    deployOverview: z.ZodDefault<z.ZodString>;
    environments: z.ZodDefault<z.ZodString>;
    maestroIntegration: z.ZodDefault<z.ZodString>;
    securityGovernance: z.ZodDefault<z.ZodString>;
    opsOverview: z.ZodDefault<z.ZodString>;
    monitoringHealth: z.ZodDefault<z.ZodString>;
    selfHealing: z.ZodDefault<z.ZodString>;
    versioningUpdates: z.ZodDefault<z.ZodString>;
    complianceOverview: z.ZodDefault<z.ZodString>;
    dataResidency: z.ZodDefault<z.ZodString>;
    trustLayer: z.ZodDefault<z.ZodString>;
    escalationControls: z.ZodDefault<z.ZodString>;
    nfrOverview: z.ZodDefault<z.ZodString>;
    performance: z.ZodDefault<z.ZodString>;
    scalability: z.ZodDefault<z.ZodString>;
    reliability: z.ZodDefault<z.ZodString>;
    maintainability: z.ZodDefault<z.ZodString>;
    usability: z.ZodDefault<z.ZodString>;
    references: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    appendix: z.ZodDefault<z.ZodString>;
    abbreviations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        term: z.ZodString;
        description: z.ZodDefault<z.ZodString>;
        remarks: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        term: string;
        remarks: string;
    }, {
        term: string;
        description?: string | undefined;
        remarks?: string | undefined;
    }>, "many">>;
    /** Evaluation / UAT scenarios — drive the Test Case (Excel) deliverable. */
    testScenarios: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        type: z.ZodEnum<["positive", "negative", "exception"]>;
        preconditions: z.ZodDefault<z.ZodString>;
        steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        testData: z.ZodDefault<z.ZodString>;
        expectedResult: z.ZodString;
        tracesTo: z.ZodOptional<z.ZodString>;
        project: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        type: "positive" | "negative" | "exception";
        title: string;
        preconditions: string;
        steps: string[];
        testData: string;
        expectedResult: string;
        tracesTo?: string | undefined;
        project?: string | undefined;
    }, {
        id: string;
        type: "positive" | "negative" | "exception";
        title: string;
        expectedResult: string;
        preconditions?: string | undefined;
        steps?: string[] | undefined;
        testData?: string | undefined;
        tracesTo?: string | undefined;
        project?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    agentName: string;
    guardrails: string;
    trustLayer: string;
    projectName: string;
    platformLabel: string;
    testScenarios: {
        id: string;
        type: "positive" | "negative" | "exception";
        title: string;
        preconditions: string;
        steps: string[];
        testData: string;
        expectedResult: string;
        tracesTo?: string | undefined;
        project?: string | undefined;
    }[];
    versionHistory: {
        description: string;
        date: string;
        status: string;
        version: string;
        changedBy: string;
        approvedBy: string;
    }[];
    signOff: {
        role: string;
        date: string;
        nameEmail: string;
        department: string;
        signature: string;
    }[];
    introOverview: string;
    purposeScope: string;
    objectives: string;
    constraintsAssumptions: string;
    architectureOverview: string;
    agenticEcosystem: string;
    highLevelFlow: string;
    designSpecOverview: string;
    agentRoleGoals: string;
    ioSchema: string;
    toolsIntegrations: string;
    contextKnowledge: string;
    humanInLoop: string;
    modelConfigOverview: string;
    llmModels: string;
    evaluationSettings: string;
    devOverview: string;
    studioWebOverview: string;
    workspacePanels: string;
    testingPlayground: string;
    evalOverview: string;
    evalSets: string;
    agentScoring: string;
    autopilot: string;
    monitoringTracing: string;
    deployOverview: string;
    environments: string;
    maestroIntegration: string;
    securityGovernance: string;
    opsOverview: string;
    monitoringHealth: string;
    selfHealing: string;
    versioningUpdates: string;
    complianceOverview: string;
    dataResidency: string;
    escalationControls: string;
    nfrOverview: string;
    performance: string;
    scalability: string;
    reliability: string;
    maintainability: string;
    usability: string;
    references: string[];
    appendix: string;
    abbreviations: {
        description: string;
        term: string;
        remarks: string;
    }[];
}, {
    projectName: string;
    agentName?: string | undefined;
    guardrails?: string | undefined;
    trustLayer?: string | undefined;
    platformLabel?: string | undefined;
    testScenarios?: {
        id: string;
        type: "positive" | "negative" | "exception";
        title: string;
        expectedResult: string;
        preconditions?: string | undefined;
        steps?: string[] | undefined;
        testData?: string | undefined;
        tracesTo?: string | undefined;
        project?: string | undefined;
    }[] | undefined;
    versionHistory?: {
        version: string;
        description?: string | undefined;
        date?: string | undefined;
        status?: string | undefined;
        changedBy?: string | undefined;
        approvedBy?: string | undefined;
    }[] | undefined;
    signOff?: {
        role: string;
        date?: string | undefined;
        nameEmail?: string | undefined;
        department?: string | undefined;
        signature?: string | undefined;
    }[] | undefined;
    introOverview?: string | undefined;
    purposeScope?: string | undefined;
    objectives?: string | undefined;
    constraintsAssumptions?: string | undefined;
    architectureOverview?: string | undefined;
    agenticEcosystem?: string | undefined;
    highLevelFlow?: string | undefined;
    designSpecOverview?: string | undefined;
    agentRoleGoals?: string | undefined;
    ioSchema?: string | undefined;
    toolsIntegrations?: string | undefined;
    contextKnowledge?: string | undefined;
    humanInLoop?: string | undefined;
    modelConfigOverview?: string | undefined;
    llmModels?: string | undefined;
    evaluationSettings?: string | undefined;
    devOverview?: string | undefined;
    studioWebOverview?: string | undefined;
    workspacePanels?: string | undefined;
    testingPlayground?: string | undefined;
    evalOverview?: string | undefined;
    evalSets?: string | undefined;
    agentScoring?: string | undefined;
    autopilot?: string | undefined;
    monitoringTracing?: string | undefined;
    deployOverview?: string | undefined;
    environments?: string | undefined;
    maestroIntegration?: string | undefined;
    securityGovernance?: string | undefined;
    opsOverview?: string | undefined;
    monitoringHealth?: string | undefined;
    selfHealing?: string | undefined;
    versioningUpdates?: string | undefined;
    complianceOverview?: string | undefined;
    dataResidency?: string | undefined;
    escalationControls?: string | undefined;
    nfrOverview?: string | undefined;
    performance?: string | undefined;
    scalability?: string | undefined;
    reliability?: string | undefined;
    maintainability?: string | undefined;
    usability?: string | undefined;
    references?: string[] | undefined;
    appendix?: string | undefined;
    abbreviations?: {
        term: string;
        description?: string | undefined;
        remarks?: string | undefined;
    }[] | undefined;
}>;
export type AddModel = z.infer<typeof AddModelSchema>;
export type AddVersionRow = z.infer<typeof VersionRow>;
export type AddSignOffRow = z.infer<typeof SignOffRow>;
export type AddAbbreviation = z.infer<typeof Abbreviation>;
export {};
