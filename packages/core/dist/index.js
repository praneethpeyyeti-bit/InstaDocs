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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillTestCasesXlsx = exports.fillSddDocx = exports.exportDeliverables = exports.testCasesToMarkdown = exports.sddToMarkdown = exports.gatewayUrlFromSession = exports.resolveUiPathSession = exports.compactGraph = exports.deterministicSdd = exports.enrichSdd = exports.parseProject = exports.openRepo = exports.detectPlatform = exports.loadProjectContext = void 0;
exports.runPipeline = runPipeline;
/**
 * @instadocs/core — public API.
 *
 * The whole pipeline, plus the individual stages for callers (VS Code shell,
 * CLI, tests) that want finer control.
 */
const repo_1 = require("./repo");
const detect_1 = require("./detect");
const parse_1 = require("./parse");
const projectContext_1 = require("./context/projectContext");
const sdd_1 = require("./analyze/sdd");
const sdd_2 = require("./model/sdd");
const ir_1 = require("./model/ir");
__exportStar(require("./model/ir"), exports);
__exportStar(require("./model/sdd"), exports);
__exportStar(require("./model/context"), exports);
var projectContext_2 = require("./context/projectContext");
Object.defineProperty(exports, "loadProjectContext", { enumerable: true, get: function () { return projectContext_2.loadProjectContext; } });
var detect_2 = require("./detect");
Object.defineProperty(exports, "detectPlatform", { enumerable: true, get: function () { return detect_2.detectPlatform; } });
var repo_2 = require("./repo");
Object.defineProperty(exports, "openRepo", { enumerable: true, get: function () { return repo_2.openRepo; } });
var parse_2 = require("./parse");
Object.defineProperty(exports, "parseProject", { enumerable: true, get: function () { return parse_2.parseProject; } });
var sdd_3 = require("./analyze/sdd");
Object.defineProperty(exports, "enrichSdd", { enumerable: true, get: function () { return sdd_3.enrichSdd; } });
Object.defineProperty(exports, "deterministicSdd", { enumerable: true, get: function () { return sdd_3.deterministicSdd; } });
var compact_1 = require("./analyze/compact");
Object.defineProperty(exports, "compactGraph", { enumerable: true, get: function () { return compact_1.compactGraph; } });
var uipathSession_1 = require("./analyze/uipathSession");
Object.defineProperty(exports, "resolveUiPathSession", { enumerable: true, get: function () { return uipathSession_1.resolveUiPathSession; } });
Object.defineProperty(exports, "gatewayUrlFromSession", { enumerable: true, get: function () { return uipathSession_1.gatewayUrlFromSession; } });
var sddMarkdown_1 = require("./export/sddMarkdown");
Object.defineProperty(exports, "sddToMarkdown", { enumerable: true, get: function () { return sddMarkdown_1.sddToMarkdown; } });
Object.defineProperty(exports, "testCasesToMarkdown", { enumerable: true, get: function () { return sddMarkdown_1.testCasesToMarkdown; } });
var export_1 = require("./export");
Object.defineProperty(exports, "exportDeliverables", { enumerable: true, get: function () { return export_1.exportDeliverables; } });
Object.defineProperty(exports, "fillSddDocx", { enumerable: true, get: function () { return export_1.fillSddDocx; } });
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
        let model;
        let usedLlm;
        if (options.model) {
            step('Using pre-authored analysis (discovery-grounded)…');
            model = sdd_2.SddModelSchema.parse(options.model);
            model.projectName ||= graph.projectName;
            model.platformLabel ||= ir_1.PLATFORM_LABELS[graph.platform];
            usedLlm = true;
        }
        else {
            step('Analyzing solution design (architecture, modules, exceptions)…');
            ({ model, usedLlm } = await (0, sdd_1.enrichSdd)(graph, {
                ...options.enrich,
                onProgress: step,
            }));
        }
        void generatedOn;
        return { detection, graph, model, usedLlm };
    }
    finally {
        repo.cleanup();
    }
}
//# sourceMappingURL=index.js.map