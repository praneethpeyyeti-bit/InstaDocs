#!/usr/bin/env node
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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * InstaDocs CLI — thin shell over runPipeline for terminal / CI use.
 *
 * Usage:
 *   instadocs <repo-url-or-path> [--out ./docs] [--branch main]
 *             [--subpath src] [--platform uipath]
 *
 * Output is fixed: a Word SDD (.docx) + an Excel test-case doc (.xlsx),
 * filled from the branded templates in assets/.
 *
 * LLM Gateway (optional) via env:
 *   INSTADOCS_GATEWAY_URL, INSTADOCS_GATEWAY_TOKEN, INSTADOCS_GATEWAY_MODEL
 * When unset, the deterministic analyzer is used.
 */
const index_1 = require("./index");
const repo_1 = require("./repo");
const detect_1 = require("./detect");
const parse_1 = require("./parse");
const projectContext_1 = require("./context/projectContext");
const uipathSession_1 = require("./analyze/uipathSession");
function parseArgs(argv) {
    const args = { out: './instadocs-output', llm: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--out')
            args.out = argv[++i];
        else if (a === '--branch')
            args.branch = argv[++i];
        else if (a === '--subpath')
            args.subpath = argv[++i];
        else if (a === '--platform')
            args.platform = argv[++i];
        else if (a === '--doc-type' || a === '--type')
            args.docType = argv[++i];
        else if (a === '--llm' || a === '--strict')
            args.llm = true;
        else if (a === '--model')
            args.model = argv[++i];
        else if (a === '--dump-compact')
            args.dumpCompact = true;
        else if (!a.startsWith('--'))
            args.location = a;
    }
    return args;
}
/**
 * Parse the project and print the LLM "evidence" (discovery context + compacted
 * workflow) as JSON to stdout, then exit. Used by the Python LLM-Gateway driver
 * to feed a Claude model without re-implementing the parser.
 */
async function dumpCompact(args) {
    const repo = await (0, repo_1.openRepo)({ location: args.location, branch: args.branch, subPath: args.subpath });
    try {
        const platform = args.platform ?? (0, detect_1.detectPlatform)(repo.workingDir).platform;
        const graph = await (0, parse_1.parseProject)(platform, repo.workingDir);
        const ctx = (0, projectContext_1.loadProjectContext)(repo.workingDir);
        if (ctx)
            graph.projectContext = ctx;
        process.stdout.write(JSON.stringify({
            projectName: graph.projectName,
            platform,
            entryPoints: graph.entryPoints,
            nodeCount: graph.nodes.length,
            argumentCount: graph.arguments.length,
            compact: (0, index_1.compactGraph)(graph),
        }));
    }
    finally {
        repo.cleanup();
    }
}
/**
 * Resolve LLM Gateway config from (1) explicit INSTADOCS_GATEWAY_* env, then
 * (2) the signed-in UiPath `uip` session (token + org/tenant → URL). The token
 * is read by this process from its own provider store; it is never printed.
 */
function resolveGateway() {
    const model = process.env.INSTADOCS_GATEWAY_MODEL || 'anthropic.claude-opus-4-8';
    const session = (0, uipathSession_1.resolveUiPathSession)();
    const baseUrl = process.env.INSTADOCS_GATEWAY_URL || (0, uipathSession_1.gatewayUrlFromSession)(session);
    const token = process.env.INSTADOCS_GATEWAY_TOKEN || session.token;
    if (!baseUrl)
        return { note: 'no Gateway URL (set INSTADOCS_GATEWAY_URL or org/tenant)' };
    if (!token)
        return { note: 'no token (set INSTADOCS_GATEWAY_TOKEN or run `uip login`)' };
    const src = process.env.INSTADOCS_GATEWAY_TOKEN ? 'env token' : 'uip session token';
    return { config: { baseUrl, token, model }, note: `${baseUrl} (${src}, model ${model})` };
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.location) {
        console.error('Usage: instadocs <repo-url-or-path> [--out DIR] [--branch B] [--platform P]');
        process.exit(1);
    }
    if (args.dumpCompact) {
        await dumpCompact(args);
        return;
    }
    let preAuthored;
    if (args.model) {
        const fs = await Promise.resolve().then(() => __importStar(require('fs')));
        preAuthored = JSON.parse(fs.readFileSync(args.model, 'utf8'));
        console.error(`• Using pre-authored analysis: ${args.model}`);
    }
    const { config: gateway, note } = resolveGateway();
    if (!preAuthored) {
        // LLM-only: the Gateway is required (no deterministic mode).
        console.error(`• LLM Gateway (required): ${gateway ? note : 'NOT AVAILABLE — ' + note}`);
    }
    const result = await (0, index_1.runPipeline)({
        source: { location: args.location, branch: args.branch, subPath: args.subpath },
        platformOverride: args.platform,
        docTypeOverride: args.docType,
        generatedOn: new Date().toISOString().slice(0, 10),
        model: preAuthored,
        enrich: { gateway },
        onProgress: (m) => console.error(`• ${m}`),
    });
    const paths = await (0, index_1.exportDeliverables)(result.model, result.graph, new Date().toISOString().slice(0, 10), args.out, result.docType);
    const docLabel = result.docType === 'add' ? 'ADD  (Word)' : 'SDD  (Word)';
    console.error(`✓ ${docLabel}:  ${paths.docx}`);
    console.error(`✓ Tests (Excel): ${paths.testCasesXlsx}`);
    console.error(`Done. Platform=${result.detection.platform}, DocType=${result.docType}, LLM=${result.usedLlm ? 'yes' : 'no'}.`);
}
main().catch((err) => {
    console.error('InstaDocs failed:', err.message);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map