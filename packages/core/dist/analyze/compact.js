"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compactGraph = compactGraph;
/**
 * Compact a ProcessGraph into a compact, token-efficient text outline for the
 * LLM. Large graphs are truncated so we stay within context limits; the counts
 * of what was dropped are stated so nothing is silently hidden.
 */
function compactGraph(graph, maxNodes = 180) {
    const lines = [];
    // Ground the LLM with project-discovery context, when available.
    const ctx = graph.projectContext;
    if (ctx) {
        lines.push('PROJECT CONTEXT (from UiPath project discovery):');
        if (ctx.overview?.description)
            lines.push(`  Description: ${ctx.overview.description}`);
        if (ctx.dependencies.length) {
            lines.push('  Dependencies: ' +
                ctx.dependencies.map((d) => d.package + (d.version ? `@${d.version}` : '')).join(', '));
        }
        if (ctx.conventions.length) {
            lines.push('  Conventions: ' + ctx.conventions.slice(0, 8).join('; '));
        }
        if (ctx.keyWorkflows.length) {
            lines.push('  Key workflows: ' +
                ctx.keyWorkflows.map((w) => `${w.workflow}${w.purpose ? ` (${w.purpose})` : ''}`).join('; '));
        }
        if (ctx.architecture)
            lines.push(`  Architecture: ${ctx.architecture.replace(/\s+/g, ' ').slice(0, 400)}`);
        lines.push('');
    }
    // Agentic evidence, when this is an AI Agent project.
    const agent = graph.agent;
    if (agent) {
        lines.push(`AGENT (${agent.kind}${agent.runtime ? `, ${agent.runtime}` : ''}): ${agent.name}`);
        if (agent.description)
            lines.push(`  Description: ${agent.description}`);
        if (agent.model?.name || agent.model?.provider) {
            const m = agent.model;
            lines.push(`  Model: ${[m.name, m.provider, m.temperature && `temp=${m.temperature}`, m.maxTokens && `maxTokens=${m.maxTokens}`].filter(Boolean).join(', ')}`);
        }
        if (agent.systemPrompt)
            lines.push(`  System prompt: ${trunc(agent.systemPrompt, 800)}`);
        if (agent.userPrompt)
            lines.push(`  User prompt: ${trunc(agent.userPrompt, 400)}`);
        if (agent.inputs.length)
            lines.push('  Inputs: ' + agent.inputs.map((a) => `${a.name}${a.type ? `:${a.type}` : ''}`).join(', '));
        if (agent.outputs.length)
            lines.push('  Outputs: ' + agent.outputs.map((a) => `${a.name}${a.type ? `:${a.type}` : ''}`).join(', '));
        if (agent.tools.length)
            lines.push('  Tools: ' + agent.tools.map((t) => `${t.name}${t.type ? ` (${t.type})` : ''}`).join('; '));
        if (agent.knowledge.length)
            lines.push('  Knowledge/context: ' + agent.knowledge.map((k) => k.name).join('; '));
        if (agent.escalations.length)
            lines.push('  Escalations: ' + agent.escalations.map((e) => e.name).join('; '));
        if (agent.guardrails.length)
            lines.push('  Guardrails: ' + agent.guardrails.join('; '));
        lines.push('');
    }
    // Declared package dependencies (authoritative — from project.json).
    if (graph.dependencies?.length) {
        lines.push('DEPENDENCIES (from project.json): ' +
            graph.dependencies.map((d) => d.package + (d.version ? `@${d.version}` : '')).join(', '));
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
function trunc(s, n) {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
}
//# sourceMappingURL=compact.js.map