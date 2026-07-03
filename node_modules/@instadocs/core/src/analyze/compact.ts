import { ProcessGraph } from '../model/ir';

/**
 * Compact a ProcessGraph into a compact, token-efficient text outline for the
 * LLM. Large graphs are truncated so we stay within context limits; the counts
 * of what was dropped are stated so nothing is silently hidden.
 */
export function compactGraph(graph: ProcessGraph, maxNodes = 300): string {
  const lines: string[] = [];

  // Ground the LLM with project-discovery context, when available.
  const ctx = graph.projectContext;
  if (ctx) {
    lines.push('PROJECT CONTEXT (from UiPath project discovery):');
    if (ctx.overview?.description) lines.push(`  Description: ${ctx.overview.description}`);
    if (ctx.dependencies.length) {
      lines.push(
        '  Dependencies: ' +
          ctx.dependencies.map((d) => d.package + (d.version ? `@${d.version}` : '')).join(', ')
      );
    }
    if (ctx.conventions.length) {
      lines.push('  Conventions: ' + ctx.conventions.slice(0, 8).join('; '));
    }
    if (ctx.keyWorkflows.length) {
      lines.push(
        '  Key workflows: ' +
          ctx.keyWorkflows.map((w) => `${w.workflow}${w.purpose ? ` (${w.purpose})` : ''}`).join('; ')
      );
    }
    if (ctx.architecture) lines.push(`  Architecture: ${ctx.architecture.replace(/\s+/g, ' ').slice(0, 400)}`);
    lines.push('');
  }

  if (graph.arguments.length) {
    lines.push('ARGUMENTS:');
    for (const a of graph.arguments) {
      lines.push(`  [${a.direction}] ${a.name}: ${a.type ?? '?'}`);
    }
  }
  if (graph.variables.length) {
    lines.push(`VARIABLES (${graph.variables.length}): ` +
      graph.variables.slice(0, 40).map((v) => v.name).join(', '));
  }

  lines.push('STEPS:');
  const shown = graph.nodes.slice(0, maxNodes);
  for (const n of shown) {
    const cond = n.raw?.condition ? ` [cond: ${String(n.raw.condition)}]` : '';
    const note = n.annotations ? ` // ${n.annotations}` : '';
    lines.push(`  (${n.kind}) ${n.displayName}${cond}${note}`);
  }
  if (graph.nodes.length > maxNodes) {
    lines.push(`  … ${graph.nodes.length - maxNodes} more nodes truncated`);
  }

  if (graph.invocations.length) {
    lines.push('INVOKES: ' + graph.invocations.map((i) => i.target).join(', '));
  }
  if (graph.tryCatches.length) {
    lines.push(`EXCEPTION HANDLERS: ${graph.tryCatches.length}`);
    for (const t of graph.tryCatches.slice(0, 20)) {
      lines.push(`  - ${t.handlerSummary ?? t.exceptionType ?? 'try/catch'}`);
    }
  }
  return lines.join('\n');
}
