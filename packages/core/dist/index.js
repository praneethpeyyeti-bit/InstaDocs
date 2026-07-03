"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillTestCasesXlsx = exports.fillAddDocx = exports.fillSddDocx = exports.exportDeliverables = exports.testCasesToMarkdown = exports.addToMarkdown = exports.sddToMarkdown = exports.gatewayUrlFromSession = exports.resolveUiPathSession = exports.compactGraph = exports.enrichAdd = exports.enrichSdd = exports.parseAgent = exports.parseProject = exports.openRepo = exports.isSolution = exports.discoverProjects = exports.detectDocType = exports.detectPlatform = exports.loadProjectContext = void 0;
exports.runPipeline = runPipeline;
/**
 * @instadocs/core — public API.
 *
 * The whole pipeline, plus the individual stages for callers (VS Code shell,
 * CLI, tests) that want finer control.
 */
const path = __importStar(require("path"));
const repo_1 = require("./repo");
const detect_1 = require("./detect");
const docType_1 = require("./detect/docType");
const solution_1 = require("./detect/solution");
const parse_1 = require("./parse");
const projectContext_1 = require("./context/projectContext");
const files_1 = require("./util/files");
const sdd_1 = require("./analyze/sdd");
const add_1 = require("./analyze/add");
const sdd_2 = require("./model/sdd");
const add_2 = require("./model/add");
const ir_1 = require("./model/ir");
__exportStar(require("./model/ir"), exports);
__exportStar(require("./model/sdd"), exports);
__exportStar(require("./model/add"), exports);
__exportStar(require("./model/agent"), exports);
__exportStar(require("./model/context"), exports);
var projectContext_2 = require("./context/projectContext");
Object.defineProperty(exports, "loadProjectContext", { enumerable: true, get: function () { return projectContext_2.loadProjectContext; } });
var detect_2 = require("./detect");
Object.defineProperty(exports, "detectPlatform", { enumerable: true, get: function () { return detect_2.detectPlatform; } });
var docType_2 = require("./detect/docType");
Object.defineProperty(exports, "detectDocType", { enumerable: true, get: function () { return docType_2.detectDocType; } });
var solution_2 = require("./detect/solution");
Object.defineProperty(exports, "discoverProjects", { enumerable: true, get: function () { return solution_2.discoverProjects; } });
Object.defineProperty(exports, "isSolution", { enumerable: true, get: function () { return solution_2.isSolution; } });
var repo_2 = require("./repo");
Object.defineProperty(exports, "openRepo", { enumerable: true, get: function () { return repo_2.openRepo; } });
var parse_2 = require("./parse");
Object.defineProperty(exports, "parseProject", { enumerable: true, get: function () { return parse_2.parseProject; } });
var agent_1 = require("./parse/agent");
Object.defineProperty(exports, "parseAgent", { enumerable: true, get: function () { return agent_1.parseAgent; } });
// LLM-only public surface: enrichSdd/enrichAdd require the UiPath LLM Gateway.
// (`deterministicSdd` is intentionally NOT re-exported — it is an offline test
//  scaffold only, never used by the pipeline.)
var sdd_3 = require("./analyze/sdd");
Object.defineProperty(exports, "enrichSdd", { enumerable: true, get: function () { return sdd_3.enrichSdd; } });
var add_3 = require("./analyze/add");
Object.defineProperty(exports, "enrichAdd", { enumerable: true, get: function () { return add_3.enrichAdd; } });
var compact_1 = require("./analyze/compact");
Object.defineProperty(exports, "compactGraph", { enumerable: true, get: function () { return compact_1.compactGraph; } });
var uipathSession_1 = require("./analyze/uipathSession");
Object.defineProperty(exports, "resolveUiPathSession", { enumerable: true, get: function () { return uipathSession_1.resolveUiPathSession; } });
Object.defineProperty(exports, "gatewayUrlFromSession", { enumerable: true, get: function () { return uipathSession_1.gatewayUrlFromSession; } });
var sddMarkdown_1 = require("./export/sddMarkdown");
Object.defineProperty(exports, "sddToMarkdown", { enumerable: true, get: function () { return sddMarkdown_1.sddToMarkdown; } });
Object.defineProperty(exports, "addToMarkdown", { enumerable: true, get: function () { return sddMarkdown_1.addToMarkdown; } });
Object.defineProperty(exports, "testCasesToMarkdown", { enumerable: true, get: function () { return sddMarkdown_1.testCasesToMarkdown; } });
var export_1 = require("./export");
Object.defineProperty(exports, "exportDeliverables", { enumerable: true, get: function () { return export_1.exportDeliverables; } });
Object.defineProperty(exports, "fillSddDocx", { enumerable: true, get: function () { return export_1.fillSddDocx; } });
Object.defineProperty(exports, "fillAddDocx", { enumerable: true, get: function () { return export_1.fillAddDocx; } });
Object.defineProperty(exports, "fillTestCasesXlsx", { enumerable: true, get: function () { return export_1.fillTestCasesXlsx; } });
/**
 * End-to-end: open repo -> detect -> parse -> analyze -> generate.
 * Cleans up any cloned temp dir before returning.
 */
async function runPipeline(options) {
    const { source, generatedOn, onProgress } = options;
    const step = (m) => onProgress?.(m);
    step('Opening repository…');
    const repo = await (0, repo_1.openRepo)(source);
    try {
        // Multi-project solution (e.g. Dispatcher / Performer / Reporter)? Produce
        // one combined SDD with a high-level flow diagram per project.
        const projects = (0, solution_1.discoverProjects)(repo.workingDir);
        if (projects.length > 1 && !options.model && options.docTypeOverride !== 'add') {
            return await runSolutionPipeline(projects, options, step);
        }
        step('Detecting source platform…');
        const detection = (0, detect_1.detectPlatform)(repo.workingDir);
        const platform = options.platformOverride ?? detection.platform;
        step(`Platform: ${platform} (confidence ${(detection.confidence * 100) | 0}%)`);
        step('Parsing workflow logic…');
        const graph = await (0, parse_1.parseProject)(platform, repo.workingDir);
        step(`Extracted ${graph.nodes.length} activities, ${graph.arguments.length} arguments.`);
        // Fold in UiPath project-discovery context (AGENTS.md) when present.
        const projectContext = (0, projectContext_1.loadProjectContext)(repo.workingDir);
        if (projectContext) {
            graph.projectContext = projectContext;
            step(`Loaded project context from ${projectContext.source} ` +
                `(${projectContext.dependencies.length} dependencies).`);
        }
        // RPA (SDD) vs agentic (ADD): the agent parse already ran, so prefer that
        // signal, then fall back to file-signature detection.
        const docType = options.docTypeOverride ?? (graph.agent ? 'add' : (0, docType_1.detectDocType)(repo.workingDir).docType);
        step(`Deliverable: ${docType === 'add' ? 'Agentic Design Document' : 'Solution Design Document'}.`);
        let model;
        let usedLlm;
        if (options.model) {
            step('Using pre-authored analysis (discovery-grounded)…');
            model = docType === 'add' ? add_2.AddModelSchema.parse(options.model) : sdd_2.SddModelSchema.parse(options.model);
            model.projectName ||= graph.projectName;
            if (docType === 'add') {
                model.agentName ||= graph.agent?.name ?? graph.projectName;
                model.platformLabel ||= ir_1.PLATFORM_LABELS[graph.platform];
            }
            else {
                model.platformLabel ||= ir_1.PLATFORM_LABELS[graph.platform];
            }
            usedLlm = true;
        }
        else if (docType === 'add') {
            step('Analyzing agentic design (role, tools, model, guardrails, evaluation)…');
            ({ model, usedLlm } = await (0, add_1.enrichAdd)(graph, { ...options.enrich, onProgress: step }));
        }
        else {
            step('Analyzing solution design (architecture, modules, exceptions)…');
            ({ model, usedLlm } = await (0, sdd_1.enrichSdd)(graph, { ...options.enrich, onProgress: step }));
        }
        // Accurate project folder structure straight from disk (single project).
        if (docType === 'sdd') {
            model.folderStructure = (0, files_1.folderTree)(repo.workingDir);
        }
        void generatedOn;
        return { detection, docType, graph, model, usedLlm };
    }
    finally {
        repo.cleanup();
    }
}
/**
 * Multi-project solution pipeline: parse each project, merge for solution-level
 * fields, and produce one combined SDD (with a high-level flow diagram per
 * project). Always an SDD deliverable.
 */
async function runSolutionPipeline(projects, options, step) {
    step(`Solution detected: ${projects.length} projects (${projects.map((p) => p.name).join(', ')}).`);
    const platform = options.platformOverride ?? 'uipath';
    const parsed = [];
    for (const p of projects) {
        step(`Parsing project "${p.name}"…`);
        const g = await (0, parse_1.parseProject)(platform, p.dir);
        const ctx = (0, projectContext_1.loadProjectContext)(p.dir);
        if (ctx)
            g.projectContext = ctx;
        parsed.push({ name: p.name, graph: g });
    }
    const solutionName = deriveSolutionName(projects);
    const merged = (0, sdd_1.mergeGraphs)(solutionName, parsed.map((p) => p.graph));
    step(`Solution name: ${solutionName}.`);
    step(`Extracted ${merged.nodes.length} activities across ${projects.length} projects.`);
    step('Analyzing solution design across all projects…');
    const { model, usedLlm } = await (0, sdd_1.enrichSddSolution)(solutionName, parsed, merged, {
        ...options.enrich,
        onProgress: step,
    });
    // Accurate folder structure — one tree per project.
    model.folderStructure = projects.map((p) => (0, files_1.folderTree)(p.dir)).join('\n\n');
    const detection = {
        platform: 'uipath',
        confidence: 1,
        scores: { uipath: 1, powerAutomate: 0, blueprism: 0, automationAnywhere: 0, unknown: 0 },
        evidence: [`Solution with ${projects.length} UiPath projects`],
    };
    return { detection, docType: 'sdd', graph: merged, model, usedLlm };
}
/**
 * Solution / process name, in priority order:
 *  1. the shared "<ProcessName>" from "<ProcessName>_Dispatcher/_Performer/_Reporter"
 *     project names (when all projects share the same base),
 *  2. else the parent folder that contains the projects.
 */
function deriveSolutionName(projects) {
    const bases = projects
        .map((p) => (0, solution_1.stripRole)(p.fullName))
        .map((b) => b.trim())
        .filter(Boolean);
    if (bases.length && bases.every((b) => b.toLowerCase() === bases[0].toLowerCase())) {
        return bases[0];
    }
    const first = projects[0];
    if (first) {
        const parent = path.basename(path.dirname(first.dir));
        if (parent && !/^[a-z]:$/i.test(parent))
            return parent;
    }
    return bases[0] || 'Solution';
}
//# sourceMappingURL=index.js.map