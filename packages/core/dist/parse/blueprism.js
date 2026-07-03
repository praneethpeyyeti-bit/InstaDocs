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
exports.parseBluePrism = parseBluePrism;
const path = __importStar(require("path"));
const fast_xml_parser_1 = require("fast-xml-parser");
const ir_1 = require("../model/ir");
const files_1 = require("../util/files");
/**
 * Blue Prism parser (initial depth).
 *
 * A .bprelease (or exported process XML) contains <process>/<object> elements
 * whose <stage> children are the executable steps and <link>/onsuccess wire the
 * flow. We map stages -> nodes and links -> edges.
 */
const xml = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
async function parseBluePrism(workingDir) {
    const files = (0, files_1.walkFiles)(workingDir, { extensions: ['.bprelease', '.xml'] });
    const graph = (0, ir_1.emptyGraph)('blueprism', path.basename(workingDir));
    for (const file of files) {
        let doc;
        try {
            doc = xml.parse((0, files_1.readText)(file));
        }
        catch {
            continue;
        }
        const processes = collect(doc, 'process').concat(collect(doc, 'object'));
        for (const proc of processes) {
            const procName = proc['@_name'] || 'Process';
            graph.entryPoints.push(procName);
            const stages = toArray(proc.stage);
            const byId = new Map();
            for (const stage of stages) {
                const sid = stage['@_stageid'] || stage['@_name'];
                const n = node(stage['@_name'] || 'Stage', classify(stage['@_type']));
                byId.set(sid, n.id);
                graph.nodes.push(n);
            }
            for (const stage of stages) {
                const fromId = byId.get(stage['@_stageid'] || stage['@_name']);
                const onSuccess = stage.onsuccess;
                if (fromId && onSuccess && byId.has(onSuccess)) {
                    graph.edges.push({ from: fromId, to: byId.get(onSuccess), kind: 'seq' });
                }
            }
        }
    }
    if (!graph.nodes.length)
        graph.warnings.push('No Blue Prism stages found.');
    return graph;
}
let counter = 0;
function node(name, kind) {
    return { id: `bp_${++counter}`, kind, displayName: name, raw: {} };
}
function classify(type) {
    switch ((type || '').toLowerCase()) {
        case 'start':
            return 'start';
        case 'end':
            return 'end';
        case 'decision':
            return 'if';
        case 'loopstart':
        case 'loopend':
            return 'loop';
        case 'action':
        case 'read':
        case 'write':
        case 'navigate':
            return 'ui';
        case 'process':
        case 'subsheet':
            return 'invoke';
        case 'calculation':
        case 'multicalc':
            return 'assign';
        default:
            return 'other';
    }
}
function collect(obj, key) {
    const found = [];
    const visit = (o) => {
        if (!o || typeof o !== 'object')
            return;
        for (const [k, v] of Object.entries(o)) {
            if (k === key)
                found.push(...toArray(v));
            if (typeof v === 'object')
                visit(v);
        }
    };
    visit(obj);
    return found;
}
function toArray(v) {
    if (v === undefined || v === null)
        return [];
    return Array.isArray(v) ? v : [v];
}
//# sourceMappingURL=blueprism.js.map