import * as path from 'path';
import { NodeKind, ProcessGraph, ProcessNode, emptyGraph } from '../model/ir';
import { readText, walkFiles } from '../util/files';

/**
 * Automation Anywhere parser (initial depth).
 *
 * A11 bots (.json in A360) contain a `nodes`/`commands` list where each command
 * has a `commandName`/`packagePkg`. We map commands -> nodes sequentially.
 * Legacy .atmx (XML) is detected but not yet parsed in depth.
 */
export async function parseAutomationAnywhere(workingDir: string): Promise<ProcessGraph> {
  const files = walkFiles(workingDir, { extensions: ['.json', '.atmx'] });
  const graph = emptyGraph('automationAnywhere', path.basename(workingDir));

  for (const file of files) {
    if (file.toLowerCase().endsWith('.atmx')) {
      graph.warnings!.push(
        `Legacy .atmx not yet parsed in depth: ${path.relative(workingDir, file)}`
      );
      continue;
    }
    let bot: any;
    try {
      bot = JSON.parse(readText(file));
    } catch {
      continue;
    }
    const commands: any[] = bot.nodes ?? bot.commands ?? [];
    if (!Array.isArray(commands) || !commands.length) continue;

    graph.entryPoints.push(path.relative(workingDir, file));
    let prev: string | undefined;
    for (const cmd of commands) {
      const name = cmd.commandName || cmd.name || cmd.packagePkg || 'command';
      const n = node(name, classify(name));
      graph.nodes.push(n);
      if (prev) graph.edges.push({ from: prev, to: n.id, kind: 'seq' });
      prev = n.id;
    }

    for (const v of bot.botVariables ?? bot.variables ?? []) {
      if (v?.name) graph.variables.push({ name: v.name, type: v.type });
    }
  }

  if (!graph.nodes.length) graph.warnings!.push('No Automation Anywhere commands found.');
  return graph;
}

let counter = 0;
function node(name: string, kind: NodeKind): ProcessNode {
  return { id: `aa_${++counter}`, kind, displayName: name, raw: {} };
}

function classify(name: string): NodeKind {
  if (/if|decision|else/i.test(name)) return 'if';
  if (/loop|each|while/i.test(name)) return 'loop';
  if (/excel|database|csv|file|email|api|rest/i.test(name)) return 'io';
  if (/click|type|window|recorder|object/i.test(name)) return 'ui';
  if (/variable|assign|number|string/i.test(name)) return 'assign';
  if (/runTask|runBot/i.test(name)) return 'invoke';
  return 'other';
}
