import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import {
  Argument,
  Direction,
  Edge,
  EdgeKind,
  NodeKind,
  ProcessGraph,
  ProcessNode,
  Variable,
  emptyGraph,
} from '../model/ir';
import { exists, readText, walkFiles } from '../util/files';

/**
 * UiPath parser: reads project.json + .xaml (+ .cs coded workflows) and emits
 * a normalized ProcessGraph.
 *
 * XAML is XML. We parse it, then walk the activity tree mapping UiPath activity
 * types onto normalized NodeKinds. This is intentionally tolerant — unknown
 * activities become 'other' nodes and are recorded as warnings rather than
 * failing the whole parse.
 */

const xml = new XMLParser({
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

export async function parseUiPath(workingDir: string): Promise<ProcessGraph> {
  nodeCounter = 0;
  screenshotsDir = path.join(workingDir, '.screenshots');
  const projectName = readProjectName(workingDir);
  const graph = emptyGraph('uipath', projectName);

  const mainFile = readMainEntry(workingDir);
  const xamlFiles = walkFiles(workingDir, { extensions: ['.xaml'] });

  if (mainFile && exists(path.join(workingDir, mainFile))) {
    graph.entryPoints.push(mainFile);
  } else if (xamlFiles.length) {
    graph.entryPoints.push(path.relative(workingDir, xamlFiles[0]));
  }

  for (const file of xamlFiles) {
    try {
      parseXamlFile(file, workingDir, graph);
    } catch (err) {
      graph.warnings!.push(
        `Failed to parse ${path.relative(workingDir, file)}: ${(err as Error).message}`
      );
    }
  }

  // Coded workflows (.cs) — lightweight extraction.
  for (const file of walkFiles(workingDir, { extensions: ['.cs'] })) {
    try {
      parseCodedWorkflow(file, workingDir, graph);
    } catch {
      /* non-fatal */
    }
  }

  return graph;
}

function readProjectName(workingDir: string): string {
  const pj = path.join(workingDir, 'project.json');
  if (exists(pj)) {
    try {
      const obj = JSON.parse(readText(pj));
      if (obj.name) return String(obj.name);
    } catch {
      /* ignore */
    }
  }
  return path.basename(workingDir);
}

function readMainEntry(workingDir: string): string | undefined {
  const pj = path.join(workingDir, 'project.json');
  if (exists(pj)) {
    try {
      const obj = JSON.parse(readText(pj));
      if (obj.main) return String(obj.main);
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

// UiPath activity local-name -> normalized kind.
const KIND_MAP: Record<string, NodeKind> = {
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

function classify(localName: string): NodeKind {
  if (KIND_MAP[localName]) return KIND_MAP[localName];
  if (IO_HINTS.test(localName)) return 'io';
  if (UI_HINTS.test(localName)) return 'ui';
  return 'other';
}

function parseXamlFile(file: string, workingDir: string, graph: ProcessGraph): void {
  const rel = path.relative(workingDir, file);
  const doc = xml.parse(readText(file));
  const activity = doc.Activity ?? doc;

  extractArguments(activity, graph);
  extractVariables(activity, graph, rel);

  // The real activity tree lives under the root Activity's first structural child.
  walkActivity(activity, graph, rel, undefined);
}

function extractArguments(activity: any, graph: ProcessGraph): void {
  // removeNSPrefix strips the `x:` prefix, so x:Members/x:Property become Members/Property.
  const members = activity?.Members?.Property ?? activity?.['x:Members']?.['x:Property'];
  const list = toArray(members);
  for (const prop of list) {
    const name = prop['@_Name'];
    const type: string | undefined = prop['@_Type'];
    if (!name || !type) continue;
    // Types look like "InArgument(x:String)".
    const m = /^(In|Out|InOut)Argument/.exec(type);
    if (!m) continue;
    const direction: Direction =
      m[1] === 'In' ? 'in' : m[1] === 'Out' ? 'out' : 'inout';
    const arg: Argument = {
      name: String(name).replace(/^Argument_/, ''),
      type: innerType(type),
      direction,
    };
    graph.arguments.push(arg);
  }
}

function extractVariables(activity: any, graph: ProcessGraph, scope: string): void {
  const vars = toArray(activity?.Sequence?.['Sequence.Variables']?.Variable);
  for (const v of vars) {
    if (!v || typeof v !== 'object') continue;
    const variable: Variable = {
      name: v['@_Name'],
      type: innerType(v['@_x:TypeArguments'] ?? v['@_TypeArguments']),
      scope,
      defaultValue: v['@_Default'],
    };
    if (variable.name) graph.variables.push(variable);
  }
}

function innerType(type?: string): string | undefined {
  if (!type) return undefined;
  const m = /\(([^)]+)\)/.exec(type);
  return (m ? m[1] : type).replace(/^x:/, '');
}

// Keys that are metadata/containers, not executable activities.
const SKIP_KEYS = new Set(['Members', 'TextExpression.NamespacesForImplementation',
  'TextExpression.ReferencesForImplementation']);

/** Recursively walk activity nodes, creating ProcessNodes + sequential edges. */
function walkActivity(
  obj: any,
  graph: ProcessGraph,
  file: string,
  parentId: string | undefined
): void {
  if (!obj || typeof obj !== 'object') return;

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@_') || key === '#text') continue;
    if (SKIP_KEYS.has(key) || key.endsWith('.Variables')) continue;

    const children = toArray(value) as any[];

    // Structural properties like If.Then, If.Else, TryCatch.Try, Switch.Default,
    // ForEach body: not activities themselves — recurse into them under the same
    // parent so the activities they contain are still captured.
    if (key.includes('.')) {
      for (const child of children) walkActivity(child, graph, file, parentId);
      continue;
    }

    let prevSibling: string | undefined;

    for (const child of children) {
      if (!child || typeof child !== 'object') continue;
      const kind = classify(key);
      const node: ProcessNode = {
        id: nextId(),
        kind,
        displayName: child['@_DisplayName'] || key,
        raw: { activity: key, file, condition: child['@_Condition'] },
        annotations: readAnnotation(child),
      };
      const shot = readScreenshot(child);
      if (shot) node.raw.screenshot = shot;
      graph.nodes.push(node);

      if (parentId) graph.edges.push(edge(parentId, node.id, 'seq'));
      if (prevSibling) graph.edges.push(edge(prevSibling, node.id, 'seq'));
      prevSibling = node.id;

      recordSpecial(key, child, node, graph, file);

      // Recurse into this activity's children.
      walkActivity(child, graph, file, node.id);
    }
  }
}

function recordSpecial(
  activityName: string,
  child: any,
  node: ProcessNode,
  graph: ProcessGraph,
  file: string
): void {
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

function readAnnotation(child: any): string | undefined {
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
function readScreenshot(child: any): string | undefined {
  const ref: string | undefined =
    child['@_InformativeScreenshot'] || child['@_sap:InformativeScreenshot'];
  if (!ref || !screenshotsDir) return undefined;
  const candidates = [path.join(screenshotsDir, ref)];
  if (!/\.png$/i.test(ref)) candidates.push(path.join(screenshotsDir, `${ref}.png`));
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return fs.readFileSync(p).toString('base64');
    } catch {
      /* ignore unreadable screenshot */
    }
  }
  return undefined;
}

function parseCodedWorkflow(file: string, workingDir: string, graph: ProcessGraph): void {
  const rel = path.relative(workingDir, file);
  const src = readText(file);
  // Coded workflows: capture Invoke calls and try/catch as coarse signals.
  const invokeRe = /\.RunWorkflow\s*\(\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = invokeRe.exec(src))) {
    const node: ProcessNode = {
      id: nextId(),
      kind: 'invoke',
      displayName: `RunWorkflow ${m[1]}`,
      raw: { activity: 'CodedInvoke', file: rel },
    };
    graph.nodes.push(node);
    graph.invocations.push({ nodeId: node.id, target: m[1] });
  }
  if (/\btry\b/.test(src) && /\bcatch\b/.test(src)) {
    const node: ProcessNode = {
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
function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function edge(from: string, to: string, kind: EdgeKind): Edge {
  return { from, to, kind };
}
