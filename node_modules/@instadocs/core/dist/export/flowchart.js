"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessLabel = businessLabel;
exports.renderEntryDiagram = renderEntryDiagram;
exports.isReframework = isReframework;
exports.renderReframeworkStates = renderReframeworkStates;
exports.renderArchitecture = renderArchitecture;
exports.renderAgenticFlow = renderAgenticFlow;
exports.renderAgenticEcosystem = renderAgenticEcosystem;
exports.renderProcessFlow = renderProcessFlow;
exports.hasHighLevelSteps = hasHighLevelSteps;
exports.renderHighLevelFlow = renderHighLevelFlow;
exports.renderTechnicalFlow = renderTechnicalFlow;
exports.stateStepsFromFlows = stateStepsFromFlows;
exports.deriveStateSteps = deriveStateSteps;
exports.renderStateMachine = renderStateMachine;
exports.renderPartitionedFlow = renderPartitionedFlow;
exports.renderPartitionedFlows = renderPartitionedFlows;
const resvg_js_1 = require("@resvg/resvg-js");
const MAX_NODES = 18;
const DEC_H = 74;
const FILL = {
    start: '#2E7D32',
    end: '#B00020',
    io: '#1565C0',
    ui: '#00838F',
    invoke: '#6A1B9A',
    loop: '#283593',
    assign: '#546E7A',
    log: '#616161',
    throw: '#C62828',
    if: '#F9A825',
    switch: '#F9A825',
    delay: '#795548',
    sequence: '#455A64',
    other: '#455A64',
};
const LABEL = {
    start: 'Start',
    end: 'End',
    io: 'Data I/O',
    ui: 'UI action',
    invoke: 'Invoke',
    loop: 'Loop',
    assign: 'Set value',
    log: 'Log',
    throw: 'Exception',
    if: 'Decision',
    switch: 'Decision',
};
/** Convert a technical activity name to a business-readable label. */
function businessLabel(text) {
    let t = text;
    t = t.replace(/^Type\s*Into\b/i, 'Enter data into').replace(/^Type\b/i, 'Enter');
    t = t.replace(/^Click\b/i, 'Select');
    t = t.replace(/^Get\s*Text\b/i, 'Capture').replace(/^GetText\b/i, 'Capture');
    t = t.replace(/^Read\s*Range\b/i, 'Retrieve records from').replace(/^Read\b/i, 'Retrieve');
    t = t.replace(/^Write\s*(Range|Line|Cell)?\b/i, 'Record');
    t = t.replace(/Send\s*Mail\b/i, 'Send notification').replace(/SendMail/i, 'Send notification');
    t = t.replace(/^Log\s*Message\b/i, 'Record log').replace(/^LogMessage/i, 'Record log');
    t = t.replace(/^For\s*Each\b/i, 'For each');
    t = t.replace(/^If\b/i, 'Check whether');
    t = t.replace(/^Throw\b/i, 'Raise exception:');
    return t;
}
function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// ----------------------------------------------------------------------------
// REFramework state machine — the canonical 4-state process design diagram.
// ----------------------------------------------------------------------------
/**
 * THE single decision point for a project's process-design diagram. Both the SDD
 * exporter and any test call this, so a project always renders the same way with
 * no per-project tuning:
 *   1. real parsed StateMachine  -> code-derived state chart
 *   2. REFramework (by layout/keyword) -> state swimlane from high-level steps
 *   3. everything else (Flowchart/Sequence) -> high-level technical flow
 * `steps` are the project's high-level business steps (LLM or derived); only the
 * REFramework-without-a-parsed-machine branch needs them.
 */
function renderEntryDiagram(projectName, graph, steps = [], stateSteps) {
    if (graph.stateMachine && graph.stateMachine.states.length) {
        return renderStateMachine(projectName, graph.stateMachine, graph.workflowApps, stateSteps);
    }
    const reframework = graph.layout === 'statemachine' || (!graph.layout && isReframework(graph));
    if (reframework) {
        return steps.some((s) => s && s.trim()) ? renderPartitionedFlow(projectName, steps) : renderReframeworkStates();
    }
    // Non-REFramework (linear / flowchart): prefer the concise, business-level
    // high-level steps (from the analyzer) over an activity-by-activity dump.
    if (hasHighLevelSteps(steps))
        return renderHighLevelFlow(projectName, steps);
    return renderTechnicalFlow(projectName, graph);
}
/** True when the project is built on the UiPath REFramework (state machine). */
function isReframework(graph) {
    const ctx = graph.projectContext;
    const hay = [
        ctx?.architecture,
        ctx?.overview?.description,
        ctx?.overview?.type,
        ...(ctx?.keyWorkflows?.map((w) => `${w.workflow} ${w.purpose ?? ''}`) ?? []),
        ...graph.invocations.map((i) => i.target),
        ...graph.nodes.map((n) => n.displayName),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    // Strong structural signals (the REFramework state workflows themselves).
    if (/reframework|robotic enterprise framework|gettransactiondata|settransactionstatus|initallsettings/.test(hay)) {
        return true;
    }
    // Naming convention: a "Performer" (the transactional processor half of the
    // Dispatcher/Performer pattern) is a REFramework project by convention — even
    // for a thin project whose workflows weren't parsed. A "Dispatcher" is NOT
    // (it only enqueues), so it stays a plain flowchart.
    const name = (graph.projectName || '').toLowerCase();
    if (/\bperformer\b|_performer|performer$/.test(name))
        return true;
    return false;
}
/**
 * Render the four REFramework states (Initialize, Get Transaction Data, Process
 * Transaction, End Process) as a labelled state-machine diagram — the standard
 * technical process-design view for a REFramework solution.
 */
function renderReframeworkStates() {
    const W = 760;
    const H = 470;
    const bw = 240;
    const bh = 96;
    // 2×2 grid centres.
    const colL = 30 + bw / 2;
    const colR = W - 30 - bw / 2;
    const rowT = 70 + bh / 2;
    const rowB = H - 60 - bh / 2;
    const states = {
        init: { cx: colL, cy: rowT, title: 'Initialization', sub: 'Read config, open applications', fill: '#2E7D32' },
        get: { cx: colR, cy: rowT, title: 'Get Transaction Data', sub: 'Fetch next item to process', fill: '#1565C0' },
        proc: { cx: colR, cy: rowB, title: 'Process Transaction', sub: 'Execute the business logic', fill: '#6A1B9A' },
        end: { cx: colL, cy: rowB, title: 'End Process', sub: 'Close applications, finalise', fill: '#B00020' },
    };
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`, `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" fill="#37474F"/></marker></defs>`, `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`, `<text x="${W / 2}" y="34" fill="#263238" font-size="17" font-weight="700" text-anchor="middle">REFramework — State Machine</text>`);
    const arrow = (x1, y1, x2, y2, label, lx, ly, dashed = false) => `<path d="M${x1},${y1} L${x2},${y2}" fill="none" stroke="#37474F" stroke-width="1.8" ${dashed ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#arrow)"/>` +
        `<rect x="${lx - label.length * 3.4 - 4}" y="${ly - 11}" width="${label.length * 6.8 + 8}" height="16" rx="3" fill="#FFFFFF" opacity="0.92"/>` +
        `<text x="${lx}" y="${ly + 1}" fill="#37474F" font-size="10.5" font-weight="600" text-anchor="middle">${esc(label)}</text>`;
    // Init → Get (top edge)
    parts.push(arrow(states.init.cx + bw / 2, rowT, states.get.cx - bw / 2, rowT, 'Success', W / 2, rowT - 8));
    // Init → End (left edge, error)
    parts.push(arrow(states.init.cx, rowT + bh / 2, states.end.cx, rowB - bh / 2, 'System error', colL, (rowT + rowB) / 2));
    // Get → Process (right edge, new transaction) — offset left
    parts.push(arrow(states.get.cx - 26, rowT + bh / 2, states.proc.cx - 26, rowB - bh / 2, 'New transaction', colR - 78, (rowT + rowB) / 2 - 8));
    // Process → Get (loop back) — offset right
    parts.push(arrow(states.proc.cx + 26, rowB - bh / 2, states.get.cx + 26, rowT + bh / 2, 'Next item', colR + 62, (rowT + rowB) / 2 + 10, true));
    // Get → End (diagonal, no data)
    parts.push(arrow(states.get.cx - bw / 2, rowT + 8, states.end.cx + bw / 2, rowB - 8, 'No more data', W / 2 + 40, (rowT + rowB) / 2 + 6));
    for (const s of Object.values(states)) {
        parts.push(`<rect x="${s.cx - bw / 2}" y="${s.cy - bh / 2}" width="${bw}" height="${bh}" rx="12" ry="12" fill="${s.fill}"/>`, `<text x="${s.cx}" y="${s.cy - 6}" fill="#FFFFFF" font-size="16" font-weight="700" text-anchor="middle">${esc(s.title)}</text>`, `<text x="${s.cx}" y="${s.cy + 16}" fill="#FFFFFF" font-size="11" text-anchor="middle" opacity="0.9">${esc(s.sub)}</text>`);
    }
    parts.push('</svg>');
    const resvg = new resvg_js_1.Resvg(parts.join(''), { fitTo: { mode: 'width', value: W * 2 } });
    return { png: Buffer.from(resvg.render().asPng()), width: W, height: H };
}
/**
 * Render a component/architecture diagram: the automation (centre) connected to
 * the Orchestrator (top) and each external system (right column), with the
 * access method labelled on the connector.
 */
function renderArchitecture(projectName, systems) {
    const list = systems.slice(0, 7);
    const orch = list.find((s) => /orchestrator/i.test(s.name));
    const others = list.filter((s) => s !== orch);
    const boxW = 250;
    const boxH = 58;
    const rightX = 720 - boxW; // right column x
    const centreX = 60;
    const gap = 22;
    const topY = orch ? 96 : 40;
    const H = Math.max(topY + Math.max(others.length, 1) * (boxH + gap) + 30, 260);
    const W = 760;
    const robotCy = topY + (others.length * (boxH + gap)) / 2;
    const robotCx = centreX + boxW / 2;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`, `<defs><marker id="arrt" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" fill="#37474F"/></marker>` +
        `<marker id="arst" markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M8,0 L0,3 L8,6 z" fill="#37474F"/></marker></defs>`, `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`);
    const sysBox = (x, cy, s, fill) => `<rect x="${x}" y="${cy - boxH / 2}" width="${boxW}" height="${boxH}" rx="9" fill="${fill}"/>` +
        `<text x="${x + boxW / 2}" y="${cy + (s.method ? -3 : 5)}" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">${esc(truncate(s.name, 30))}</text>` +
        (s.method ? `<text x="${x + boxW / 2}" y="${cy + 15}" fill="#FFFFFF" font-size="10" text-anchor="middle" opacity="0.9">via ${esc(s.method)}</text>` : '');
    // Orchestrator on top → robot.
    if (orch) {
        const ocx = robotCx;
        parts.push(sysBox(ocx - boxW / 2, topY - 40, orch, '#37474F'));
        parts.push(`<path d="M${ocx},${topY - 40 + boxH / 2} L${ocx},${robotCy - boxH / 2}" fill="none" stroke="#37474F" stroke-width="1.8" marker-end="url(#arrt)"/>`);
    }
    // Robot (centre-left).
    parts.push(`<rect x="${centreX}" y="${robotCy - boxH / 2 - 6}" width="${boxW}" height="${boxH + 12}" rx="12" fill="#0D47A1"/>`, `<text x="${robotCx}" y="${robotCy - 4}" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">UiPath Robot</text>`, `<text x="${robotCx}" y="${robotCy + 14}" fill="#FFFFFF" font-size="11" text-anchor="middle" opacity="0.9">${esc(truncate(projectName, 30))}</text>`);
    // External systems on the right, bidirectional connector to the robot.
    const colors = ['#1565C0', '#00838F', '#6A1B9A', '#2E7D32', '#B71C1C', '#795548', '#283593'];
    others.forEach((s, i) => {
        const cy = topY + i * (boxH + gap) + boxH / 2;
        parts.push(sysBox(rightX, cy, s, colors[i % colors.length]));
        parts.push(`<path d="M${robotCx + boxW / 2},${robotCy} L${rightX},${cy}" fill="none" stroke="#37474F" stroke-width="1.6" marker-end="url(#arrt)" marker-start="url(#arst)"/>`);
    });
    parts.push('</svg>');
    const resvg = new resvg_js_1.Resvg(parts.join(''), { fitTo: { mode: 'width', value: W * 2 } });
    return { png: Buffer.from(resvg.render().asPng()), width: W, height: H };
}
// ----------------------------------------------------------------------------
// Agentic diagrams — the AI Agent lifecycle and its ecosystem.
// ----------------------------------------------------------------------------
/** Wrap text into up to `maxLines` centered <text> lines of ~`perLine` chars. */
function wrapTspans(text, cx, y0, perLine, lineH, maxLines, fontSize, color, weight = '600') {
    const words = esc(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
        if ((cur + ' ' + w).trim().length > perLine && cur) {
            lines.push(cur);
            cur = w;
            if (lines.length === maxLines - 1)
                break;
        }
        else {
            cur = (cur + ' ' + w).trim();
        }
    }
    if (cur && lines.length < maxLines)
        lines.push(cur);
    return lines
        .map((ln, i) => `<text x="${cx}" y="${y0 + i * lineH}" fill="${color}" font-size="${fontSize}" font-weight="${weight}" text-anchor="middle">${ln}</text>`)
        .join('');
}
/**
 * Render the high-level AI Agent lifecycle: an Orchestrator/Maestro band on top,
 * a vertical spine (Trigger → Agent → Guardrails → Output), the agent's tools
 * and knowledge as a reasoning loop on the right, and a human-in-the-loop
 * escalation branch. Content is grounded in the parsed AgentSpec.
 */
function renderAgenticFlow(agentName, spec) {
    const W = 820;
    const spineX = 250;
    const spineW = 300;
    const rightX = 520;
    const rightW = 270;
    const model = spec?.model?.name || 'LLM (to be confirmed)';
    const inputs = spec?.inputs?.length ? spec.inputs.slice(0, 3).map((a) => a.name).join(', ') : 'user request / trigger payload';
    const outputs = spec?.outputs?.length ? spec.outputs.slice(0, 3).map((a) => a.name).join(', ') : 'structured response';
    const tools = spec?.tools?.length ? spec.tools.slice(0, 4).map((t) => t.name).join(', ') : 'RPA / API workflows, integrations';
    const knowledge = spec?.knowledge?.length ? spec.knowledge.slice(0, 3).map((k) => k.name).join(', ') : 'context grounding / memory';
    const escalation = spec?.escalations?.length ? spec.escalations.slice(0, 2).map((e) => e.name).join(', ') : 'Action Center approval';
    const bandY = 20;
    const bandH = 40;
    const boxH = 74;
    const gap = 46;
    const startY = bandY + bandH + 34;
    const spineBoxes = [
        { title: 'Trigger / User Input', sub: inputs, fill: '#2E7D32', dark: false },
        { title: 'AI Agent — Reason & Plan', sub: `Model: ${model}`, fill: '#0D47A1', dark: false },
        { title: 'Guardrails / AI Trust Layer', sub: 'Policy & safety checks', fill: '#F9A825', dark: true },
        { title: 'Response / Output', sub: outputs, fill: '#00695C', dark: false },
    ];
    const cyOf = (i) => startY + i * (boxH + gap) + boxH / 2;
    const H = cyOf(spineBoxes.length - 1) + boxH / 2 + 30;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`, `<defs><marker id="aarr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" fill="#37474F"/></marker>` +
        `<marker id="aback" markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M8,0 L0,3 L8,6 z" fill="#37474F"/></marker></defs>`, `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`);
    parts.push(`<rect x="30" y="${bandY}" width="${W - 60}" height="${bandH}" rx="8" fill="#37474F"/>`, `<text x="${W / 2}" y="${bandY + bandH / 2 + 5}" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">UiPath Orchestrator / Maestro — orchestration, routing &amp; governance</text>`);
    for (let i = 0; i < spineBoxes.length - 1; i++) {
        parts.push(`<line x1="${spineX}" y1="${cyOf(i) + boxH / 2}" x2="${spineX}" y2="${cyOf(i + 1) - boxH / 2 - 2}" stroke="#37474F" stroke-width="1.8" marker-end="url(#aarr)"/>`);
    }
    parts.push(`<line x1="${spineX}" y1="${bandY + bandH}" x2="${spineX}" y2="${cyOf(0) - boxH / 2 - 2}" stroke="#37474F" stroke-width="1.4" stroke-dasharray="4 3" marker-end="url(#aarr)"/>`);
    const box = (x, cy, w, h, title, sub, fill, dark = false) => {
        const color = dark ? '#212121' : '#FFFFFF';
        return (`<rect x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="10" fill="${fill}"/>` +
            wrapTspans(title, x + w / 2, cy - (sub ? 4 : -4), Math.floor(w / 8), 16, 2, 14, color, '700') +
            (sub ? `<text x="${x + w / 2}" y="${cy + 20}" fill="${color}" font-size="10.5" text-anchor="middle" opacity="0.92">${esc(truncate(sub, Math.floor(w / 6)))}</text>` : ''));
    };
    const agentCy = cyOf(1);
    const capH = 56;
    const cap1Cy = agentCy - capH / 2 - 6;
    const cap2Cy = agentCy + capH / 2 + 6;
    parts.push(box(rightX, cap1Cy, rightW, capH, 'Tools & Integrations', tools, '#00838F'));
    parts.push(box(rightX, cap2Cy, rightW, capH, 'Context & Knowledge', knowledge, '#283593'));
    parts.push(`<path d="M${spineX + spineW / 2},${agentCy - 8} L${rightX},${cap1Cy}" fill="none" stroke="#37474F" stroke-width="1.5" marker-end="url(#aarr)" marker-start="url(#aback)"/>`);
    parts.push(`<path d="M${spineX + spineW / 2},${agentCy + 8} L${rightX},${cap2Cy}" fill="none" stroke="#37474F" stroke-width="1.5" marker-end="url(#aarr)" marker-start="url(#aback)"/>`);
    const guardCy = cyOf(2);
    parts.push(box(rightX, guardCy, rightW, capH, 'Human-in-the-Loop', escalation, '#B00020'));
    parts.push(`<path d="M${spineX + spineW / 2},${guardCy} L${rightX},${guardCy}" fill="none" stroke="#B00020" stroke-width="1.6" marker-end="url(#aarr)"/>`, `<rect x="${(spineX + spineW / 2 + rightX) / 2 - 26}" y="${guardCy - 20}" width="52" height="15" rx="3" fill="#FFFFFF"/>`, `<text x="${(spineX + spineW / 2 + rightX) / 2}" y="${guardCy - 9}" fill="#B00020" font-size="10" font-weight="700" text-anchor="middle">escalate</text>`);
    spineBoxes.forEach((b, i) => parts.push(box(spineX - spineW / 2, cyOf(i), spineW, boxH, b.title, b.sub, b.fill, b.dark)));
    parts.push('</svg>');
    const resvg = new resvg_js_1.Resvg(parts.join(''), { fitTo: { mode: 'width', value: W * 2 } });
    void agentName;
    return { png: Buffer.from(resvg.render().asPng()), width: W, height: H };
}
/**
 * Render the agentic ecosystem: the AI Agent at the centre, connected to the
 * Orchestrator/Maestro (top) and the tools, knowledge sources, escalation
 * targets and RPA/API integrations it collaborates with (right column).
 */
function renderAgenticEcosystem(agentName, spec) {
    const spokes = [];
    const toolNames = (spec?.tools ?? []).map((t) => t.name);
    if (toolNames.length)
        spokes.push({ name: 'Tools & Integrations', sub: toolNames.slice(0, 3).join(', '), fill: '#00838F' });
    if (spec?.knowledge?.length)
        spokes.push({ name: 'Context & Knowledge', sub: spec.knowledge.slice(0, 3).map((k) => k.name).join(', '), fill: '#283593' });
    if (spec?.escalations?.length)
        spokes.push({ name: 'Human-in-the-Loop', sub: spec.escalations.slice(0, 2).map((e) => e.name).join(', '), fill: '#B00020' });
    spokes.push({ name: 'RPA Bots / API Workflows', sub: 'Invoked as tools', fill: '#6A1B9A' });
    spokes.push({ name: 'Business Users / Systems', sub: 'Consume the agent', fill: '#2E7D32' });
    const list = spokes.slice(0, 6);
    const boxW = 260;
    const boxH = 58;
    const gap = 22;
    const rightX = 780 - boxW;
    const centreX = 60;
    const topY = 96;
    const W = 820;
    const H = Math.max(topY + list.length * (boxH + gap) + 30, 280);
    const agentCy = topY + (list.length * (boxH + gap)) / 2 - gap / 2;
    const agentCx = centreX + boxW / 2;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`, `<defs><marker id="earr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" fill="#37474F"/></marker>` +
        `<marker id="eback" markerWidth="10" markerHeight="10" refX="1" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M8,0 L0,3 L8,6 z" fill="#37474F"/></marker></defs>`, `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`);
    const sysBox = (x, cy, name, sub, fill) => `<rect x="${x}" y="${cy - boxH / 2}" width="${boxW}" height="${boxH}" rx="9" fill="${fill}"/>` +
        `<text x="${x + boxW / 2}" y="${cy + (sub ? -3 : 5)}" fill="#FFFFFF" font-size="13" font-weight="700" text-anchor="middle">${esc(truncate(name, 30))}</text>` +
        (sub ? `<text x="${x + boxW / 2}" y="${cy + 15}" fill="#FFFFFF" font-size="10" text-anchor="middle" opacity="0.9">${esc(truncate(sub, 34))}</text>` : '');
    parts.push(sysBox(agentCx - boxW / 2, topY - 56, 'UiPath Orchestrator / Maestro', 'Deploy, route, govern', '#37474F'));
    parts.push(`<path d="M${agentCx},${topY - 56 + boxH / 2} L${agentCx},${agentCy - boxH / 2 - 6}" fill="none" stroke="#37474F" stroke-width="1.8" marker-end="url(#earr)"/>`);
    parts.push(`<rect x="${centreX}" y="${agentCy - boxH / 2 - 8}" width="${boxW}" height="${boxH + 16}" rx="12" fill="#0D47A1"/>`, `<text x="${agentCx}" y="${agentCy - 4}" fill="#FFFFFF" font-size="15" font-weight="700" text-anchor="middle">AI Agent</text>`, `<text x="${agentCx}" y="${agentCy + 15}" fill="#FFFFFF" font-size="11" text-anchor="middle" opacity="0.92">${esc(truncate(agentName, 30))}</text>`);
    list.forEach((s, i) => {
        const cy = topY + i * (boxH + gap) + boxH / 2;
        parts.push(sysBox(rightX, cy, s.name, s.sub, s.fill));
        parts.push(`<path d="M${agentCx + boxW / 2},${agentCy} L${rightX},${cy}" fill="none" stroke="#37474F" stroke-width="1.5" marker-end="url(#earr)" marker-start="url(#eback)"/>`);
    });
    parts.push('</svg>');
    const resvg = new resvg_js_1.Resvg(parts.join(''), { fitTo: { mode: 'width', value: W * 2 } });
    return { png: Buffer.from(resvg.render().asPng()), width: W, height: H };
}
const PF = {
    NODE_W: 250,
    NODE_H: 52,
    DEC_W: 250,
    DEC_H: 76,
    VGAP: 30,
    HGAP: 46,
    LABEL_H: 18,
    ARROW: '#37474F',
    MAX_NODES: 60,
};
function renderProcessFlow(graph) {
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const kids = new Map();
    for (const n of graph.nodes) {
        const p = n.raw?.parentId ?? undefined;
        if (!kids.has(p))
            kids.set(p, []);
        kids.get(p).push(n);
    }
    void byId;
    const buildBlock = (parentId) => {
        const items = [];
        for (const child of kids.get(parentId) ?? []) {
            if (child.kind === 'sequence') {
                items.push(...buildBlock(child.id));
                continue;
            }
            items.push(buildItem(child));
        }
        return items;
    };
    const expand = (nodes) => {
        const items = [];
        for (const n of nodes) {
            if (n.kind === 'sequence')
                items.push(...buildBlock(n.id));
            else
                items.push(buildItem(n));
        }
        return items;
    };
    const groupBranches = (children) => {
        const groups = [];
        let cur = null;
        for (const c of children) {
            const b = c.raw?.branch;
            if (b || !cur) {
                cur = { label: b, nodes: [] };
                groups.push(cur);
            }
            cur.nodes.push(c);
        }
        return groups.map((g) => ({ label: g.label, block: expand(g.nodes) }));
    };
    const buildItem = (node) => {
        const ch = kids.get(node.id) ?? [];
        if (node.kind === 'if' || node.kind === 'switch')
            return { t: 'branchy', head: node, shape: 'diamond', branches: groupBranches(ch) };
        if (node.kind === 'loop')
            return { t: 'loop', head: node, body: buildBlock(node.id) };
        if (node.raw?.activity === 'TryCatch')
            return { t: 'branchy', head: node, shape: 'rect', branches: groupBranches(ch) };
        if (ch.length)
            return { t: 'loop', head: node, body: buildBlock(node.id) };
        return { t: 'step', node };
    };
    // Roots: top-level nodes (no parent). Flatten container sequences.
    const roots = kids.get(undefined) ?? [];
    let block = expand(roots);
    let truncated = 0;
    { // Cap total rendered nodes so very large processes stay legible.
        let count = 0;
        const trim = (items) => {
            const out = [];
            for (const it of items) {
                if (count >= PF.MAX_NODES) {
                    truncated++;
                    continue;
                }
                count++;
                if (it.t === 'branchy')
                    out.push({ ...it, branches: it.branches.map((b) => ({ ...b, block: trim(b.block) })) });
                else if (it.t === 'loop')
                    out.push({ ...it, body: trim(it.body) });
                else
                    out.push(it);
            }
            return out;
        };
        block = trim(block);
    }
    const body = layoutBlock(block);
    // Start / End terminators wrapping the body.
    const term = (label, fill, cx) => {
        const w = 130, h = 40;
        return { svg: `<rect x="${cx - w / 2}" y="0" width="${w}" height="${h}" rx="20" fill="${fill}"/><text x="${cx}" y="26" fill="#fff" font-size="15" font-weight="700" text-anchor="middle">${esc(label)}</text>`, w, h, cx };
    };
    const spineX = body.cx;
    const start = term('Start', '#2E7D32', spineX);
    const end = term('End', '#B00020', spineX);
    const pad = 24;
    const totalW = Math.max(body.w, 130) + pad * 2;
    let y = pad;
    const parts = [];
    const place = (l, dx, dy) => parts.push(`<g transform="translate(${dx},${dy})">${l.svg}</g>`);
    const vline = (x, y1, y2) => parts.push(`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 2}" stroke="${PF.ARROW}" stroke-width="1.7" marker-end="url(#pfarr)"/>`);
    place(start, pad, y);
    let prevBottom = y + start.h;
    y += start.h + PF.VGAP;
    vline(pad + spineX, prevBottom, y);
    place(body, pad, y);
    prevBottom = y + body.h;
    y += body.h + PF.VGAP;
    vline(pad + spineX, prevBottom, y);
    place(end, pad, y);
    y += end.h;
    if (truncated) {
        y += 18;
        parts.push(`<text x="${pad + spineX}" y="${y}" fill="#78909C" font-size="11" font-style="italic" text-anchor="middle">… ${truncated} further step(s) omitted for readability</text>`);
        y += 6;
    }
    const totalH = y + pad;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}" font-family="Segoe UI, Arial, sans-serif">` +
        `<defs><marker id="pfarr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" fill="${PF.ARROW}"/></marker></defs>` +
        `<rect x="0" y="0" width="${totalW}" height="${totalH}" fill="#FFFFFF"/>` +
        parts.join('') +
        `</svg>`;
    const resvg = new resvg_js_1.Resvg(svg, { fitTo: { mode: 'width', value: totalW * 2 } });
    return { png: Buffer.from(resvg.render().asPng()), width: totalW, height: totalH };
}
function layoutBlock(items) {
    if (!items.length)
        return { svg: '', w: PF.NODE_W, h: 0, cx: PF.NODE_W / 2 };
    const laid = items.map(layoutItem);
    const spineX = Math.max(...laid.map((l) => l.cx));
    const parts = [];
    let y = 0;
    let maxRight = 0;
    let prevBottom = -1;
    for (const l of laid) {
        if (prevBottom >= 0) {
            parts.push(`<line x1="${spineX}" y1="${prevBottom}" x2="${spineX}" y2="${y - 2}" stroke="${PF.ARROW}" stroke-width="1.7" marker-end="url(#pfarr)"/>`);
        }
        const dx = spineX - l.cx;
        parts.push(`<g transform="translate(${dx},${y})">${l.svg}</g>`);
        maxRight = Math.max(maxRight, dx + l.w);
        prevBottom = y + l.h;
        y = prevBottom + PF.VGAP;
    }
    return { svg: parts.join(''), w: maxRight, h: prevBottom, cx: spineX };
}
function layoutItem(item) {
    if (item.t === 'step')
        return layoutStep(item.node);
    if (item.t === 'loop')
        return layoutLoop(item);
    return layoutBranchy(item);
}
function stepColor(node) {
    return FILL[node.kind] ?? FILL.other;
}
function nodeBox(node, w, h) {
    const fill = stepColor(node);
    const tag = node.raw?.activity === 'TryCatch' ? 'Try / Catch' : LABEL[node.kind] ?? 'Step';
    const title = businessLabel(node.displayName);
    return (`<rect x="0" y="0" width="${w}" height="${h}" rx="8" fill="${fill}"/>` +
        `<text x="${w / 2}" y="15" fill="#FFFFFF" font-size="9" font-weight="700" letter-spacing="0.5" text-anchor="middle" opacity="0.85">${esc(tag.toUpperCase())}</text>` +
        wrapTspans(title, w / 2, 30, Math.floor(w / 6.6), 12, 2, 12, '#FFFFFF', '600'));
}
function layoutStep(node) {
    return { svg: nodeBox(node, PF.NODE_W, PF.NODE_H), w: PF.NODE_W, h: PF.NODE_H, cx: PF.NODE_W / 2 };
}
function layoutLoop(item) {
    const headW = PF.NODE_W, headH = PF.NODE_H;
    const body = layoutBlock(item.body);
    const returnMargin = 34;
    const spineX = Math.max(headW / 2, body.cx);
    const headX = spineX - headW / 2;
    const branchTop = headH + PF.VGAP;
    const bodyDx = spineX - body.cx;
    const bottom = body.h ? branchTop + body.h : headH;
    const w = Math.max(headX + headW, bodyDx + body.w) + returnMargin;
    const parts = [];
    parts.push(`<g transform="translate(${headX},0)">${nodeBox(item.head, headW, headH)}</g>`);
    if (body.h) {
        parts.push(`<line x1="${spineX}" y1="${headH}" x2="${spineX}" y2="${branchTop - 2}" stroke="${PF.ARROW}" stroke-width="1.7" marker-end="url(#pfarr)"/>`);
        parts.push(`<g transform="translate(${bodyDx},${branchTop})">${body.svg}</g>`);
        // Dashed loop-back arrow up the right side.
        const rx = Math.max(headX + headW, bodyDx + body.w) + 16;
        parts.push(`<path d="M${spineX},${bottom} L${rx},${bottom} L${rx},${headH / 2} L${headX + headW + 2},${headH / 2}" fill="none" stroke="${PF.ARROW}" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#pfarr)"/>`);
        parts.push(`<text x="${rx}" y="${(bottom + headH / 2) / 2}" fill="#78909C" font-size="9" text-anchor="middle" transform="rotate(90 ${rx} ${(bottom + headH / 2) / 2})">loop</text>`);
    }
    return { svg: parts.join(''), w, h: bottom, cx: spineX };
}
function layoutBranchy(item) {
    const isDiamond = item.shape === 'diamond';
    const headW = isDiamond ? PF.DEC_W : PF.NODE_W;
    const headH = isDiamond ? PF.DEC_H : PF.NODE_H;
    const branchLaid = item.branches.map((b) => ({ label: b.label, L: layoutBlock(b.block) }));
    const main = branchLaid[0] ?? { label: undefined, L: layoutBlock([]) };
    const others = branchLaid.slice(1);
    const spineX = Math.max(headW / 2, main.L.cx);
    const headX = spineX - headW / 2;
    const branchTop = headH + PF.VGAP + PF.LABEL_H;
    const parts = [];
    // Head shape.
    if (isDiamond)
        parts.push(headDiamond(item.head, headW, headH));
    else
        parts.push(`<g transform="translate(${headX},0)">${nodeBox(item.head, headW, headH)}</g>`);
    // Main branch straight down the spine.
    const mainDx = spineX - main.L.cx;
    parts.push(`<line x1="${spineX}" y1="${headH}" x2="${spineX}" y2="${branchTop - 2}" stroke="${PF.ARROW}" stroke-width="1.7" marker-end="url(#pfarr)"/>`);
    if (main.label)
        parts.push(branchLabel(spineX, headH + 12, main.label));
    parts.push(`<g transform="translate(${mainDx},${branchTop})">${main.L.svg}</g>`);
    const bottoms = [{ x: spineX, y: branchTop + main.L.h }];
    let cursorRight = Math.max(headX + headW, mainDx + main.L.w);
    // Other branches to the right.
    for (const o of others) {
        const oX = cursorRight + PF.HGAP;
        const oEntry = oX + o.L.cx;
        parts.push(`<path d="M${spineX},${headH} L${spineX},${branchTop - PF.LABEL_H} L${oEntry},${branchTop - PF.LABEL_H} L${oEntry},${branchTop - 2}" fill="none" stroke="${PF.ARROW}" stroke-width="1.5" marker-end="url(#pfarr)"/>`);
        if (o.label)
            parts.push(branchLabel((spineX + oEntry) / 2, branchTop - PF.LABEL_H - 4, o.label));
        parts.push(`<g transform="translate(${oX},${branchTop})">${o.L.svg}</g>`);
        bottoms.push({ x: oEntry, y: branchTop + o.L.h });
        cursorRight = oX + o.L.w;
    }
    const branchesBottom = Math.max(...bottoms.map((b) => b.y));
    const mergeY = branchesBottom + PF.VGAP;
    // Merge all branch exits down to the spine.
    for (const b of bottoms) {
        if (b.x === spineX)
            parts.push(`<line x1="${spineX}" y1="${b.y}" x2="${spineX}" y2="${mergeY}" stroke="${PF.ARROW}" stroke-width="1.5"/>`);
        else
            parts.push(`<path d="M${b.x},${b.y} L${b.x},${mergeY} L${spineX},${mergeY}" fill="none" stroke="${PF.ARROW}" stroke-width="1.5"/>`);
    }
    return { svg: parts.join(''), w: cursorRight, h: mergeY, cx: spineX };
}
function headDiamond(node, w, h) {
    const cx = w / 2, cy = h / 2, hw = w / 2, hh = h / 2;
    const fill = FILL[node.kind] ?? '#F9A825';
    const cond = node.raw?.condition ? truncate(String(node.raw.condition), 40) : '';
    const title = truncate(businessLabel(node.displayName), 34);
    return (`<polygon points="${cx},0 ${w},${cy} ${cx},${h} 0,${cy}" fill="${fill}" stroke="#00000022"/>` +
        `<text x="${cx}" y="${cy - (cond ? 5 : 4)}" fill="#212121" font-size="11" font-weight="700" text-anchor="middle">${esc(title)}</text>` +
        (cond ? `<text x="${cx}" y="${cy + 12}" fill="#212121" font-size="9" text-anchor="middle" opacity="0.85">${esc(cond)}</text>` : ''));
}
function branchLabel(x, y, label) {
    const w = label.length * 6.4 + 10;
    return (`<rect x="${x - w / 2}" y="${y - 11}" width="${w}" height="15" rx="3" fill="#FFFFFF" stroke="#CFD8DC" stroke-width="0.75"/>` +
        `<text x="${x}" y="${y}" fill="#37474F" font-size="9.5" font-weight="700" text-anchor="middle">${esc(label)}</text>`);
}
// ----------------------------------------------------------------------------
// High-level process flow — a concise, business-readable Start → steps → End
// flow from the analyst-provided high-level steps (not framework plumbing).
// ----------------------------------------------------------------------------
/** True when we have enough high-level steps to draw a meaningful flow. */
function hasHighLevelSteps(steps) {
    return !!steps && steps.filter((s) => s && s.trim()).length >= 2;
}
/**
 * Render a clean, numbered high-level process flow (Start → business steps →
 * End). Deliberately concise — one box per high-level step, labels wrap.
 */
function renderHighLevelFlow(title, stepsIn) {
    const steps = stepsIn.map((s) => s.trim()).filter(Boolean).slice(0, 14);
    const W = 620;
    const cx = W / 2;
    const boxW = 420;
    const termW = 150;
    const termH = 44;
    const stepH = 54;
    const gap = 26;
    const padTop = 54;
    const padBot = 26;
    const palette = ['#1565C0', '#00838F', '#6A1B9A', '#283593', '#2E7D32', '#00695C', '#455A64', '#4527A0'];
    const rows = steps.length + 2; // start + steps + end
    const heights = [termH, ...steps.map(() => stepH), termH];
    let H = padTop + padBot;
    heights.forEach((h, i) => { H += h; if (i < rows - 1)
        H += gap; });
    const centers = [];
    let y = padTop;
    for (let i = 0; i < rows; i++) {
        centers.push(y + heights[i] / 2);
        y += heights[i] + gap;
    }
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`, `<defs><marker id="hlarr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" fill="#37474F"/></marker></defs>`, `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`, `<text x="${cx}" y="30" fill="#263238" font-size="15" font-weight="700" text-anchor="middle">High-level process flow${title ? ` — ${esc(truncate(title, 40))}` : ''}</text>`);
    // Connectors.
    for (let i = 0; i < rows - 1; i++) {
        parts.push(`<line x1="${cx}" y1="${centers[i] + heights[i] / 2}" x2="${cx}" y2="${centers[i + 1] - heights[i + 1] / 2 - 2}" stroke="#37474F" stroke-width="1.7" marker-end="url(#hlarr)"/>`);
    }
    // Start.
    parts.push(`<rect x="${cx - termW / 2}" y="${centers[0] - termH / 2}" width="${termW}" height="${termH}" rx="${termH / 2}" fill="#2E7D32"/>`, `<text x="${cx}" y="${centers[0] + 5}" fill="#fff" font-size="15" font-weight="700" text-anchor="middle">Start</text>`);
    // Steps.
    steps.forEach((s, i) => {
        const cy = centers[i + 1];
        const fill = palette[i % palette.length];
        const x = cx - boxW / 2;
        parts.push(`<rect x="${x}" y="${cy - stepH / 2}" width="${boxW}" height="${stepH}" rx="9" fill="${fill}"/>`);
        // Number badge.
        parts.push(`<circle cx="${x + 26}" cy="${cy}" r="15" fill="#FFFFFF" opacity="0.9"/>`, `<text x="${x + 26}" y="${cy + 5}" fill="${fill}" font-size="14" font-weight="700" text-anchor="middle">${i + 1}</text>`);
        parts.push(wrapTspans(s, x + 26 + (boxW - 52) / 2 + 6, cy - (s.length > 40 ? 4 : -4), Math.floor((boxW - 70) / 6.2), 15, 2, 13, '#FFFFFF', '600'));
    });
    // End.
    const eCy = centers[rows - 1];
    parts.push(`<rect x="${cx - termW / 2}" y="${eCy - termH / 2}" width="${termW}" height="${termH}" rx="${termH / 2}" fill="#B00020"/>`, `<text x="${cx}" y="${eCy + 5}" fill="#fff" font-size="15" font-weight="700" text-anchor="middle">End</text>`);
    parts.push('</svg>');
    const resvg = new resvg_js_1.Resvg(parts.join(''), { fitTo: { mode: 'width', value: W * 2 } });
    return { png: Buffer.from(resvg.render().asPng()), width: W, height: H };
}
// ----------------------------------------------------------------------------
// REFramework-partitioned high-level flow — the project's high-level steps
// grouped under the four REFramework states (Initialization / Get Transaction
// Data / Process Transaction / End Process), rather than a flat flowchart.
// Used per-project for dispatcher/performer solutions.
// ----------------------------------------------------------------------------
const SWIM_STATES = [
    { key: 'init', name: 'Init', color: '#2E7D32' },
    { key: 'get', name: 'Get Transaction Data', color: '#1565C0' },
    { key: 'process', name: 'Process Transaction', color: '#6A1B9A' },
    { key: 'end', name: 'End Process', color: '#B00020' },
];
/**
 * Bucket high-level steps into the four REFramework states. Position-aware:
 * in REFramework, everything up to the first transaction/queue fetch is part of
 * Initialization (app launch + navigation + reading input), the fetch itself is
 * Get Transaction Data, per-item work is Process Transaction, and teardown is
 * End Process. This mirrors how a real state machine assigns activities.
 */
function bucketSteps(steps) {
    const b = { init: [], get: [], process: [], end: [] };
    // Asset/config retrieval is Init even though it says "retrieve".
    const RX_INIT = /initiali|config|setting|open applic|launch|start ?up|kill ?process|read config|first run|authenticat|log ?in|sign ?in|obtain.*token|get.*token|credential|orchestrator|asset/i;
    // A genuine transaction fetch — must involve a queue/item/record/transaction, not just "retrieve".
    const RX_GET = /get ?transaction|get ?next|dequeue|queue ?item|read (the )?(queue|item|record|range|input)|next (item|transaction)|pick ?up.*(item|transaction)|input data|read data/i;
    const RX_END = /end ?process|close ?applic|clean ?up|cleanup|finali|log ?out|logout|kill ?all|tear ?down|close all|terminate|send.*(report|notification|summary)/i;
    const clean = steps.map((s) => (s || '').trim()).filter(Boolean);
    let seenGet = false;
    clean.forEach((s) => {
        if (RX_END.test(s) && seenGet)
            b.end.push(s); // teardown only counts after processing began
        else if (!seenGet && RX_GET.test(s)) {
            b.get.push(s);
            seenGet = true;
        }
        else if (!seenGet)
            b.init.push(s); // everything before the first fetch is setup
        else if (RX_END.test(s))
            b.end.push(s);
        else if (RX_GET.test(s))
            b.get.push(s);
        else
            b.process.push(s);
    });
    // If no explicit fetch was found, fall back to keyword-only split so Init isn't the whole list.
    if (!seenGet && b.process.length === 0) {
        b.init = [];
        clean.forEach((s, i) => {
            if (RX_END.test(s))
                b.end.push(s);
            else if (RX_INIT.test(s) || i === 0)
                b.init.push(s);
            else
                b.process.push(s);
        });
    }
    return b;
}
const PF_W = 920; // wide enough for the 4 REFramework state columns
function isDecisionStep(s) {
    // A decision is phrased as a question (ends with "?") or opens with an
    // interrogative/checking verb. Avoid matching action steps that merely
    // contain a noun like "success" or "exception" ("Set status to success").
    return /\?\s*$/.test(s) || /^(is|are|has|have|does|do|can|should|was|were|check|verify)\b/i.test(s.trim());
}
function svgDoc(w, h, inner) {
    return (`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Segoe UI, Arial, sans-serif">` +
        `<defs><marker id="pfarrow" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 z" fill="#607D8B"/></marker></defs>` +
        `<rect x="0" y="0" width="${w}" height="${h}" fill="#FFFFFF"/>${inner}</svg>`);
}
function rasterize(svg, w, h) {
    const resvg = new resvg_js_1.Resvg(svg, { fitTo: { mode: 'width', value: w * 2 } });
    return { png: Buffer.from(resvg.render().asPng()), width: w, height: h };
}
/** Ensure each REFramework lane has at least canonical steps when the LLM gave none. */
function bucketFallback(buckets) {
    return {
        init: buckets.init.length ? buckets.init : ['Initialize application', 'Read config & load settings', 'Retrieve Orchestrator assets'],
        get: buckets.get.length ? buckets.get : ['Get transaction data from queue'],
        process: buckets.process.length ? buckets.process : ['Process the transaction item'],
        end: buckets.end.length ? buckets.end : ['Close all applications', 'Send summary report'],
    };
}
/** Build the canonical REFramework node list for each lane, slotting real steps in. */
function buildLaneNodes(bucketsIn) {
    const b = bucketFallback(bucketsIn);
    const proc = (label, extra = {}) => ({ kind: 'process', label, ...extra });
    const dec = (label, sideLabel, sideTo, downLabel, exception, retry = false) => ({ kind: 'decision', label, sideLabel, sideTo, downLabel, exception, retry });
    // Init: Start → open/read → assets check (SE#1) → launch (retry) → app check (SE#2) → rest.
    const launchIdx = b.init.findIndex((s) => /launch|open applic|start ?up|navigate|log ?in|sign ?in/i.test(s));
    const launchLabel = launchIdx >= 0 ? b.init[launchIdx] : 'Launch business application';
    const head = b.init.filter((_, i) => i !== launchIdx).slice(0, 3);
    const tail = b.init.filter((_, i) => i !== launchIdx).slice(3);
    const init = [{ kind: 'terminal', label: 'Start' }];
    head.forEach((s) => init.push(proc(s)));
    init.push(dec('Config & assets retrieved?', 'NO', 'A', 'YES', 'SE#1'));
    init.push(proc(launchLabel));
    init.push(dec('Application accessible?', 'NO', 'A', 'YES', 'SE#2', true));
    tail.forEach((s) => init.push(proc(s)));
    // Get Transaction Data: (B re-entry) → new item? (NO→A) → assign to transaction item.
    const get = [{ kind: 'connector', label: 'B', entry: true }];
    get.push(dec('New transaction available?', 'NO', 'A', 'YES'));
    const getRest = b.get.slice();
    get.push(proc(getRest.shift() ?? 'Assign data to transaction item'));
    getRest.forEach((s) => get.push(proc(s)));
    // Process Transaction: steps with two business-rule branches (BE#1/BE#2 → B) → B.
    const process = [];
    const ps = b.process.slice(0, 8);
    const firstBox = ps.shift() ?? 'Open the transaction record';
    process.push(proc(firstBox));
    process.push(dec('Already processed?', 'Yes', 'B', 'No', 'BE#1'));
    const mid = ps.shift();
    if (mid)
        process.push(proc(mid));
    process.push(dec('Needs manual handling?', 'Yes', 'B', 'No', 'BE#2'));
    ps.forEach((s) => process.push(proc(s)));
    process.push({ kind: 'connector', label: 'B' });
    // End Process: (A entry) → system exception? → notify → log → close → terminate → END.
    const end = [{ kind: 'connector', label: 'A', entry: true }];
    end.push(dec('Is System Exception?', 'NO', 'A', 'YES'));
    end.push(proc('Send notification to RPA support team'));
    end.push(proc('Send notification to business user'));
    const closeStep = b.end.find((s) => /close|log ?out|kill/i.test(s));
    end.push(proc(b.end.find((s) => /log|report|summary/i.test(s)) ?? 'Log run summary'));
    end.push(proc(closeStep ?? 'Close all applications'));
    end.push(proc('Terminate the bot'));
    end.push({ kind: 'terminal', label: 'END' });
    return { init, get, process, end };
}
const TECH_STYLE = {
    ui: { tag: 'UI ACTION', color: '#1565C0', shape: 'box' },
    io: { tag: 'DATA I/O', color: '#00838F', shape: 'box' },
    decision: { tag: 'CHECK', color: '#EF6C00', shape: 'decision' },
    loop: { tag: 'LOOP', color: '#6A1B9A', shape: 'box' },
    invoke: { tag: 'SUB-PROCESS', color: '#283593', shape: 'box' },
    log: { tag: 'NOTIFY / LOG', color: '#546E7A', shape: 'box' },
    trycatch: { tag: 'ERROR HANDLING', color: '#8D6E63', shape: 'box' },
    assign: { tag: 'PREPARE DATA', color: '#455A64', shape: 'box' },
    step: { tag: 'STEP', color: '#37474F', shape: 'box' },
};
// Structural / plumbing display names that carry no business meaning.
const TECH_DROP = new Set([
    'Sequence', 'Do', 'Body', 'Catch', 'Target', 'TargetApp', 'TargetAnchorable',
    'AssignOperation', 'Target appears', 'Target does not appear', 'TargetControl',
    // WPF/view-state value types that occasionally leak through as bogus steps.
    'PointOffset', 'Point', 'Size', 'Rect', 'Region', 'Position', 'Padding', 'Margin',
]);
function techCategory(n) {
    const name = n.displayName;
    const k = n.kind;
    if (k === 'if' || k === 'switch')
        return 'decision';
    if (k === 'loop' || /\bfor each\b|\bwhile\b|\bdo while\b|\brepeat\b|\bretry scope\b/i.test(name))
        return 'loop';
    if (/try ?catch/i.test(name))
        return 'trycatch';
    if (k === 'invoke' || /\binvoke\b/i.test(name))
        return 'invoke';
    if (k === 'ui' || /\bclick\b|type into|get text|get attribute|check app state|use browser|go to url|navigate|select item|hover|send hotkey|set text|extract table|screenshot|attach browser|attach window/i.test(name))
        return 'ui';
    if (k === 'io' || /excel|workbook|read range|write range|write cell|read cell|data ?table|insert column|use excel|read csv|write csv|read text|write text|append line|read pdf|mail|outlook|send email|get email|word document|build data|filter data|for each excel/i.test(name))
        return 'io';
    if (k === 'log' || /message box|log message|log error|write line|report status|input dialog/i.test(name))
        return 'log';
    if (k === 'assign' || /\bassign\b|multiple assign|^set /i.test(name))
        return 'assign';
    return 'step';
}
/** Turn a raw activity display name into a clean, human-readable step label. */
function cleanTechLabel(cat, nameIn) {
    let s = nameIn.trim();
    // "Sequence 'X'" / "Flowchart 'X'" -> X ; strip stray quotes.
    s = s.replace(/^(Sequence|Flowchart|Do|Body)\s+'([^']+)'$/i, '$2').replace(/^'+|'+$/g, '').trim();
    if (cat === 'invoke') {
        const m = s.match(/([^\\/]+)\.xaml/i); // pull the workflow file's base name
        if (m)
            return `Invoke ${m[1].replace(/[_-]+/g, ' ')}`;
        s = s.replace(/\s*-?\s*invoke workflow file$/i, '').trim();
        return /^invoke/i.test(s) ? s : `Invoke ${s}`;
    }
    if (cat === 'assign') {
        let t = s.replace(/^Multiple Assign.*/i, 'Prepare data').replace(/^Assign\s+/i, '').replace(/^to\s+/i, '').replace(/^'+|'+$/g, '').trim();
        if (t === 'Prepare data')
            return t;
        // A code expression -> keep just the target identifier ("Set <var>").
        if (/[()=]|\.\w/.test(t) || t.length > 42) {
            const id = (t.match(/[A-Za-z_][A-Za-z0-9_]*/) || [])[0];
            return id ? `Set ${id}` : 'Prepare data';
        }
        return `Assign ${t}`;
    }
    // UI / IO / loop / log: strip a trailing code expression in parentheses.
    s = s.replace(/\s*\([^)]*$/, '').trim();
    return s;
}
/**
 * Reduce the parsed graph to a short, high-level list of technical steps for the
 * ENTRY workflow: keep meaningful activities (UI, data, decisions, loops,
 * sub-processes, notifications), collapse consecutive prepare-data assignments,
 * drop structural plumbing, and cap the length so the diagram stays readable.
 */
function techSteps(graph, max = 18) {
    const entry = (graph.entryPoints[0] || '').split(/[\\/]/).pop()?.toLowerCase();
    const inEntry = (n) => {
        const f = String(n.raw?.file ?? '').split(/[\\/]/).pop()?.toLowerCase();
        return !entry || !f ? true : f === entry;
    };
    // Prefer the entry workflow's activities; fall back to all if the entry has none.
    let pool = graph.nodes.filter(inEntry);
    if (pool.filter((n) => techCategory(n) !== 'assign' && !TECH_DROP.has(n.displayName)).length < 3)
        pool = graph.nodes;
    const hasTryCatch = pool.some((n) => /try ?catch/i.test(n.displayName));
    const raw = [];
    for (const n of pool) {
        if (TECH_DROP.has(n.displayName))
            continue;
        const cat = techCategory(n);
        if (cat === 'trycatch')
            continue; // shown as a single band, not a step
        // Skip a bare "Sequence"/phase container with no descriptive name.
        if (n.kind === 'sequence' && /^(sequence|do|body)$/i.test(n.displayName))
            continue;
        raw.push({ cat, label: cleanTechLabel(cat, n.displayName) });
    }
    // Collapse consecutive prepare-data assignments into one box.
    const collapsed = [];
    for (const s of raw) {
        const prev = collapsed[collapsed.length - 1];
        if (s.cat === 'assign' && prev && prev.cat === 'assign') {
            const m = /^Prepare data \((\d+) steps\)$/.exec(prev.label);
            prev.label = `Prepare data (${(m ? Number(m[1]) : 2)} steps)`;
            continue;
        }
        collapsed.push({ ...s });
    }
    // Cap length, preferring to drop low-signal prepare-data/notify steps first.
    let dropped = 0;
    if (collapsed.length > max) {
        const priority = (c) => (c === 'assign' || c === 'log' || c === 'step' ? 0 : 1);
        // Keep all high-signal; trim excess low-signal from the middle.
        const keep = [];
        const low = collapsed.filter((s) => priority(s.cat) === 0);
        const dropCount = Math.min(low.length, collapsed.length - max);
        let toDrop = dropCount;
        for (const s of collapsed) {
            if (toDrop > 0 && priority(s.cat) === 0) {
                toDrop--;
                dropped++;
                continue;
            }
            keep.push(s);
        }
        return { steps: keep.slice(0, max), dropped: dropped + Math.max(0, keep.length - max), hasTryCatch };
    }
    return { steps: collapsed, dropped, hasTryCatch };
}
/**
 * Render a high-level technical flow of the entry workflow: Start → categorized
 * steps (UI action, data I/O, decision, loop, sub-process, notify) → End, with
 * an "error handling" band when the workflow is wrapped in Try/Catch. This is the
 * readable alternative to a per-activity flowchart full of datatype noise.
 */
function renderTechnicalFlow(title, graph) {
    const { steps, dropped, hasTryCatch } = techSteps(graph);
    const W = 680;
    const cx = W / 2;
    const boxW = 470;
    const decW = 380;
    const termW = 150;
    const termH = 42;
    const gap = 20;
    let y = 20;
    const parts = [];
    const push = (s) => parts.push(s);
    // Title.
    push(`<text x="${cx}" y="${y}" fill="#263238" font-size="15" font-weight="700" text-anchor="middle">${esc(truncate(title, 46))} — high-level flow</text>`);
    y += 22;
    // Error-handling band.
    if (hasTryCatch) {
        push(`<rect x="${cx - 250}" y="${y}" width="500" height="24" rx="12" fill="#EFEBE9" stroke="#8D6E63" stroke-width="1"/>`);
        push(`<text x="${cx}" y="${y + 16}" fill="#5D4037" font-size="11" font-weight="600" text-anchor="middle">Wrapped in Try / Catch — errors routed to the global handler</text>`);
        y += 24 + gap;
    }
    // Start terminal.
    const startY = y;
    push(`<rect x="${cx - termW / 2}" y="${y}" width="${termW}" height="${termH}" rx="${termH / 2}" fill="#2E7D32"/>`);
    push(`<text x="${cx}" y="${y + 27}" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">Start</text>`);
    let prevBottom = y + termH;
    y += termH + gap;
    const laid = [];
    steps.forEach((s, i) => {
        const st = TECH_STYLE[s.cat];
        const isDec = st.shape === 'decision';
        const h = isDec ? 58 : 46;
        const w = isDec ? decW : boxW;
        // Connector from previous.
        push(`<line x1="${cx}" y1="${prevBottom}" x2="${cx}" y2="${y - 2}" stroke="#607D8B" stroke-width="1.5" marker-end="url(#pfarrow)"/>`);
        if (isDec) {
            const hw = w / 2;
            const hh = h / 2;
            const midY = y + hh;
            push(`<polygon points="${cx},${y} ${cx + hw},${midY} ${cx},${y + h} ${cx - hw},${midY}" fill="#FFF3E0" stroke="${st.color}" stroke-width="1.4"/>`);
            push(`<text x="${cx - hw + 10}" y="${midY - 12}" fill="${st.color}" font-size="8.5" font-weight="700">${esc(st.tag)}</text>`);
            push(wrapTspans(s.label, cx, midY - 2, Math.floor((w - 60) / 6), 12, 2, 11, '#3E2723', '600'));
        }
        else {
            push(`<rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="8" fill="${st.color}"/>`);
            push(`<rect x="${cx - w / 2}" y="${y}" width="6" height="${h}" rx="3" fill="rgba(255,255,255,.35)"/>`);
            push(`<text x="${cx - w / 2 + 16}" y="${y + 17}" fill="rgba(255,255,255,.85)" font-size="8.5" font-weight="700">${esc(st.tag)}</text>`);
            push(wrapTspans(s.label, cx + 6, y + (s.label.length > 46 ? 30 : 34), Math.floor((w - 40) / 6), 13, 2, 12.5, '#FFFFFF', '600'));
        }
        laid.push({ cy: y + h / 2, h });
        prevBottom = y + h;
        y += h + gap;
        void i;
    });
    if (dropped > 0) {
        push(`<text x="${cx}" y="${y + 4}" fill="#90A4AE" font-size="10" font-style="italic" text-anchor="middle">+ ${dropped} more detailed step(s) omitted for clarity</text>`);
        y += 16;
    }
    // End terminal.
    push(`<line x1="${cx}" y1="${prevBottom}" x2="${cx}" y2="${y - 2}" stroke="#607D8B" stroke-width="1.5" marker-end="url(#pfarrow)"/>`);
    push(`<rect x="${cx - termW / 2}" y="${y}" width="${termW}" height="${termH}" rx="${termH / 2}" fill="#B00020"/>`);
    push(`<text x="${cx}" y="${y + 27}" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">End</text>`);
    y += termH + 16;
    void startY;
    return rasterize(svgDoc(W, y, parts.join('')), W, y);
}
// ----------------------------------------------------------------------------
// Dynamic state-machine diagram — built from the REAL parsed StateMachine
// (actual states, per-state invoked workflows, and real transitions with their
// names, guard conditions and targets). No canned template.
// ----------------------------------------------------------------------------
/** "GetTransactionData" -> "Get Transaction Data"; "InitAllSettings" -> "Init All Settings". */
function humanizeStep(s) {
    return s
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();
}
/** Strip the surrounding VB brackets from a transition guard condition. */
function cleanCondition(c) {
    return (c || '').replace(/^\[|\]$/g, '').trim();
}
/**
 * A transition is an exception/terminal branch (drawn in red) vs the happy path.
 * Judged on the transition NAME only — guard conditions legitimately reference
 * exception variables (e.g. "SystemException is Nothing") on the success path.
 */
function isExceptionTransition(name, _condition) {
    return /exception|no data|failed|error|abort|retry/i.test(name);
}
/** Normalise a state name for matching analyzer-provided per-state steps. */
function normState(s) {
    return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}
/** Map analyzer `stateFlows` ({state, steps}) to the renderer's per-state map. */
function stateStepsFromFlows(flows) {
    if (!flows?.length)
        return undefined;
    const out = {};
    for (const f of flows)
        if (f.state && f.steps?.length)
            out[normState(f.state)] = f.steps;
    return Object.keys(out).length ? out : undefined;
}
/** Canonicalise common REFramework activity names so near-duplicates collapse. */
function canonicalStep(s) {
    if (/get.*asset|asset.*orchestrator|orchestrator asset/i.test(s))
        return 'Retrieve Orchestrator assets';
    if (/parse client|client (id|name|country|information)/i.test(s))
        return 'Parse client details';
    if (/(local )?settings and constants|read config|get.*config/i.test(s))
        return 'Read config settings';
    if (/read range/i.test(s))
        return 'Read config settings';
    if (/get.*credential/i.test(s))
        return 'Get credential from Orchestrator';
    return s;
}
// Business verbs kept / dropped when deriving per-state steps deterministically.
const STEP_KEEP = /^(get|read|retrieve|extract|parse|calculate|build|validate|update|submit|create|send|download|upload|log ?in|login|sign ?in|open|go to|navigate|close)\b/i;
const STEP_DROP = /^(type|click|check|set text|select |hover|send hotkey|get attribute|target|do$|body|sequence|assign|comment|for each|if |then|else|log message|log -|log$|throw|rethrow|add config|initiali[sz]e all)/i;
/**
 * Deterministic fallback for per-state business steps (no LLM): pull each state's
 * meaningful activities straight from its invoked workflows' parsed nodes. Less
 * polished than the analyzer's phrasing, but keeps the diagram informative when
 * the Gateway isn't available. Keyed by normalised state name.
 */
function deriveStateSteps(graph) {
    const sm = graph.stateMachine;
    if (!sm?.states?.length)
        return {};
    const byFile = new Map();
    for (const n of graph.nodes) {
        const f = String(n.raw?.file ?? '').split(/[\\/]/).pop()?.replace(/\.xaml$/i, '').toLowerCase() ?? '';
        if (!f)
            continue;
        if (!byFile.has(f))
            byFile.set(f, []);
        byFile.get(f).push(n);
    }
    const out = {};
    for (const st of sm.states) {
        const seen = new Set();
        const steps = [];
        for (const wf of st.steps) {
            for (const n of byFile.get(wf.toLowerCase()) ?? []) {
                const dn = (n.displayName || '').trim();
                if (!dn || STEP_DROP.test(dn) || !(STEP_KEEP.test(dn) || n.kind === 'invoke'))
                    continue;
                const label = canonicalStep(humanizeStep(dn.replace(/\s*\([^)]*\)\s*$/, '')).trim());
                const key = label.toLowerCase();
                if (label.length < 3 || seen.has(key))
                    continue;
                seen.add(key);
                steps.push(label.length > 32 ? label.slice(0, 31) + '…' : label);
                if (steps.length >= 6)
                    break;
            }
            if (steps.length >= 6)
                break;
        }
        if (steps.length)
            out[normState(st.name)] = steps;
    }
    return out;
}
/** Short unique code for each state, used on off-page connectors (e.g. GTD, PT, EP). */
function stateCodes(states) {
    const out = {};
    const used = new Set();
    for (const s of states) {
        const words = s.name.split(/\s+/).filter(Boolean);
        let code = (words.length > 1 ? words.map((w) => w[0]).join('') : s.name.slice(0, 3)).toUpperCase().slice(0, 4);
        let i = 2;
        while (used.has(code))
            code = (code.slice(0, 3) + i++).toUpperCase();
        used.add(code);
        out[s.id] = code;
    }
    return out;
}
/**
 * Order states for left-to-right columns: initial first, then follow the happy
 * (non-exception) path, appending any remaining states with final states last —
 * so a REFramework reads Initialization | Get Transaction | Process | End, but
 * the order is derived from the real transitions, not hard-coded.
 */
function orderStates(sm) {
    const byId = {};
    for (const s of sm.states)
        byId[s.id] = s;
    const chain = [];
    const seen = new Set();
    let cur = byId[sm.initial] ?? sm.states[0];
    while (cur && !seen.has(cur.id)) {
        const node = cur;
        chain.push(node);
        seen.add(node.id);
        const fwd = node.transitions.find((t) => !isExceptionTransition(t.name, t.condition) && !!byId[t.to] && !seen.has(t.to));
        cur = fwd ? byId[fwd.to] : undefined;
    }
    const rest = sm.states.filter((s) => !seen.has(s.id));
    rest.sort((a, b) => Number(a.isFinal) - Number(b.isFinal)); // finals last
    return [...chain, ...rest];
}
/** A transition target that lands on a genuine business/system exception path. */
function isBusinessExc(t) {
    return /business ?exception|businessrule/i.test(`${t.name} ${t.condition ?? ''}`);
}
function isSystemExc(t) {
    return /system ?exception|\bfailed\b|\berror\b|\babort\b/i.test(`${t.name} ${t.condition ?? ''}`);
}
/** Short, non-overlapping label for a branch exit arrow. */
function shortBranch(t) {
    if (isBusinessExc(t))
        return 'Bus Exc';
    if (isSystemExc(t))
        return 'Sys Exc';
    if (/no ?data/i.test(`${t.name} ${t.condition ?? ''}`))
        return 'No Data';
    return 'NO';
}
/**
 * A concise decision question for a state, derived from the guard conditions of
 * its real transitions. Returns up to two lines (split on '|'). Generic — falls
 * back to the state name so it works for any state machine, not just REFramework.
 */
function decisionQuestion(s) {
    const g = s.transitions.map((t) => `${t.name} ${t.condition ?? ''}`).join(' ').toLowerCase();
    const isInit = s.steps.some((st) => /initall|init all|initiali|open applic|launch|config|setting/i.test(st));
    if (/transactionitem|new transaction|no data|dequeue|queue ?item|next (item|transaction)/.test(g))
        return 'New transaction|available?';
    if (isInit && /(system)?exception|failed|error/.test(g))
        return 'Initialised|successfully?';
    if (/businessexception|systemexception|exception|failed|error/.test(g))
        return 'Processed|successfully?';
    const nm = humanizeStep(s.name);
    return nm.length > 16 ? `${nm}|complete?` : `${nm} complete?`;
}
/** Two centred text lines for a diamond label (split on '|'). */
function diamondLabel(cx, cy, label, maxChars) {
    const lines = label.split('|');
    if (lines.length === 1)
        return wrapTspans(label, cx, cy - 2, maxChars, 12, 2, 10.5, '#12212E', '700');
    return (`<text x="${cx}" y="${cy - 4}" fill="#12212E" font-size="10.5" font-weight="700" text-anchor="middle">${esc(lines[0])}</text>` +
        `<text x="${cx}" y="${cy + 9}" fill="#12212E" font-size="10.5" font-weight="700" text-anchor="middle">${esc(lines[1])}</text>`);
}
/**
 * SVG for the REAL state machine as a reference-quality REFramework swimlane.
 * Each state is a lane with: a START terminator (initial) or an entry connector,
 * its actual invoked-workflow boxes, then — when the state branches — a decision
 * DIAMOND derived from the real guard conditions. The diamond's happy path exits
 * downward (YES) to an off-page connector carrying the target state's code, and
 * every exception path exits to the side (NO) to a red connector tagged SE#/BE#.
 * A system-exception loop back to an earlier state is drawn as a dashed Retry.
 * The final state ends in an END terminator. Entirely code-derived — no template.
 */
function stateMachineBlock(title, sm, w, apps, stateSteps) {
    const ordered = orderStates(sm);
    const codes = stateCodes(ordered);
    const orderIdx = {};
    ordered.forEach((s, i) => (orderIdx[s.id] = i));
    const N = Math.max(1, ordered.length);
    const pad = 10;
    const titleH = 30;
    const headerH = 32;
    const colW = (w - 2 * pad) / N;
    const bodyTop = titleH + headerH + 30;
    const bw = colW * 0.66;
    const boxH = 46;
    const boxGap = 22;
    const dW = colW * 0.62; // diamond width
    const dH = 66;
    const palette = ['#2E7D32', '#1565C0', '#6A1B9A', '#B00020', '#00695C', '#4527A0', '#37474F'];
    const LANE_TINT = ['#F1F8F2', '#EEF4FC', '#F5F0FA', '#FCEFF1', '#EEF6F5', '#F0EEFA', '#EFF1F3'];
    const INK = '#33475B';
    const parts = [];
    // Running exception-tag counters (SE#1, SE#2… / BE#1, BE#2…) across the whole chart.
    let seN = 0;
    let beN = 0;
    const excTag = (t) => isBusinessExc(t) ? `BE#${++beN}` : isSystemExc(t) ? `SE#${++seN}` : undefined;
    // ---- Title band ----
    parts.push(`<rect x="${pad}" y="0" width="${w - 2 * pad}" height="${titleH}" rx="6" fill="#1F2A37"/>`);
    parts.push(`<text x="${w / 2}" y="${titleH / 2 + 5}" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">${esc(title)} — REFramework state machine (from code)</text>`);
    // ---- Lane tints + headers ----
    ordered.forEach((s, i) => {
        const x = pad + i * colW;
        const color = palette[i % palette.length];
        parts.push(`<rect x="${x}" y="${titleH + 6}" width="${colW}" height="${headerH}" rx="6" fill="${color}"/>`);
        parts.push(wrapTspans(`${s.name}`, x + colW / 2, titleH + 6 + (s.name.length > 18 ? headerH / 2 - 2 : headerH / 2 + 4), Math.floor((colW - 14) / 6), 11, 2, 11, '#fff', '700'));
    });
    const drawConn = (px, py, code, exc) => {
        parts.push(`<ellipse cx="${px}" cy="${py}" rx="16" ry="14" fill="${exc ? '#B00020' : '#5B6B7B'}"/>`);
        parts.push(`<text x="${px}" y="${py + 4}" fill="#fff" font-size="10.5" font-weight="700" text-anchor="middle">${esc(code)}</text>`);
    };
    const arrow = (x1, y1, x2, y2, stroke = INK, width = 1.5, dashed = false) => parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${dashed ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#pfarrow)"/>`);
    let maxBottom = bodyTop;
    ordered.forEach((s, i) => {
        const laneX = pad + i * colW;
        const cx = laneX + colW / 2;
        const color = palette[i % palette.length];
        let y = bodyTop;
        // Entry: START terminator on the initial state, else the state's own arrival connector.
        if (s.id === sm.initial) {
            parts.push(`<rect x="${cx - 48}" y="${y}" width="96" height="32" rx="16" fill="${color}"/>`);
            parts.push(`<text x="${cx}" y="${y + 21}" fill="#fff" font-size="13" font-weight="700" text-anchor="middle">Start</text>`);
        }
        else {
            drawConn(cx, y + 16, codes[s.id], false);
        }
        let prevBottom = y + 32;
        y += 32 + boxGap;
        // Business sub-steps for this state (from the analyzer / discovery) drive the
        // lane when available — each box is a real thing the state DOES ("Read config
        // file", "Retrieve Orchestrator assets", "Log in to ACME System1"). Otherwise
        // fall back to one box per invoked workflow, labelled with the app it uses.
        const biz = stateSteps?.[normState(s.name)] ?? [];
        if (biz.length) {
            biz.slice(0, 7).forEach((label) => {
                const perLine = Math.floor((bw - 14) / 5.0);
                const twoLine = label.length > perLine;
                const h = twoLine ? 42 : 30;
                arrow(cx, prevBottom, cx, y - 2, INK, 1.4);
                parts.push(`<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${h}" rx="6" fill="#FFFFFF" stroke="${color}" stroke-width="1.3"/>`);
                parts.push(`<rect x="${cx - bw / 2}" y="${y}" width="5" height="${h}" rx="2.5" fill="${color}"/>`);
                parts.push(wrapTspans(label, cx + 3, y + (twoLine ? h / 2 - 6 : h / 2 + 1), perLine, 11, 2, 9.5, '#12212E', '600'));
                prevBottom = y + h;
                y += h + 12;
            });
        }
        else {
            const steps = s.steps.length ? s.steps : ['(no invoked workflows)'];
            steps.slice(0, 8).forEach((st) => {
                const used = apps?.[st.toLowerCase()] ?? [];
                const h = used.length ? boxH + 16 : boxH;
                arrow(cx, prevBottom, cx, y - 2, INK, 1.5);
                parts.push(`<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${h}" rx="7" fill="#FFFFFF" stroke="${color}" stroke-width="1.4"/>`);
                parts.push(`<rect x="${cx - bw / 2}" y="${y}" width="5" height="${h}" rx="2.5" fill="${color}"/>`);
                if (used.length) {
                    parts.push(wrapTspans(humanizeStep(st), cx + 3, y + 17, Math.floor((bw - 16) / 5.6), 12, 2, 10.5, '#12212E', '700'));
                    parts.push(`<text x="${cx + 3}" y="${y + h - 11}" fill="${color}" font-size="8.5" font-weight="600" text-anchor="middle">${esc(truncate(used.join(' · '), Math.floor((bw - 12) / 4.6)))}</text>`);
                }
                else {
                    parts.push(wrapTspans(humanizeStep(st), cx + 3, y + h / 2 - 2, Math.floor((bw - 16) / 5.6), 12, 2, 10.5, '#12212E', '600'));
                }
                prevBottom = y + h;
                y += h + boxGap;
            });
        }
        // Branching → decision diamond derived from the real transitions.
        const exits = s.transitions.filter((t) => codes[t.to]); // only wired transitions
        const excExits = exits.filter((t) => isExceptionTransition(t.name, t.condition));
        const happy = exits.filter((t) => !isExceptionTransition(t.name, t.condition));
        // The "primary" forward exit: the happy path (prefer the one that advances
        // to the next-ordered state; else the first happy; else the first exit).
        const primary = happy.find((t) => orderIdx[t.to] === i + 1) ??
            happy[0] ??
            exits[0];
        void excExits;
        if (exits.length) {
            const dcy = y + dH / 2;
            arrow(cx, prevBottom, cx, y - 2, INK, 1.5);
            // Diamond.
            parts.push(`<polygon points="${cx},${dcy - dH / 2} ${cx + dW / 2},${dcy} ${cx},${dcy + dH / 2} ${cx - dW / 2},${dcy}" fill="#DCE9F9" stroke="${color}" stroke-width="1.5"/>`);
            parts.push(diamondLabel(cx, dcy, decisionQuestion(s), Math.floor((dW - 14) / 5.2)));
            prevBottom = dcy + dH / 2;
            // Side (exception / alternate) exits — a clean vertical bus off the right
            // vertex, one arrow per exit, well staggered so labels/tags never collide.
            const others = exits.filter((t) => t !== primary);
            const connX = laneX + colW - 26;
            const busX = cx + dW / 2;
            const STAG = 60;
            if (others.length > 1)
                parts.push(`<line x1="${busX}" y1="${dcy}" x2="${busX}" y2="${dcy + (others.length - 1) * STAG}" stroke="${INK}" stroke-width="1.3"/>`);
            let lowestSide = dcy;
            others.forEach((t, k) => {
                const ry = dcy + k * STAG;
                const exc = isSystemExc(t) || isBusinessExc(t);
                const tag = excTag(t);
                arrow(busX + 2, ry, connX - 15, ry, exc ? '#B00020' : INK, 1.5);
                // Label ABOVE the connector (the lane is too narrow to fit it beside the arrow).
                parts.push(`<text x="${connX}" y="${ry - 17}" fill="${exc ? '#B00020' : INK}" font-size="9" font-weight="700" text-anchor="middle">${esc(shortBranch(t))}</text>`);
                drawConn(connX, ry, codes[t.to] ?? '?', exc);
                if (tag)
                    parts.push(`<text x="${connX}" y="${ry + 26}" fill="#B00020" font-size="9.5" font-weight="700" text-anchor="middle">${esc(tag)}</text>`);
                lowestSide = ry + (tag ? 28 : 15);
            });
            // Primary (YES / happy) exit straight down, below the side exits.
            if (primary && !s.isFinal) {
                const yesCy = Math.max(dcy + dH / 2 + 34, lowestSide + 22);
                arrow(cx, prevBottom, cx, yesCy - 14, INK, 1.6);
                parts.push(`<text x="${cx + 11}" y="${prevBottom + 16}" fill="${INK}" font-size="9.5" font-weight="700">YES</text>`);
                drawConn(cx, yesCy, codes[primary.to] ?? '?', false);
                prevBottom = yesCy + 14;
                y = yesCy + 14 + boxGap;
            }
            else {
                y = Math.max(dcy + dH / 2 + boxGap, lowestSide + boxGap);
            }
            maxBottom = Math.max(maxBottom, lowestSide, y);
        }
        // END terminator on the final state.
        if (s.isFinal) {
            arrow(cx, prevBottom, cx, y - 2, INK, 1.6);
            parts.push(`<rect x="${cx - 48}" y="${y}" width="96" height="32" rx="16" fill="#B00020"/>`);
            parts.push(`<text x="${cx}" y="${y + 21}" fill="#fff" font-size="13" font-weight="700" text-anchor="middle">END</text>`);
            y += 32 + boxGap;
        }
        maxBottom = Math.max(maxBottom, y);
    });
    // ---- Lane tint backgrounds (drawn first, so behind everything) ----
    const laneBg = [];
    ordered.forEach((_, i) => {
        const x = pad + i * colW;
        laneBg.push(`<rect x="${x}" y="${titleH + 6}" width="${colW}" height="${maxBottom - titleH - 6}" fill="${LANE_TINT[i % LANE_TINT.length]}"/>`);
    });
    // Lane dividers.
    for (let i = 1; i < N; i++) {
        const x = pad + i * colW;
        laneBg.push(`<line x1="${x}" y1="${titleH + 6}" x2="${x}" y2="${maxBottom - 4}" stroke="#D3DCE3" stroke-width="1"/>`);
    }
    // ---- Legend ----
    const legendY = maxBottom + 6;
    const legend = ordered.map((s) => `${codes[s.id]} = ${s.name}`).join('    ·    ');
    parts.push(`<text x="${w / 2}" y="${legendY + 9}" fill="#78909C" font-size="9.5" text-anchor="middle">${esc(legend)}</text>`);
    const H = legendY + 20;
    return { svg: laneBg.join('') + parts.join(''), height: H };
}
/** Render the real parsed state machine of a project as a diagram. */
function renderStateMachine(title, sm, apps, stateSteps) {
    const block = stateMachineBlock(title, sm, PF_W, apps, stateSteps);
    const h = block.height + 20;
    return rasterize(svgDoc(PF_W, h, `<g transform="translate(0,12)">${block.svg}</g>`), PF_W, h);
}
/**
 * SVG for one project's REFramework diagram as a faithful 4-lane state chart
 * (Init | Get Transaction Data | Process Transaction | End Process). Each lane is
 * a top-to-bottom flow with Start/END terminators, process rectangles, decision
 * diamonds (YES/NO), off-page connectors (A = to End on exception / no data,
 * B = back to Get Transaction), exception tags (SE#/BE#) and an init retry loop —
 * mirroring the canonical REFramework template. Returns the SVG + total height.
 */
function stateSwimlaneBlock(title, steps, w) {
    const lanes = buildLaneNodes(bucketSteps(steps));
    const pad = 8;
    const titleH = 26;
    const headerH = 30;
    const colW = (w - 2 * pad) / 4;
    const bodyTop = titleH + headerH + 22;
    const gapProc = 26; // gap after a process/terminal
    const gapDec = 40; // extra gap after a decision (room for branch label)
    const nodeH = (n) => (n.kind === 'terminal' ? 34 : n.kind === 'connector' ? 34 : n.kind === 'decision' ? 56 : 48);
    const parts = [];
    // ---- Title band + lane headers ----
    parts.push(`<rect x="${pad}" y="0" width="${w - 2 * pad}" height="${titleH}" rx="4" fill="#263238"/>`);
    parts.push(`<text x="${w / 2}" y="${titleH / 2 + 5}" fill="#fff" font-size="13" font-weight="700" text-anchor="middle">${esc(title)} — REFramework state chart</text>`);
    SWIM_STATES.forEach((c, i) => {
        const x = pad + i * colW;
        parts.push(`<rect x="${x + 2}" y="${titleH + 3}" width="${colW - 4}" height="${headerH - 4}" rx="4" fill="${c.color}"/>`);
        parts.push(`<text x="${x + colW / 2}" y="${titleH + headerH / 2 + 5}" fill="#fff" font-size="11.5" font-weight="700" text-anchor="middle">${esc(c.name)}</text>`);
    });
    // ---- Lay out every lane's spine, remember geometry for inter-lane wiring ----
    const KEYS = ['init', 'get', 'process', 'end'];
    const geom = [];
    let maxBottom = bodyTop;
    KEYS.forEach((key, i) => {
        const laneX = pad + i * colW;
        const cx = laneX + colW * 0.44;
        const connX = laneX + colW * 0.84;
        const bw = colW * 0.62;
        const dhw = colW * 0.32;
        const nodes = lanes[key];
        const laid = [];
        let y = bodyTop;
        nodes.forEach((n, k) => {
            const h = nodeH(n);
            laid.push({ n, cy: y + h / 2, h });
            const g = n.kind === 'decision' ? gapDec : gapProc;
            y += h + (k < nodes.length - 1 ? g : 0);
        });
        maxBottom = Math.max(maxBottom, y);
        const entryIdx = nodes.findIndex((n) => n.kind === 'decision' || n.kind === 'process');
        const color = SWIM_STATES[i].color;
        geom.push({ key, cx, laneX, connX, bw, dhw, laid, entryIdx });
        // stash lane color on geom via closure below
        geom[geom.length - 1].color = color;
    });
    const H = maxBottom + 10;
    // ---- Lane divider lines ----
    for (let i = 1; i < 4; i++) {
        const x = pad + i * colW;
        parts.push(`<line x1="${x}" y1="${titleH + 2}" x2="${x}" y2="${H - 4}" stroke="#CFD8DC" stroke-width="1"/>`);
    }
    const drawConnector = (px, py, letter) => {
        parts.push(`<ellipse cx="${px}" cy="${py}" rx="17" ry="14" fill="#4A5B6B"/>`);
        parts.push(`<text x="${px}" y="${py + 5}" fill="#fff" font-size="13" font-weight="700" text-anchor="middle">${esc(letter)}</text>`);
    };
    // ---- Inter-lane flow arrows (Init → Get, Get → Process), routed through the gutter ----
    const routeToNext = (from, to) => {
        const src = from.laid[from.laid.length - 1];
        const tgt = to.laid[to.entryIdx];
        const sx = src.n.kind === 'decision' ? from.cx : from.cx;
        const sy = src.cy + src.h / 2;
        const boundary = to.laneX; // divider between the two lanes
        const tgtLeft = to.cx - (tgt.n.kind === 'decision' ? to.dhw : to.bw / 2);
        const midY = tgt.cy;
        parts.push(`<path d="M${sx},${sy} V${sy + 12} H${boundary - 0} V${midY} H${tgtLeft - 2}" fill="none" stroke="#546E7A" stroke-width="1.5" marker-end="url(#pfarrow)"/>`);
    };
    // ---- Draw each lane ----
    geom.forEach((g) => {
        const color = g.color;
        // spine connectors between consecutive nodes
        for (let k = 0; k < g.laid.length - 1; k++) {
            const a = g.laid[k];
            const bnode = g.laid[k + 1];
            const label = a.n.kind === 'decision' ? a.n.downLabel : undefined;
            parts.push(`<line x1="${g.cx}" y1="${a.cy + a.h / 2}" x2="${g.cx}" y2="${bnode.cy - bnode.h / 2 - 2}" stroke="#607D8B" stroke-width="1.4" marker-end="url(#pfarrow)"/>`);
            if (label)
                parts.push(`<text x="${g.cx + 7}" y="${a.cy + a.h / 2 + 13}" fill="#37474F" font-size="9.5" font-weight="600">${esc(label)}</text>`);
        }
        g.laid.forEach((it, idx) => {
            const { n, cy, h } = it;
            if (n.kind === 'terminal') {
                parts.push(`<rect x="${g.cx - 46}" y="${cy - h / 2}" width="92" height="${h}" rx="${h / 2}" fill="${color}"/>`);
                parts.push(`<text x="${g.cx}" y="${cy + 5}" fill="#fff" font-size="13" font-weight="700" text-anchor="middle">${esc(n.label)}</text>`);
            }
            else if (n.kind === 'connector') {
                drawConnector(g.cx, cy, n.label);
            }
            else if (n.kind === 'decision') {
                const hw = g.dhw;
                const hh = h / 2;
                parts.push(`<polygon points="${g.cx},${cy - hh} ${g.cx + hw},${cy} ${g.cx},${cy + hh} ${g.cx - hw},${cy}" fill="#DCE9F9" stroke="${color}" stroke-width="1.3"/>`);
                parts.push(wrapTspans(n.label, g.cx, cy - 3, Math.floor((hw * 2 - 8) / 5.2), 11, 3, 9.2, '#12212E', '600'));
                // side branch → off-page connector
                if (n.sideTo) {
                    const cxTo = g.connX;
                    parts.push(`<line x1="${g.cx + hw}" y1="${cy}" x2="${cxTo - 17}" y2="${cy}" stroke="#546E7A" stroke-width="1.4" marker-end="url(#pfarrow)"/>`);
                    if (n.sideLabel)
                        parts.push(`<text x="${g.cx + hw + 8}" y="${cy - 5}" fill="#37474F" font-size="9.5" font-weight="700">${esc(n.sideLabel)}</text>`);
                    drawConnector(cxTo, cy, n.sideTo);
                    if (n.exception)
                        parts.push(`<text x="${cxTo}" y="${cy + 28}" fill="#B00020" font-size="10" font-weight="700" text-anchor="middle">${esc(n.exception)}</text>`);
                }
                // retry dashed loop back to the previous process node
                if (n.retry && idx > 0) {
                    const prev = g.laid[idx - 1];
                    const lx = g.cx - hw - 8;
                    parts.push(`<path d="M${g.cx - hw},${cy} H${lx} V${prev.cy} H${g.cx - g.bw / 2 - 2}" fill="none" stroke="#90A4AE" stroke-width="1.3" stroke-dasharray="4 3" marker-end="url(#pfarrow)"/>`);
                    parts.push(`<text x="${lx - 2}" y="${(cy + prev.cy) / 2}" fill="#607D8B" font-size="9" font-weight="600" text-anchor="end">Retry</text>`);
                }
            }
            else {
                // process
                parts.push(`<rect x="${g.cx - g.bw / 2}" y="${cy - h / 2}" width="${g.bw}" height="${h}" rx="6" fill="#F4F6F8" stroke="${color}" stroke-width="1.1"/>`);
                parts.push(wrapTspans(n.label, g.cx, cy - 4, Math.floor((g.bw - 12) / 5.6), 12, 3, 10, '#12212E', '500'));
            }
        });
    });
    // Inter-lane arrows drawn last so they sit above dividers.
    routeToNext(geom[0], geom[1]);
    routeToNext(geom[1], geom[2]);
    return { svg: parts.join(''), height: H };
}
/**
 * One project's high-level flow as a centered top-to-bottom linear block (Start →
 * numbered steps → End), sized to width `w`. Used for non-REFramework projects in
 * a multi-project solution so a Flowchart dispatcher isn't drawn as a state machine.
 */
function linearFlowBlock(title, stepsIn, w) {
    const steps = stepsIn.map((s) => s.trim()).filter(Boolean).slice(0, 14);
    const cx = w / 2;
    const boxW = Math.min(460, w - 80);
    const termW = 150;
    const termH = 40;
    const stepH = 52;
    const gap = 22;
    const titleH = 30;
    const palette = ['#1565C0', '#00838F', '#6A1B9A', '#283593', '#2E7D32', '#00695C', '#455A64', '#4527A0'];
    const parts = [];
    parts.push(`<text x="${cx}" y="18" fill="#263238" font-size="14" font-weight="700" text-anchor="middle">${esc(truncate(title, 46))} — process flow</text>`);
    const heights = [termH, ...steps.map(() => stepH), termH];
    const centers = [];
    let y = titleH;
    for (const h of heights) {
        centers.push(y + h / 2);
        y += h + gap;
    }
    const H = y - gap + 6;
    for (let i = 0; i < centers.length - 1; i++) {
        parts.push(`<line x1="${cx}" y1="${centers[i] + heights[i] / 2}" x2="${cx}" y2="${centers[i + 1] - heights[i + 1] / 2 - 2}" stroke="#37474F" stroke-width="1.6" marker-end="url(#pfarrow)"/>`);
    }
    parts.push(`<rect x="${cx - termW / 2}" y="${centers[0] - termH / 2}" width="${termW}" height="${termH}" rx="${termH / 2}" fill="#2E7D32"/>`, `<text x="${cx}" y="${centers[0] + 5}" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">Start</text>`);
    steps.forEach((s, i) => {
        const cy = centers[i + 1];
        const fill = palette[i % palette.length];
        const x = cx - boxW / 2;
        parts.push(`<rect x="${x}" y="${cy - stepH / 2}" width="${boxW}" height="${stepH}" rx="8" fill="${fill}"/>`);
        parts.push(`<circle cx="${x + 24}" cy="${cy}" r="14" fill="#FFFFFF" opacity="0.9"/>`, `<text x="${x + 24}" y="${cy + 5}" fill="${fill}" font-size="13" font-weight="700" text-anchor="middle">${i + 1}</text>`);
        parts.push(wrapTspans(s, x + 24 + (boxW - 48) / 2 + 6, cy - (s.length > 40 ? 4 : -4), Math.floor((boxW - 66) / 6.2), 15, 2, 12.5, '#FFFFFF', '600'));
    });
    const eCy = centers[centers.length - 1];
    parts.push(`<rect x="${cx - termW / 2}" y="${eCy - termH / 2}" width="${termW}" height="${termH}" rx="${termH / 2}" fill="#B00020"/>`, `<text x="${cx}" y="${eCy + 5}" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">End</text>`);
    return { svg: parts.join(''), height: H };
}
/** One REFramework project's high-level flow as a 4-column state swimlane. */
function renderPartitionedFlow(title, steps) {
    const block = stateSwimlaneBlock(title, steps, PF_W);
    const h = block.height + 20;
    return rasterize(svgDoc(PF_W, h, `<g transform="translate(0,12)">${block.svg}</g>`), PF_W, h);
}
/** Rasterize a single linear high-level block at the partitioned-flow width. */
function rasterizeLinear(title, steps) {
    const block = linearFlowBlock(title, steps, PF_W);
    const h = block.height + 20;
    return rasterize(svgDoc(PF_W, h, `<g transform="translate(0,12)">${block.svg}</g>`), PF_W, h);
}
/**
 * Two+ projects (dispatcher/performer): one high-level diagram per project,
 * stacked. REFramework projects render as a 4-column state swimlane; plain
 * Flowchart/Sequence projects render as a linear high-level flow.
 */
function renderPartitionedFlows(flows) {
    const usable = flows.filter((f) => (f.stateMachine && f.stateMachine.states?.length) || f.steps.some((s) => s && s.trim()));
    // One project's block: a code-derived state machine if we parsed one, else a
    // REFramework state swimlane for a REFramework project, else a linear flow.
    const blockFor = (f) => f.stateMachine && f.stateMachine.states?.length
        ? stateMachineBlock(f.project, f.stateMachine, PF_W)
        : f.reframework === false
            ? linearFlowBlock(f.project, f.steps, PF_W)
            : stateSwimlaneBlock(f.project, f.steps, PF_W);
    if (usable.length <= 1) {
        const f = usable[0];
        if (!f)
            return renderPartitionedFlow('', []);
        const b = blockFor(f);
        const h = b.height + 20;
        return rasterize(svgDoc(PF_W, h, `<g transform="translate(0,12)">${b.svg}</g>`), PF_W, h);
    }
    const gap = 34;
    let y = 12;
    let body = '';
    usable.forEach((f, i) => {
        const b = blockFor(f);
        body += `<g transform="translate(0,${y})">${b.svg}</g>`;
        y += b.height + gap;
        if (i < usable.length - 1)
            body += `<line x1="20" y1="${y - gap / 2}" x2="${PF_W - 20}" y2="${y - gap / 2}" stroke="#CFD8DC" stroke-width="1" stroke-dasharray="2 3"/>`;
    });
    return rasterize(svgDoc(PF_W, y + 6, body), PF_W, y + 6);
}
//# sourceMappingURL=flowchart.js.map