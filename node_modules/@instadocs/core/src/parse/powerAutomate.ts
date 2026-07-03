import * as path from 'path';
import { NodeKind, ProcessGraph, ProcessNode, emptyGraph } from '../model/ir';
import { readText, walkFiles } from '../util/files';

/**
 * Power Automate parser (initial depth).
 *
 * A cloud flow's `definition.json` holds `triggers` and `actions` objects; each
 * action's `runAfter` map defines control-flow edges. We map actions -> nodes
 * and runAfter -> edges. Desktop flows (.txt) are not yet parsed.
 */
export async function parsePowerAutomate(workingDir: string): Promise<ProcessGraph> {
  const files = walkFiles(workingDir, { extensions: ['.json'] }).filter((f) =>
    /definition\.json$/i.test(f)
  );
  const graph = emptyGraph('powerAutomate', path.basename(workingDir));

  for (const file of files) {
    let def: any;
    try {
      def = JSON.parse(readText(file));
    } catch {
      graph.warnings!.push(`Could not parse ${path.relative(workingDir, file)}`);
      continue;
    }
    const definition = def.properties?.definition ?? def.definition ?? def;
    graph.entryPoints.push(path.relative(workingDir, file));

    const triggers = definition.triggers ?? {};
    for (const [name, t] of Object.entries<any>(triggers)) {
      graph.nodes.push(node(name, 'start', t?.type));
    }
    const actions = definition.actions ?? {};
    for (const [name, a] of Object.entries<any>(actions)) {
      graph.nodes.push(node(name, classify(a?.type), a?.type));
      for (const dep of Object.keys(a?.runAfter ?? {})) {
        graph.edges.push({ from: idFor(dep), to: idFor(name), kind: 'seq' });
      }
    }
  }

  if (!graph.nodes.length) {
    graph.warnings!.push('No Power Automate flow definitions found.');
  }
  return graph;
}

const ids = new Map<string, string>();
function idFor(name: string): string {
  if (!ids.has(name)) ids.set(name, `pa_${ids.size + 1}`);
  return ids.get(name)!;
}

function node(name: string, kind: NodeKind, type?: string): ProcessNode {
  return { id: idFor(name), kind, displayName: name, raw: { type } };
}

function classify(type?: string): NodeKind {
  if (!type) return 'other';
  if (/If|Condition|Switch/i.test(type)) return 'if';
  if (/Foreach|Until|Loop/i.test(type)) return 'loop';
  if (/Http|OpenApiConnection|ApiConnection|Sql|Sharepoint|Excel/i.test(type)) return 'io';
  if (/Scope|Compose|InitializeVariable|SetVariable/i.test(type)) return 'assign';
  return 'other';
}
