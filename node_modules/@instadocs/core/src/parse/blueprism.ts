import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { NodeKind, ProcessGraph, ProcessNode, emptyGraph } from '../model/ir';
import { readText, walkFiles } from '../util/files';

/**
 * Blue Prism parser (initial depth).
 *
 * A .bprelease (or exported process XML) contains <process>/<object> elements
 * whose <stage> children are the executable steps and <link>/onsuccess wire the
 * flow. We map stages -> nodes and links -> edges.
 */
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

export async function parseBluePrism(workingDir: string): Promise<ProcessGraph> {
  const files = walkFiles(workingDir, { extensions: ['.bprelease', '.xml'] });
  const graph = emptyGraph('blueprism', path.basename(workingDir));

  for (const file of files) {
    let doc: any;
    try {
      doc = xml.parse(readText(file));
    } catch {
      continue;
    }
    const processes = collect(doc, 'process').concat(collect(doc, 'object'));
    for (const proc of processes) {
      const procName = proc['@_name'] || 'Process';
      graph.entryPoints.push(procName);
      const stages = toArray(proc.stage);
      const byId = new Map<string, string>();
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
          graph.edges.push({ from: fromId, to: byId.get(onSuccess)!, kind: 'seq' });
        }
      }
    }
  }

  if (!graph.nodes.length) graph.warnings!.push('No Blue Prism stages found.');
  return graph;
}

let counter = 0;
function node(name: string, kind: NodeKind): ProcessNode {
  return { id: `bp_${++counter}`, kind, displayName: name, raw: {} };
}

function classify(type?: string): NodeKind {
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

function collect(obj: any, key: string): any[] {
  const found: any[] = [];
  const visit = (o: any) => {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (k === key) found.push(...toArray(v));
      if (typeof v === 'object') visit(v);
    }
  };
  visit(obj);
  return found;
}

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}
