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
exports.parsePowerAutomate = parsePowerAutomate;
const path = __importStar(require("path"));
const ir_1 = require("../model/ir");
const files_1 = require("../util/files");
/**
 * Power Automate parser (initial depth).
 *
 * A cloud flow's `definition.json` holds `triggers` and `actions` objects; each
 * action's `runAfter` map defines control-flow edges. We map actions -> nodes
 * and runAfter -> edges. Desktop flows (.txt) are not yet parsed.
 */
async function parsePowerAutomate(workingDir) {
    const files = (0, files_1.walkFiles)(workingDir, { extensions: ['.json'] }).filter((f) => /definition\.json$/i.test(f));
    const graph = (0, ir_1.emptyGraph)('powerAutomate', path.basename(workingDir));
    for (const file of files) {
        let def;
        try {
            def = JSON.parse((0, files_1.readText)(file));
        }
        catch {
            graph.warnings.push(`Could not parse ${path.relative(workingDir, file)}`);
            continue;
        }
        const definition = def.properties?.definition ?? def.definition ?? def;
        graph.entryPoints.push(path.relative(workingDir, file));
        const triggers = definition.triggers ?? {};
        for (const [name, t] of Object.entries(triggers)) {
            graph.nodes.push(node(name, 'start', t?.type));
        }
        const actions = definition.actions ?? {};
        for (const [name, a] of Object.entries(actions)) {
            graph.nodes.push(node(name, classify(a?.type), a?.type));
            for (const dep of Object.keys(a?.runAfter ?? {})) {
                graph.edges.push({ from: idFor(dep), to: idFor(name), kind: 'seq' });
            }
        }
    }
    if (!graph.nodes.length) {
        graph.warnings.push('No Power Automate flow definitions found.');
    }
    return graph;
}
const ids = new Map();
function idFor(name) {
    if (!ids.has(name))
        ids.set(name, `pa_${ids.size + 1}`);
    return ids.get(name);
}
function node(name, kind, type) {
    return { id: idFor(name), kind, displayName: name, raw: { type } };
}
function classify(type) {
    if (!type)
        return 'other';
    if (/If|Condition|Switch/i.test(type))
        return 'if';
    if (/Foreach|Until|Loop/i.test(type))
        return 'loop';
    if (/Http|OpenApiConnection|ApiConnection|Sql|Sharepoint|Excel/i.test(type))
        return 'io';
    if (/Scope|Compose|InitializeVariable|SetVariable/i.test(type))
        return 'assign';
    return 'other';
}
//# sourceMappingURL=powerAutomate.js.map