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
const agent_1 = require("./agent");
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
    graph.dependencies = readDependencies(workingDir);
    const mainFile = readMainEntry(workingDir);
    const xamlFiles = (0, files_1.walkFiles)(workingDir, { extensions: ['.xaml'] });
    if (mainFile && (0, files_1.exists)(path.join(workingDir, mainFile))) {
        graph.entryPoints.push(mainFile);
    }
    else if (xamlFiles.length) {
        graph.entryPoints.push(path.relative(workingDir, xamlFiles[0]));
    }
    // Detect the entry workflow's root layout (state machine / flowchart /
    // sequence) — drives which process-design diagram is drawn.
    if (graph.entryPoints[0]) {
        const entryPath = path.join(workingDir, graph.entryPoints[0]);
        graph.layout = detectLayout(entryPath);
        // For a state machine, parse the REAL states/transitions so the diagram is
        // built from the actual code rather than a generic REFramework template.
        if (graph.layout === 'statemachine') {
            const sm = parseStateMachine(entryPath);
            if (sm)
                graph.stateMachine = sm;
        }
    }
    for (const file of xamlFiles) {
        try {
            parseXamlFile(file, workingDir, graph);
        }
        catch (err) {
            graph.warnings.push(`Failed to parse ${path.relative(workingDir, file)}: ${err.message}`);
        }
    }
    // Record which applications/systems each workflow actually touches (from the
    // real URLs / browsers / Excel / mail / launched apps in its XAML) so the
    // process diagram can label each state with the app it uses, not the file name.
    graph.workflowApps = {};
    for (const file of xamlFiles) {
        try {
            const apps = detectApps((0, files_1.readText)(file));
            if (apps.length) {
                const base = path.basename(file).replace(/\.xaml$/i, '').toLowerCase();
                graph.workflowApps[base] = apps;
            }
        }
        catch {
            /* non-fatal */
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
    // Agentic automations carry an agent spec (low-code agent.json / coded agent)
    // alongside — or instead of — XAML. Attach it when present; it drives the
    // Agentic Design Document path.
    try {
        const agent = (0, agent_1.parseAgent)(workingDir);
        if (agent) {
            graph.agent = agent;
            if (!graph.entryPoints.length)
                graph.entryPoints.push(agent.source);
            if (graph.projectName === path.basename(workingDir) && agent.name)
                graph.projectName = agent.name;
        }
    }
    catch {
        /* non-fatal */
    }
    // Deepen the state machine: replace each state's invoked-workflow NAMES with
    // the real sub-steps those workflows perform (so two REFramework projects that
    // share the skeleton — e.g. a dispatcher vs a performer — differ by what their
    // Process/Init workflows actually do, not just identical framework file names).
    if (graph.stateMachine)
        expandStateMachineSteps(graph);
    return graph;
}
/** Base workflow name (no path, no extension), lower-cased. */
function wfBase(p) {
    return String(p || '').split(/[\\/]/).pop().replace(/\.xaml$/i, '');
}
// REFramework framework workflows — their own names are already meaningful to an
// RPA developer, so keep them concise (do NOT dump their internal activities).
const REFRAMEWORK_PLUMBING = /^(gettransactiondata|settransactionstatus|initallsettings|initallapplications|closeallapplications|killallprocesses|retrycurrenttransaction|takescreenshot)$/i;
/** "SendMail" -> "Send Mail"; "InitAllApps" -> "Init All Apps". */
function humanizeWf(s) {
    return s.replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\s{2,}/g, ' ').trim();
}
// Structural / plumbing display names that carry no business meaning.
const STEP_DROP = /^(sequence|do|body|main|comment ?out|ignored activities|try ?catch|catch|finally|throw|rethrow|backup ?slot|attach (window|browser)|assign)$/i;
// An If/Switch worth showing is one whose label reads as an ACTION, not a condition.
const ACTION_VERB = /^(add|write|send|update|create|delete|remove|move|save|read|get|fetch|extract|upload|download|open|close|post|mark|generate|build|store|insert|log ?in|sign ?in|navigate|click|assign to|set)\b/i;
/**
 * A short, MEANINGFUL set of business actions performed inside one workflow — the
 * milestones an RPA developer would recognise (data I/O, UI actions, invoked
 * business workflows, named phases, action-style decisions). NOT every activity:
 * bare branch conditions, logs, assigns and container plumbing are dropped.
 */
function meaningfulActions(graph, base, cap) {
    const out = [];
    const seen = new Set();
    for (const n of graph.nodes) {
        if (wfBase(String(n.raw?.file ?? '')).toLowerCase() !== base)
            continue;
        let s = (n.displayName || '').trim();
        if (!s || STEP_DROP.test(s) || s.toLowerCase() === base)
            continue;
        if (n.kind === 'log' || n.kind === 'assign')
            continue;
        if (n.kind === 'invoke') {
            const m = s.match(/([^\\/]+)\.xaml/i);
            s = humanizeWf(m ? m[1] : s.replace(/\s*-?\s*invoke workflow file$/i, '').replace(/^invoke\s+/i, '').replace(/\s+workflow$/i, ''));
        }
        else if (n.kind === 'if') {
            continue; // a branch condition — the diagram already shows real transitions as diamonds
        }
        else if (n.kind === 'switch') {
            s = s.replace(/^switch\s*[-–:]\s*/i, '').trim();
            if (!ACTION_VERB.test(s))
                continue; // keep only action-style switches (e.g. "Add to Database")
        }
        else if (n.kind === 'other' || n.kind === 'sequence') {
            // Keep only descriptive, multi-word phases / real activities.
            if (!/\s/.test(s))
                continue;
        }
        s = s.replace(/\s{2,}/g, ' ').trim();
        const k = s.toLowerCase();
        if (!s || seen.has(k))
            continue;
        seen.add(k);
        out.push(s);
        if (out.length >= cap)
            break;
    }
    return out;
}
/**
 * Give each state a meaningful step list: REFramework framework workflows keep
 * their concise names, while the business workflow (Process, or any non-framework
 * workflow the state invokes) is summarised into its key actions — so the diagram
 * reads as a flow, not a template and not an activity dump.
 */
function expandStateMachineSteps(graph) {
    const sm = graph.stateMachine;
    if (!sm)
        return;
    for (const st of sm.states) {
        const combined = [];
        for (const step of st.steps) {
            const wb = step.toLowerCase();
            if (wb !== 'process' && REFRAMEWORK_PLUMBING.test(wb)) {
                combined.push(humanizeWf(step)); // framework step — already meaningful
            }
            else {
                const acts = meaningfulActions(graph, wb, 6);
                if (acts.length)
                    combined.push(...acts);
                else
                    combined.push(humanizeWf(step));
            }
        }
        const seen = new Set();
        st.steps = combined.filter((s) => (seen.has(s.toLowerCase()) ? false : (seen.add(s.toLowerCase()), true))).slice(0, 7);
    }
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
/** Read declared dependencies (name + version) from project.json. */
function readDependencies(workingDir) {
    const pj = path.join(workingDir, 'project.json');
    if (!(0, files_1.exists)(pj))
        return [];
    try {
        const obj = JSON.parse((0, files_1.readText)(pj));
        const deps = obj.dependencies;
        if (!deps || typeof deps !== 'object')
            return [];
        return Object.entries(deps).map(([pkg, ver]) => ({
            package: pkg,
            // Versions look like "[3.2.1]", "2.9.10" or "26.4.4-preview" — strip the
            // NuGet range brackets, keep the rest verbatim.
            version: String(ver).replace(/^\[|\]$/g, '').trim() || undefined,
        }));
    }
    catch {
        return [];
    }
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
/** Detect the root layout of an entry XAML from its top structural child. */
function detectLayout(file) {
    try {
        const doc = xml.parse((0, files_1.readText)(file));
        const activity = doc.Activity ?? doc;
        // The root wraps the real body; look one or two levels down for the shape.
        const keys = new Set();
        const collect = (o, depth) => {
            if (!o || typeof o !== 'object' || depth > 2)
                return;
            for (const k of Object.keys(o)) {
                keys.add(k);
                if (!k.startsWith('@_') && !k.includes('.'))
                    collect(o[k], depth + 1);
            }
        };
        collect(activity, 0);
        if (keys.has('StateMachine'))
            return 'statemachine';
        if (keys.has('Flowchart'))
            return 'flowchart';
        return 'sequence';
    }
    catch {
        return undefined;
    }
}
/**
 * Parse the real StateMachine of an entry XAML into a StateMachineIR: the actual
 * states (with their annotations + the workflows they invoke) and the actual
 * transitions (name, guard condition, target). This is what drives a dynamic
 * REFramework diagram built from the code — not a canned 4-state template.
 */
function parseStateMachine(file) {
    let sm;
    try {
        const doc = xml.parse((0, files_1.readText)(file));
        const activity = doc.Activity ?? doc;
        sm = findFirst(activity, 'StateMachine');
    }
    catch {
        return undefined;
    }
    if (!sm)
        return undefined;
    // Collect every uniquely-defined State (by x:Name). References elsewhere use
    // <x:Reference> (a string), so each state object is defined exactly once.
    const byId = {};
    (function collectStates(o) {
        if (!o || typeof o !== 'object')
            return;
        if (Array.isArray(o))
            return o.forEach(collectStates);
        for (const k of Object.keys(o)) {
            if (k === 'State')
                for (const s of toArray(o.State))
                    if (s && s['@_Name'])
                        byId[s['@_Name']] = s;
            collectStates(o[k]);
        }
    })(sm);
    const ids = Object.keys(byId);
    if (!ids.length)
        return undefined;
    const targetOf = (to) => {
        if (!to)
            return undefined;
        if (to.Reference != null)
            return String(to.Reference).trim();
        const s = toArray(to.State)[0];
        return s?.['@_Name'];
    };
    const states = ids.map((id) => {
        const s = byId[id];
        const transitionsRaw = toArray(s['State.Transitions']?.Transition);
        const transitions = transitionsRaw
            .map((t) => ({
            name: String(t['@_DisplayName'] ?? 'Transition').trim(),
            condition: t['Transition.Condition'] != null ? String(t['Transition.Condition']).trim() : undefined,
            to: targetOf(t['Transition.To']) ?? '',
        }))
            .filter((t) => t.to);
        return {
            id,
            name: String(s['@_DisplayName'] ?? id).trim(),
            annotation: s['@_Annotation.AnnotationText'] ? String(s['@_Annotation.AnnotationText']).trim() : undefined,
            steps: invokedWorkflows(s['State.Entry']),
            isFinal: transitions.length === 0,
            transitions,
        };
    });
    const initialRef = String(sm['@_InitialState'] ?? '')
        .replace(/[{}]/g, '')
        .replace(/x:Reference/i, '')
        .trim();
    const initial = byId[initialRef] ? initialRef : ids[0];
    return { initial, states };
}
/** The first descendant object under `key` anywhere in the tree. */
function findFirst(o, key) {
    if (!o || typeof o !== 'object')
        return undefined;
    if (Array.isArray(o)) {
        for (const it of o) {
            const r = findFirst(it, key);
            if (r)
                return r;
        }
        return undefined;
    }
    if (o[key])
        return toArray(o[key])[0];
    for (const k of Object.keys(o)) {
        const r = findFirst(o[k], key);
        if (r)
            return r;
    }
    return undefined;
}
/** Ordered base names of the workflows a state's Entry invokes (its real steps). */
function invokedWorkflows(entry) {
    const out = [];
    (function walk(o) {
        if (!o || typeof o !== 'object')
            return;
        if (Array.isArray(o))
            return o.forEach(walk);
        for (const k of Object.keys(o)) {
            if (k === 'InvokeWorkflowFile') {
                for (const iv of toArray(o[k])) {
                    const f = iv?.['@_WorkflowFileName'];
                    if (f)
                        out.push(String(f).split(/[\\/]/).pop().replace(/\.xaml$/i, ''));
                }
            }
            walk(o[k]);
        }
    })(entry);
    // De-dup consecutive repeats (e.g. SetTransactionStatus invoked on each branch).
    return out.filter((w, i) => w !== out[i - 1]);
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
/**
 * XML elements that are NOT activities — CLR/collection value types, WPF
 * view-state types, argument/expression wrappers and flowchart plumbing. They
 * appear inside variables, arguments, HintSize/ConnectorLocation view-state,
 * etc. We must not emit them as process nodes (they showed up as bogus "STEP
 * Dictionary / Point / Size / FlowStep" boxes), but we still recurse through
 * them so genuine activities nested inside are captured.
 */
const NON_ACTIVITY = new Set([
    // argument / expression / reference wrappers
    'InArgument', 'OutArgument', 'InOutArgument', 'Reference', 'Literal',
    'VisualBasicValue', 'VisualBasicReference', 'ExpressionServices', 'PropertyValue',
    // flowchart / structural plumbing + delegate wrappers
    'FlowStep', 'ActivityAction', 'ActivityFunc', 'DelegateInArgument', 'DelegateOutArgument',
    // WPF / view-state value types
    'Point', 'Size', 'PointCollection', 'Rect', 'Color', 'SolidColorBrush',
    'Thickness', 'CornerRadius', 'Matrix', 'Vector', 'PointF', 'SizeF',
    // CLR value / collection TYPES (variable + x:TypeArguments)
    'Boolean', 'Int32', 'Int64', 'Double', 'Single', 'Decimal', 'Byte', 'Char',
    'String', 'Object', 'DateTime', 'TimeSpan', 'Guid', 'Uri', 'Version',
    'Dictionary', 'List', 'HashSet', 'Array', 'DataTable', 'DataRow', 'DataColumn',
    'Queue', 'Stack', 'IEnumerable', 'KeyValuePair',
]);
/**
 * Recursively walk activity nodes, creating ProcessNodes + edges. Each node
 * records its `parentId` and the `branch` it sits on (Then/Else/Catch/loop body)
 * so the process-flow renderer can rebuild the true branching tree instead of a
 * misleading linear chain.
 */
function walkActivity(obj, graph, file, parentId, branch) {
    if (!obj || typeof obj !== 'object')
        return;
    for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('@_') || key === '#text')
            continue;
        if (SKIP_KEYS.has(key) || key.endsWith('.Variables'))
            continue;
        const children = toArray(value);
        // Structural properties like If.Then, If.Else, TryCatch.Catches, Switch.Default,
        // loop Body: not activities themselves — recurse into them under the same
        // parent, tagging the activities they contain with the branch they sit on.
        if (key.includes('.')) {
            const childBranch = branchForKey(key);
            for (const child of children)
                walkActivity(child, graph, file, parentId, childBranch);
            continue;
        }
        // Non-activity elements (value types, view-state, argument wrappers, FlowStep):
        // don't emit a node, but still recurse so real activities nested inside them
        // (e.g. the activity under a FlowStep.Action) are captured.
        if (NON_ACTIVITY.has(key)) {
            for (const child of children)
                walkActivity(child, graph, file, parentId, branch);
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
                raw: { activity: key, file, condition: child['@_Condition'], parentId },
                annotations: readAnnotation(child),
            };
            // The first activity in a branch inherits the branch label; later siblings
            // are sequential within that branch.
            if (!prevSibling && branch)
                node.raw.branch = branch.label ?? branch.kind;
            const shot = readScreenshot(child);
            if (shot)
                node.raw.screenshot = shot;
            graph.nodes.push(node);
            const edgeKind = !prevSibling && branch ? branch.kind : 'seq';
            const edgeLabel = !prevSibling && branch ? branch.label : undefined;
            if (parentId)
                graph.edges.push(edge(parentId, node.id, edgeKind, edgeLabel));
            if (prevSibling)
                graph.edges.push(edge(prevSibling, node.id, 'seq'));
            prevSibling = node.id;
            recordSpecial(key, child, node, graph, file);
            // Recurse into this activity's children.
            walkActivity(child, graph, file, node.id);
        }
    }
}
/** Map a structural property (e.g. `If.Else`) to the branch its children sit on. */
function branchForKey(key) {
    const suffix = key.split('.').pop() ?? '';
    if (/^Then$/i.test(suffix))
        return { kind: 'true', label: 'Yes' };
    if (/^Else$/i.test(suffix))
        return { kind: 'false', label: 'No' };
    if (/^Catch(es)?$/i.test(suffix))
        return { kind: 'catch', label: 'On exception' };
    if (/^Finally$/i.test(suffix))
        return { kind: 'seq', label: 'Finally' };
    if (/^Default$/i.test(suffix))
        return { kind: 'case', label: 'Default' };
    if (/^(Body|Cases)$/i.test(suffix))
        return { kind: 'loop-body', label: 'Each' };
    return { kind: 'seq' };
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
    if (/^(AddQueueItem|AddTransactionItem|BulkAddQueueItems)$/.test(activityName)) {
        recordQueueItem(activityName, child, graph);
    }
}
/** Extract the fields an Add/Bulk Add Queue Item activity uploads. */
function recordQueueItem(activityName, child, graph) {
    const spec = {
        queue: cleanExpr(child['@_QueueName'] ?? child['@_QueueType']),
        reference: cleanExpr(child['@_Reference']),
        priority: child['@_Priority'],
        fields: [],
        bulk: activityName === 'BulkAddQueueItems',
    };
    // Inline ItemInformation dictionary: <Activity.ItemInformation><InArgument x:Key="WIID"/>…
    for (const k of Object.keys(child)) {
        if (!/ItemInformation$/.test(k))
            continue;
        for (const ia of toArray(child[k]?.InArgument ?? child[k])) {
            if (!ia || typeof ia !== 'object')
                continue;
            const name = ia['@_Key'] ?? ia['@_x:Key'];
            if (name)
                spec.fields.push({ name: String(name), type: innerType(ia['@_TypeArguments'] ?? ia['@_x:TypeArguments']) });
        }
    }
    (graph.queueItems ??= []).push(spec);
}
/** Trim a VB/C# expression down to something readable for docs. */
function cleanExpr(v) {
    if (!v)
        return undefined;
    return String(v).replace(/^\[|\]$/g, '').trim() || undefined;
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
/**
 * Detect the applications/systems a single workflow's XAML touches, as friendly
 * names, from its real evidence: web URLs (→ site name + browser), Excel
 * workbooks, mail activities, and launched desktop apps. Deterministic and
 * generic — works for any project, not just the ACME sample. De-duped, capped.
 */
const KNOWN_SITE = [
    [/acme/i, 'ACME System1'],
    [/salesforce|force\.com/i, 'Salesforce'],
    [/sharepoint/i, 'SharePoint'],
    [/servicenow/i, 'ServiceNow'],
    [/workday/i, 'Workday'],
    [/sap\b/i, 'SAP'],
];
function friendlySite(host) {
    for (const [re, name] of KNOWN_SITE)
        if (re.test(host))
            return name;
    // Fall back to the second-level domain label, title-cased and de-hyphenated
    // (e.g. "sha1-online.com" → "SHA1 Online", "contoso.com" → "Contoso").
    const labels = host.replace(/^www\./i, '').split('.');
    const core = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
    return core
        .split(/[-_]/)
        .filter(Boolean)
        .map((w) => (w.length <= 4 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(' ');
}
function detectApps(xamlText) {
    const apps = new Set();
    // Web sites + browser type — ONLY from real navigation attributes (Url=… /
    // Address=…), never from xmlns schema URIs in the file header.
    const browser = /BrowserType="([^"]+)"/i.exec(xamlText)?.[1];
    const hosts = new Set();
    // Host must be a real domain (contains a dot); skip namespace / platform URIs.
    for (const m of xamlText.matchAll(/(?:Url|Address|TargetUrl)="[^"]*?https?:\/\/(?:&quot;\s*&amp;?\s*)?([a-z0-9-]+\.[a-z0-9.-]+)/gi)) {
        const h = m[1].toLowerCase();
        if (/schemas\.|w3\.org|xmlns|microsoft\.com|openxmlformats|schema\.org/.test(h))
            continue;
        hosts.add(h);
    }
    for (const h of hosts)
        apps.add(friendlySite(h));
    void browser; // browser type intentionally omitted from the label to reduce clutter
    // Excel / workbooks (activity names, not incidental strings).
    if (/ExcelApplicationScope|ExcelProcessScope|WorkbookPath="|WorkbookApplicationScope|ReadRange|WriteRange|ReadCell|WriteCell/i.test(xamlText))
        apps.add('Excel');
    // Email.
    if (/OutlookMailMessage|SendOutlookMail|SendMailMessage|SMTP|ExchangeMail|GetIMAPMail|GetPOP3Mail|GetOutlookMail/i.test(xamlText))
        apps.add('Email');
    // Databases — real DB activities only (NOT System.Data.DataTable variable types).
    if (/DatabaseConnect|ExecuteQuery|ExecuteNonQuery|RunCommand.*Database|OpenConnection|InsertDataTable/i.test(xamlText))
        apps.add('Database');
    // PDF.
    if (/ReadPDFText|ReadPDFWithOCR|ExtractPDFPageRange/i.test(xamlText))
        apps.add('PDF');
    // Launched desktop apps (Open Application / Start Process).
    for (const m of xamlText.matchAll(/FileName="[^"]*?([^\\/"]+)\.exe"/gi)) {
        const exe = m[1];
        if (!/^(cmd|powershell|conhost)$/i.test(exe))
            apps.add(exe.charAt(0).toUpperCase() + exe.slice(1));
    }
    return [...apps].slice(0, 3);
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
function edge(from, to, kind, label) {
    return label ? { from, to, kind, label } : { from, to, kind };
}
//# sourceMappingURL=uipath.js.map