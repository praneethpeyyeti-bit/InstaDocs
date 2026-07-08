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
    // REFramework state evidence — per state: the workflows it invokes, the real
    // applications those workflows use, and a few key activities. This is what lets
    // the analyzer write accurate per-state business steps (stateFlows).
    if (graph.stateMachine?.states?.length) {
        const byFile = new Map();
        for (const n of graph.nodes) {
            const f = String(n.raw?.file ?? '').split(/[\\/]/).pop()?.replace(/\.xaml$/i, '').toLowerCase() ?? '';
            if (!f)
                continue;
            if (!byFile.has(f))
                byFile.set(f, []);
            const dn = (n.displayName ?? '').trim();
            if (dn && !/^(sequence|body|do|then|else|assign|log message|target|comment)$/i.test(dn))
                byFile.get(f).push(dn);
        }
        // Discovery "Key Workflows" purpose, keyed by workflow base name, so each
        // state's invoked workflow can be labelled with what it actually does.
        const purposeOf = new Map();
        for (const kw of ctx?.keyWorkflows ?? []) {
            const key = String(kw.workflow ?? '').split(/[\\/]/).pop()?.replace(/\.xaml$/i, '').toLowerCase() ?? '';
            if (key && kw.purpose)
                purposeOf.set(key, kw.purpose);
        }
        lines.push('REFRAMEWORK STATES (use the EXACT state names below for stateFlows):');
        for (const st of graph.stateMachine.states) {
            const wfs = st.invokes && st.invokes.length ? st.invokes : st.steps; // raw invoked workflows
            const appsFor = new Set();
            const acts = [];
            for (const wf of wfs) {
                for (const a of graph.workflowApps?.[wf.toLowerCase()] ?? [])
                    appsFor.add(a);
                for (const dn of byFile.get(wf.toLowerCase()) ?? [])
                    if (acts.length < 10 && /^(get|read|retrieve|extract|parse|calculate|build|validate|update|submit|create|send|download|upload|log ?in|login|open|go to|navigate|close|classify|categor|compose|write|lookup|reply)\b/i.test(dn))
                        acts.push(dn);
            }
            // Name each invoked workflow with its discovery purpose, when known.
            const wfLabels = wfs.map((wf) => {
                const p = purposeOf.get(wf.toLowerCase());
                return p ? `${wf} (${p})` : wf;
            });
            // Curated code-derived business actions (post-expand steps) as extra grounding.
            const doesActs = st.steps.filter((s) => !wfs.some((w) => w.toLowerCase() === s.toLowerCase()));
            lines.push(`  ${st.name}: invokes ${wfLabels.join(', ') || '(none)'}` +
                (appsFor.size ? `; apps: ${[...appsFor].join(', ')}` : '') +
                (acts.length ? `; activities: ${acts.slice(0, 8).join(' / ')}` : '') +
                (doesActs.length ? `; does: ${doesActs.slice(0, 8).join(' / ')}` : ''));
        }
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