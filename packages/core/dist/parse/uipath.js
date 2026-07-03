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
exports.parseUiPath = parseUiPath;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fast_xml_parser_1 = require("fast-xml-parser");
const ir_1 = require("../model/ir");
const files_1 = require("../util/files");
/**
 * UiPath parser: reads project.json + .xaml (+ .cs coded workflows) and emits
 * a normalized ProcessGraph.
 *
 * XAML is XML. We parse it, then walk the activity tree mapping UiPath activity
 * types onto normalized NodeKinds. This is intentionally tolerant — unknown
 * activities become 'other' nodes and are recorded as warnings rather than
 * failing the whole parse.
 */
const xml = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    preserveOrder: false,
    parseAttributeValue: false,
});
let nodeCounter = 0;
const nextId = () => `n${++nodeCounter}`;
// Where UiPath stores informative UI screenshots for the current project.
let screenshotsDir = '';
async function parseUiPath(workingDir) {
    nodeCounter = 0;
    screenshotsDir = path.join(workingDir, '.screenshots');
    const projectName = readProjectName(workingDir);
    const graph = (0, ir_1.emptyGraph)('uipath', projectName);
    const mainFile = readMainEntry(workingDir);
    const xamlFiles = (0, files_1.walkFiles)(workingDir, { extensions: ['.xaml'] });
    if (mainFile && (0, files_1.exists)(path.join(workingDir, mainFile))) {
        graph.entryPoints.push(mainFile);
    }
    else if (xamlFiles.length) {
        graph.entryPoints.push(path.relative(workingDir, xamlFiles[0]));
    }
    for (const file of xamlFiles) {
        try {
            parseXamlFile(file, workingDir, graph);
        }
        catch (err) {
            graph.warnings.push(`Failed to parse ${path.relative(workingDir, file)}: ${err.message}`);
        }
    }
    // Coded workflows (.cs) — lightweight extraction.
    for (const file of (0, files_1.walkFiles)(workingDir, { extensions: ['.cs'] })) {
        try {
            parseCodedWorkflow(file, workingDir, graph);
        }
        catch {
            /* non-fatal */
        }
    }
    return graph;
}
function readProjectName(workingDir) {
    const pj = path.join(workingDir, 'project.json');
    if ((0, files_1.exists)(pj)) {
        try {
            const obj = JSON.parse((0, files_1.readText)(pj));
            if (obj.name)
                return String(obj.name);
        }
        catch {
            /* ignore */
        }
    }
    return path.basename(workingDir);
}
function readMainEntry(workingDir) {
    const pj = path.join(workingDir, 'project.json');
    if ((0, files_1.exists)(pj)) {
        try {
            const obj = JSON.parse((0, files_1.readText)(pj));
            if (obj.main)
                return String(obj.main);
        }
        catch {
            /* ignore */
        }
    }
    return undefined;
}
// UiPath activity local-name -> normalized kind.
const KIND_MAP = {
    Sequence: 'sequence',
    Flowchart: 'sequence',
    StateMachine: 'sequence',
    Assign: 'assign',
    MultipleAssign: 'assign',
    If: 'if',
    FlowDecision: 'if',
    Switch: 'switch',
    FlowSwitch: 'switch',
    While: 'loop',
    DoWhile: 'loop',
    ForEach: 'loop',
    'ForEach<T>': 'loop',
    ForEachRow: 'loop',
    InvokeWorkflowFile: 'invoke',
    RunWorkflowInteractive: 'invoke',
    TryCatch: 'other',
    Throw: 'throw',
    Rethrow: 'throw',
    LogMessage: 'log',
    WriteLine: 'log',
    Delay: 'delay',
};
const IO_HINTS = /Read|Write|Excel|CSV|Database|Query|Http|Api|Queue|Mail|Outlook|File/i;
const UI_HINTS = /Click|Type|GetText|Screen|Element|Browser|Navigate|Selector|Image/i;
function classify(localName) {
    if (KIND_MAP[localName])
        return KIND_MAP[localName];
    if (IO_HINTS.test(localName))
        return 'io';
    if (UI_HINTS.test(localName))
        return 'ui';
    return 'other';
}
function parseXamlFile(file, workingDir, graph) {
    const rel = path.relative(workingDir, file);
    const doc = xml.parse((0, files_1.readText)(file));
    const activity = doc.Activity ?? doc;
    extractArguments(activity, graph);
    extractVariables(activity, graph, rel);
    // The real activity tree lives under the root Activity's first structural child.
    walkActivity(activity, graph, rel, undefined);
}
function extractArguments(activity, graph) {
    // removeNSPrefix strips the `x:` prefix, so x:Members/x:Property become Members/Property.
    const members = activity?.Members?.Property ?? activity?.['x:Members']?.['x:Property'];
    const list = toArray(members);
    for (const prop of list) {
        const name = prop['@_Name'];
        const type = prop['@_Type'];
        if (!name || !type)
            continue;
        // Types look like "InArgument(x:String)".
        const m = /^(In|Out|InOut)Argument/.exec(type);
        if (!m)
            continue;
        const direction = m[1] === 'In' ? 'in' : m[1] === 'Out' ? 'out' : 'inout';
        const arg = {
            name: String(name).replace(/^Argument_/, ''),
            type: innerType(type),
            direction,
        };
        graph.arguments.push(arg);
    }
}
function extractVariables(activity, graph, scope) {
    const vars = toArray(activity?.Sequence?.['Sequence.Variables']?.Variable);
    for (const v of vars) {
        if (!v || typeof v !== 'object')
            continue;
        const variable = {
            name: v['@_Name'],
            type: innerType(v['@_x:TypeArguments'] ?? v['@_TypeArguments']),
            scope,
            defaultValue: v['@_Default'],
        };
        if (variable.name)
            graph.variables.push(variable);
    }
}
function innerType(type) {
    if (!type)
        return undefined;
    const m = /\(([^)]+)\)/.exec(type);
    return (m ? m[1] : type).replace(/^x:/, '');
}
// Keys that are metadata/containers, not executable activities.
const SKIP_KEYS = new Set(['Members', 'TextExpression.NamespacesForImplementation',
    'TextExpression.ReferencesForImplementation']);
/** Recursively walk activity nodes, creating ProcessNodes + sequential edges. */
function walkActivity(obj, graph, file, parentId) {
    if (!obj || typeof obj !== 'object')
        return;
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('@_') || key === '#text')
            continue;
        if (SKIP_KEYS.has(key) || key.endsWith('.Variables'))
            continue;
        const children = toArray(value);
        // Structural properties like If.Then, If.Else, TryCatch.Try, Switch.Default,
        // ForEach body: not activities themselves — recurse into them under the same
        // parent so the activities they contain are still captured.
        if (key.includes('.')) {
            for (const child of children)
                walkActivity(child, graph, file, parentId);
            continue;
        }
        let prevSibling;
        for (const child of children) {
            if (!child || typeof child !== 'object')
                continue;
            const kind = classify(key);
            const node = {
                id: nextId(),
                kind,
                displayName: child['@_DisplayName'] || key,
                raw: { activity: key, file, condition: child['@_Condition'] },
                annotations: readAnnotation(child),
            };
            const shot = readScreenshot(child);
            if (shot)
                node.raw.screenshot = shot;
            graph.nodes.push(node);
            if (parentId)
                graph.edges.push(edge(parentId, node.id, 'seq'));
            if (prevSibling)
                graph.edges.push(edge(prevSibling, node.id, 'seq'));
            prevSibling = node.id;
            recordSpecial(key, child, node, graph, file);
            // Recurse into this activity's children.
            walkActivity(child, graph, file, node.id);
        }
    }
}
function recordSpecial(activityName, child, node, graph, file) {
    if (activityName === 'InvokeWorkflowFile') {
        graph.invocations.push({
            nodeId: node.id,
            target: child['@_WorkflowFileName'] || 'unknown',
        });
    }
    if (activityName === 'TryCatch') {
        graph.tryCatches.push({
            nodeId: node.id,
            handlerSummary: `Try/Catch in ${file}`,
        });
    }
    if (node.kind === 'if' && child['@_Condition']) {
        node.raw.condition = child['@_Condition'];
    }
}
function readAnnotation(child) {
    // UiPath stores annotations under sap2010:Annotation.AnnotationText.
    for (const k of Object.keys(child)) {
        if (k.endsWith('Annotation.AnnotationText')) {
            const v = child[k];
            return typeof v === 'string' ? v : v?.['#text'];
        }
    }
    const attr = child['@_sap2010:Annotation.AnnotationText'] || child['@_AnnotationText'];
    return attr;
}
/**
 * If a UI activity references an informative screenshot, read it and return the
 * PNG as base64. UiPath stores these under `<project>/.screenshots/<ref>`.
 * Read at parse time (while files exist) so cloned/temp repos still work.
 */
function readScreenshot(child) {
    const ref = child['@_InformativeScreenshot'] || child['@_sap:InformativeScreenshot'];
    if (!ref || !screenshotsDir)
        return undefined;
    const candidates = [path.join(screenshotsDir, ref)];
    if (!/\.png$/i.test(ref))
        candidates.push(path.join(screenshotsDir, `${ref}.png`));
    for (const p of candidates) {
        try {
            if (fs.existsSync(p))
                return fs.readFileSync(p).toString('base64');
        }
        catch {
            /* ignore unreadable screenshot */
        }
    }
    return undefined;
}
function parseCodedWorkflow(file, workingDir, graph) {
    const rel = path.relative(workingDir, file);
    const src = (0, files_1.readText)(file);
    // Coded workflows: capture Invoke calls and try/catch as coarse signals.
    const invokeRe = /\.RunWorkflow\s*\(\s*"([^"]+)"/g;
    let m;
    while ((m = invokeRe.exec(src))) {
        const node = {
            id: nextId(),
            kind: 'invoke',
            displayName: `RunWorkflow ${m[1]}`,
            raw: { activity: 'CodedInvoke', file: rel },
        };
        graph.nodes.push(node);
        graph.invocations.push({ nodeId: node.id, target: m[1] });
    }
    if (/\btry\b/.test(src) && /\bcatch\b/.test(src)) {
        const node = {
            id: nextId(),
            kind: 'other',
            displayName: `try/catch (${rel})`,
            raw: { activity: 'CodedTryCatch', file: rel },
        };
        graph.nodes.push(node);
        graph.tryCatches.push({ nodeId: node.id, handlerSummary: `try/catch in ${rel}` });
    }
}
// ---- helpers ----
function toArray(v) {
    if (v === undefined || v === null)
        return [];
    return Array.isArray(v) ? v : [v];
}
function edge(from, to, kind) {
    return { from, to, kind };
}
//# sourceMappingURL=uipath.js.map