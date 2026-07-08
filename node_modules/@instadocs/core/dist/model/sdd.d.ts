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
declare const ModuleRow: z.ZodObject<{
    name: z.ZodString;
    parent: z.ZodDefault<z.ZodString>;
    arguments: z.ZodDefault<z.ZodString>;
    reusable: z.ZodDefault<z.ZodString>;
    folderPath: z.ZodDefault<z.ZodString>;
    description: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    arguments: string;
    folderPath: string;
    parent: string;
    reusable: string;
}, {
    name: string;
    description?: string | undefined;
    arguments?: string | undefined;
    folderPath?: string | undefined;
    parent?: string | undefined;
    reusable?: string | undefined;
}>;
declare const ExceptionRow: z.ZodObject<{
    code: z.ZodString;
    detail: z.ZodString;
    type: z.ZodString;
    botAction: z.ZodDefault<z.ZodString>;
    notification: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    code: string;
    detail: string;
    botAction: string;
    notification: string;
}, {
    type: string;
    code: string;
    detail: string;
    botAction?: string | undefined;
    notification?: string | undefined;
}>;
export declare const TestScenarioSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    type: z.ZodEnum<["positive", "negative", "exception"]>;
    preconditions: z.ZodDefault<z.ZodString>;
    steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    testData: z.ZodDefault<z.ZodString>;
    expectedResult: z.ZodString;
    tracesTo: z.ZodOptional<z.ZodString>;
    /** For a multi-project solution: which project this test belongs to (drives a
     * separate Excel sheet per process). Empty for a single-process solution. */
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
}>;
export type TestScenario = z.infer<typeof TestScenarioSchema>;
export declare const SddModelSchema: z.ZodObject<{
    projectName: z.ZodString;
    platformLabel: z.ZodString;
    /** 1 – Purpose / Introduction (narrative). */
    purpose: z.ZodString;
    /** 3.1 – Process overview summary (narrative). */
    summary: z.ZodString;
    /** 2.1 – Architectural structure: a short 1-2 sentence intro. */
    architecture: z.ZodDefault<z.ZodString>;
    /**
     * Architectural structure broken into labelled points (Pattern, Components,
     * Data flow, Integrations, Configuration, Error handling, Scalability) so the
     * section reads as structured bullets instead of one wall of text.
     */
    architecturePoints: z.ZodDefault<z.ZodArray<z.ZodObject<{
        aspect: z.ZodString;
        detail: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        detail: string;
        aspect: string;
    }, {
        detail: string;
        aspect: string;
    }>, "many">>;
    /**
     * The main business steps of the process, in execution order — drives the
     * "High level process flow diagram". Short imperative phrases (business, not
     * framework plumbing), e.g. "Log in to System1", "Calculate SHA1 hash".
     */
    highLevelSteps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /**
     * For a multi-project solution (e.g. Dispatcher / Performer / Reporter): the
     * high-level business steps of EACH project, so the SDD renders one high-level
     * flow diagram per project. Empty for a single-project solution.
     */
    projectFlows: z.ZodDefault<z.ZodArray<z.ZodObject<{
        project: z.ZodString;
        steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        reframework: z.ZodOptional<z.ZodBoolean>;
        stateMachine: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        steps: string[];
        project: string;
        reframework?: boolean | undefined;
        stateMachine?: any;
    }, {
        project: string;
        steps?: string[] | undefined;
        reframework?: boolean | undefined;
        stateMachine?: any;
    }>, "many">>;
    /**
     * For a REFramework state-machine project: the real BUSINESS sub-steps of each
     * state (Initialization / Get Transaction Data / Process Transaction / End
     * Process), so each swimlane lane shows what the state actually does — "Read
     * config workbook", "Retrieve Orchestrator assets", "Log in to <app>" — instead
     * of just the invoked workflow file names. Filled by the analyzer from each
     * state's real activities + applications. Empty for non-REFramework projects.
     */
    stateFlows: z.ZodDefault<z.ZodArray<z.ZodObject<{
        state: z.ZodString;
        steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        steps: string[];
        state: string;
    }, {
        state: string;
        steps?: string[] | undefined;
    }>, "many">>;
    revisions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        rev: z.ZodString;
        date: z.ZodString;
        role: z.ZodString;
        summary: z.ZodString;
        author: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        summary: string;
        role: string;
        rev: string;
        date: string;
        author: string;
    }, {
        summary: string;
        role: string;
        rev: string;
        date: string;
        author: string;
    }>, "many">>;
    contacts: z.ZodDefault<z.ZodArray<z.ZodObject<{
        role: z.ZodString;
        name: z.ZodDefault<z.ZodString>;
        email: z.ZodDefault<z.ZodString>;
        org: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        role: string;
        email: string;
        org: string;
    }, {
        role: string;
        name?: string | undefined;
        email?: string | undefined;
        org?: string | undefined;
    }>, "many">>;
    sourceDocuments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        title: z.ZodString;
        author: z.ZodDefault<z.ZodString>;
        version: z.ZodDefault<z.ZodString>;
        date: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        date: string;
        author: string;
        title: string;
        version: string;
    }, {
        title: string;
        date?: string | undefined;
        author?: string | undefined;
        version?: string | undefined;
    }>, "many">>;
    systemsPrereq: z.ZodDefault<z.ZodArray<z.ZodObject<{
        system: z.ZodString;
        requisite: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        system: string;
        requisite: string;
    }, {
        system: string;
        requisite: string;
    }>, "many">>;
    accessSettings: z.ZodDefault<z.ZodArray<z.ZodObject<{
        system: z.ZodString;
        detail: z.ZodDefault<z.ZodString>;
        level: z.ZodDefault<z.ZodString>;
        method: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        system: string;
        detail: string;
        level: string;
        method: string;
    }, {
        system: string;
        detail?: string | undefined;
        level?: string | undefined;
        method?: string | undefined;
    }>, "many">>;
    robotInfo: z.ZodDefault<z.ZodArray<z.ZodObject<{
        item: z.ZodString;
        desc: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        item: string;
        desc: string;
    }, {
        item: string;
        desc: string;
    }>, "many">>;
    processes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        folderPath: z.ZodDefault<z.ZodString>;
        description: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        folderPath: string;
    }, {
        name: string;
        description?: string | undefined;
        folderPath?: string | undefined;
    }>, "many">>;
    triggers: z.ZodDefault<z.ZodArray<z.ZodObject<{
        process: z.ZodString;
        type: z.ZodDefault<z.ZodString>;
        recurrence: z.ZodDefault<z.ZodString>;
        folderPath: z.ZodDefault<z.ZodString>;
        notes: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        process: string;
        type: string;
        folderPath: string;
        recurrence: string;
        notes: string;
    }, {
        process: string;
        type?: string | undefined;
        folderPath?: string | undefined;
        recurrence?: string | undefined;
        notes?: string | undefined;
    }>, "many">>;
    queues: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        folderPath: z.ZodDefault<z.ZodString>;
        details: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        folderPath: string;
        details: string;
    }, {
        name: string;
        folderPath?: string | undefined;
        details?: string | undefined;
    }>, "many">>;
    designSpecifications: z.ZodDefault<z.ZodString>;
    orchestratorFolders: z.ZodDefault<z.ZodString>;
    orchestratorAssets: z.ZodDefault<z.ZodArray<z.ZodObject<{
        item: z.ZodString;
        desc: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        item: string;
        desc: string;
    }, {
        item: string;
        desc: string;
    }>, "many">>;
    /** Representative JSON of an Orchestrator queue item (from Add/Bulk Add Queue Item). */
    queueItemJson: z.ZodDefault<z.ZodString>;
    designConsiderations: z.ZodDefault<z.ZodString>;
    namingConventions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    modules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        parent: z.ZodDefault<z.ZodString>;
        arguments: z.ZodDefault<z.ZodString>;
        reusable: z.ZodDefault<z.ZodString>;
        folderPath: z.ZodDefault<z.ZodString>;
        description: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        arguments: string;
        folderPath: string;
        parent: string;
        reusable: string;
    }, {
        name: string;
        description?: string | undefined;
        arguments?: string | undefined;
        folderPath?: string | undefined;
        parent?: string | undefined;
        reusable?: string | undefined;
    }>, "many">>;
    reporting: z.ZodDefault<z.ZodString>;
    folderStructure: z.ZodDefault<z.ZodString>;
    processRuns: z.ZodDefault<z.ZodString>;
    exceptions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        detail: z.ZodString;
        type: z.ZodString;
        botAction: z.ZodDefault<z.ZodString>;
        notification: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        code: string;
        detail: string;
        botAction: string;
        notification: string;
    }, {
        type: string;
        code: string;
        detail: string;
        botAction?: string | undefined;
        notification?: string | undefined;
    }>, "many">>;
    debuggingTips: z.ZodDefault<z.ZodString>;
    optimizations: z.ZodDefault<z.ZodString>;
    codeReview: z.ZodDefault<z.ZodString>;
    dependencies: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        purpose: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        purpose: string;
        version: string;
    }, {
        name: string;
        purpose?: string | undefined;
        version?: string | undefined;
    }>, "many">>;
    externalLibraries: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        version: z.ZodDefault<z.ZodString>;
        purpose: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        purpose: string;
        version: string;
    }, {
        name: string;
        purpose?: string | undefined;
        version?: string | undefined;
    }>, "many">>;
    futureImprovements: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    complianceItems: z.ZodDefault<z.ZodArray<z.ZodObject<{
        item: z.ZodString;
        desc: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        item: string;
        desc: string;
    }, {
        item: string;
        desc: string;
    }>, "many">>;
    dataSecurity: z.ZodDefault<z.ZodString>;
    glossary: z.ZodDefault<z.ZodArray<z.ZodObject<{
        term: z.ZodString;
        definition: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        term: string;
        definition: string;
    }, {
        term: string;
        definition: string;
    }>, "many">>;
    /** UAT test scenarios — drive the separate Test Case (Excel) deliverable. */
    testScenarios: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        type: z.ZodEnum<["positive", "negative", "exception"]>;
        preconditions: z.ZodDefault<z.ZodString>;
        steps: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        testData: z.ZodDefault<z.ZodString>;
        expectedResult: z.ZodString;
        tracesTo: z.ZodOptional<z.ZodString>;
        /** For a multi-project solution: which project this test belongs to (drives a
         * separate Excel sheet per process). Empty for a single-process solution. */
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
    summary: string;
    purpose: string;
    projectName: string;
    platformLabel: string;
    architecture: string;
    architecturePoints: {
        detail: string;
        aspect: string;
    }[];
    highLevelSteps: string[];
    projectFlows: {
        steps: string[];
        project: string;
        reframework?: boolean | undefined;
        stateMachine?: any;
    }[];
    stateFlows: {
        steps: string[];
        state: string;
    }[];
    revisions: {
        summary: string;
        role: string;
        rev: string;
        date: string;
        author: string;
    }[];
    contacts: {
        name: string;
        role: string;
        email: string;
        org: string;
    }[];
    sourceDocuments: {
        date: string;
        author: string;
        title: string;
        version: string;
    }[];
    systemsPrereq: {
        system: string;
        requisite: string;
    }[];
    accessSettings: {
        system: string;
        detail: string;
        level: string;
        method: string;
    }[];
    robotInfo: {
        item: string;
        desc: string;
    }[];
    processes: {
        name: string;
        description: string;
        folderPath: string;
    }[];
    triggers: {
        process: string;
        type: string;
        folderPath: string;
        recurrence: string;
        notes: string;
    }[];
    queues: {
        name: string;
        folderPath: string;
        details: string;
    }[];
    designSpecifications: string;
    orchestratorFolders: string;
    orchestratorAssets: {
        item: string;
        desc: string;
    }[];
    queueItemJson: string;
    designConsiderations: string;
    namingConventions: string[];
    modules: {
        name: string;
        description: string;
        arguments: string;
        folderPath: string;
        parent: string;
        reusable: string;
    }[];
    reporting: string;
    folderStructure: string;
    processRuns: string;
    exceptions: {
        type: string;
        code: string;
        detail: string;
        botAction: string;
        notification: string;
    }[];
    debuggingTips: string;
    optimizations: string;
    codeReview: string;
    dependencies: {
        name: string;
        purpose: string;
        version: string;
    }[];
    externalLibraries: {
        name: string;
        purpose: string;
        version: string;
    }[];
    futureImprovements: string[];
    complianceItems: {
        item: string;
        desc: string;
    }[];
    dataSecurity: string;
    glossary: {
        term: string;
        definition: string;
    }[];
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
}, {
    summary: string;
    purpose: string;
    projectName: string;
    platformLabel: string;
    architecture?: string | undefined;
    architecturePoints?: {
        detail: string;
        aspect: string;
    }[] | undefined;
    highLevelSteps?: string[] | undefined;
    projectFlows?: {
        project: string;
        steps?: string[] | undefined;
        reframework?: boolean | undefined;
        stateMachine?: any;
    }[] | undefined;
    stateFlows?: {
        state: string;
        steps?: string[] | undefined;
    }[] | undefined;
    revisions?: {
        summary: string;
        role: string;
        rev: string;
        date: string;
        author: string;
    }[] | undefined;
    contacts?: {
        role: string;
        name?: string | undefined;
        email?: string | undefined;
        org?: string | undefined;
    }[] | undefined;
    sourceDocuments?: {
        title: string;
        date?: string | undefined;
        author?: string | undefined;
        version?: string | undefined;
    }[] | undefined;
    systemsPrereq?: {
        system: string;
        requisite: string;
    }[] | undefined;
    accessSettings?: {
        system: string;
        detail?: string | undefined;
        level?: string | undefined;
        method?: string | undefined;
    }[] | undefined;
    robotInfo?: {
        item: string;
        desc: string;
    }[] | undefined;
    processes?: {
        name: string;
        description?: string | undefined;
        folderPath?: string | undefined;
    }[] | undefined;
    triggers?: {
        process: string;
        type?: string | undefined;
        folderPath?: string | undefined;
        recurrence?: string | undefined;
        notes?: string | undefined;
    }[] | undefined;
    queues?: {
        name: string;
        folderPath?: string | undefined;
        details?: string | undefined;
    }[] | undefined;
    designSpecifications?: string | undefined;
    orchestratorFolders?: string | undefined;
    orchestratorAssets?: {
        item: string;
        desc: string;
    }[] | undefined;
    queueItemJson?: string | undefined;
    designConsiderations?: string | undefined;
    namingConventions?: string[] | undefined;
    modules?: {
        name: string;
        description?: string | undefined;
        arguments?: string | undefined;
        folderPath?: string | undefined;
        parent?: string | undefined;
        reusable?: string | undefined;
    }[] | undefined;
    reporting?: string | undefined;
    folderStructure?: string | undefined;
    processRuns?: string | undefined;
    exceptions?: {
        type: string;
        code: string;
        detail: string;
        botAction?: string | undefined;
        notification?: string | undefined;
    }[] | undefined;
    debuggingTips?: string | undefined;
    optimizations?: string | undefined;
    codeReview?: string | undefined;
    dependencies?: {
        name: string;
        purpose?: string | undefined;
        version?: string | undefined;
    }[] | undefined;
    externalLibraries?: {
        name: string;
        purpose?: string | undefined;
        version?: string | undefined;
    }[] | undefined;
    futureImprovements?: string[] | undefined;
    complianceItems?: {
        item: string;
        desc: string;
    }[] | undefined;
    dataSecurity?: string | undefined;
    glossary?: {
        term: string;
        definition: string;
    }[] | undefined;
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
}>;
export type SddModel = z.infer<typeof SddModelSchema>;
export type SddModule = z.infer<typeof ModuleRow>;
export type SddException = z.infer<typeof ExceptionRow>;
export {};
