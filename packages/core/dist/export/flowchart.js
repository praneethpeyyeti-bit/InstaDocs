"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessLabel = businessLabel;
exports.isReframework = isReframework;
exports.renderReframeworkStates = renderReframeworkStates;
exports.renderArchitecture = renderArchitecture;
exports.renderAgenticFlow = renderAgenticFlow;
exports.renderAgenticEcosystem = renderAgenticEcosystem;
exports.renderProcessFlow = renderProcessFlow;
exports.hasHighLevelSteps = hasHighLevelSteps;
exports.renderHighLevelFlow = renderHighLevelFlow;
exports.renderSolutionFlow = renderSolutionFlow;
exports.renderCombinedHighLevelFlow = renderCombinedHighLevelFlow;
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
    return /reframework|robotic enterprise framework|gettransactiondata|settransactionstatus|initallsettings/.test(hay);
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
/** SVG for one high-level flow column at a given origin. Returns parts + height. */
function highLevelColumn(originX, colW, title, stepsIn) {
    const steps = stepsIn.map((s) => s.trim()).filter(Boolean).slice(0, 14);
    const cx = originX + colW / 2;
    const boxW = colW - 40;
    const termW = 130;
    const termH = 42;
    const stepH = 56;
    const gap = 22;
    const palette = ['#1565C0', '#00838F', '#6A1B9A', '#283593', '#2E7D32', '#00695C', '#455A64', '#4527A0'];
    const heights = [termH, ...steps.map(() => stepH), termH];
    const centers = [];
    let y = 52;
    for (const h of heights) {
        centers.push(y + h / 2);
        y += h + gap;
    }
    const height = y - gap + 10;
    const parts = [];
    parts.push(`<text x="${cx}" y="30" fill="#0D47A1" font-size="15" font-weight="700" text-anchor="middle">${esc(truncate(title, 26))}</text>`);
    for (let i = 0; i < heights.length - 1; i++) {
        parts.push(`<line x1="${cx}" y1="${centers[i] + heights[i] / 2}" x2="${cx}" y2="${centers[i + 1] - heights[i + 1] / 2 - 2}" stroke="#37474F" stroke-width="1.6" marker-end="url(#hlarr)"/>`);
    }
    parts.push(`<rect x="${cx - termW / 2}" y="${centers[0] - termH / 2}" width="${termW}" height="${termH}" rx="${termH / 2}" fill="#2E7D32"/>`, `<text x="${cx}" y="${centers[0] + 5}" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">Start</text>`);
    steps.forEach((s, i) => {
        const cy = centers[i + 1];
        const fill = palette[i % palette.length];
        const x = cx - boxW / 2;
        parts.push(`<rect x="${x}" y="${cy - stepH / 2}" width="${boxW}" height="${stepH}" rx="9" fill="${fill}"/>`);
        parts.push(`<circle cx="${x + 22}" cy="${cy}" r="13" fill="#FFFFFF" opacity="0.9"/>`, `<text x="${x + 22}" y="${cy + 4}" fill="${fill}" font-size="12" font-weight="700" text-anchor="middle">${i + 1}</text>`);
        parts.push(wrapTspans(s, x + 22 + (boxW - 44) / 2 + 4, cy - (s.length > 30 ? 4 : -4), Math.floor((boxW - 60) / 6.2), 14, 2, 12, '#FFFFFF', '600'));
    });
    const eCy = centers[heights.length - 1];
    parts.push(`<rect x="${cx - termW / 2}" y="${eCy - termH / 2}" width="${termW}" height="${termH}" rx="${termH / 2}" fill="#B00020"/>`, `<text x="${cx}" y="${eCy + 5}" fill="#fff" font-size="14" font-weight="700" text-anchor="middle">End</text>`);
    return { svg: parts.join(''), height };
}
/**
 * Render ONE combined end-to-end high-level flow for a multi-project solution:
 * each project's steps under a labelled header band, connected top-to-bottom,
 * with an "Orchestrator Queue" hand-off inserted between a Dispatcher and the
 * following project. Keeps every project's detail in a single connected picture.
 */
function renderSolutionFlow(flowsIn) {
    const flows = flowsIn
        .map((f) => ({ project: f.project, steps: f.steps.map((s) => s.trim()).filter(Boolean).slice(0, 10) }))
        .filter((f) => f.steps.length);
    if (flows.length <= 1) {
        const one = flows[0] ?? { project: '', steps: [] };
        return renderHighLevelFlow(one.project, one.steps);
    }
    const stepPalette = ['#1565C0', '#00838F', '#6A1B9A', '#283593', '#2E7D32', '#00695C', '#455A64', '#4527A0'];
    const items = [{ t: 'term', label: 'Start', fill: '#2E7D32' }];
    const isDispatcher = (n) => /dispatch/i.test(n);
    const isPerformer = (n) => /perform|process/i.test(n);
    flows.forEach((f, fi) => {
        items.push({ t: 'header', label: f.project });
        f.steps.forEach((s, i) => items.push({ t: 'step', n: i + 1, label: s, fill: stepPalette[i % stepPalette.length] }));
        if (fi < flows.length - 1 && (isDispatcher(f.project) || isPerformer(flows[fi + 1].project))) {
            items.push({ t: 'queue', label: 'Orchestrator Queue' });
        }
    });
    items.push({ t: 'term', label: 'End', fill: '#B00020' });
    const W = 640;
    const cx = W / 2;
    const boxW = 440;
    const termW = 140;
    const gap = 14;
    const hOf = (it) => (it.t === 'term' ? 40 : it.t === 'header' ? 30 : it.t === 'queue' ? 46 : 48);
    let y = 20;
    const centers = [];
    for (const it of items) {
        const h = hOf(it);
        centers.push(y + h / 2);
        y += h + gap;
    }
    const H = y - gap + 20;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`, `<defs><marker id="hlarr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" fill="#37474F"/></marker></defs>`, `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`);
    // Connectors (skip drawing an arrow INTO a header band; use a plain line there).
    for (let i = 0; i < items.length - 1; i++) {
        const y1 = centers[i] + hOf(items[i]) / 2;
        const y2 = centers[i + 1] - hOf(items[i + 1]) / 2 - 2;
        const plain = items[i + 1].t === 'header';
        parts.push(`<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}" stroke="#37474F" stroke-width="1.7" ${plain ? '' : 'marker-end="url(#hlarr)"'}/>`);
    }
    items.forEach((it, i) => {
        const cy = centers[i];
        if (it.t === 'term') {
            parts.push(`<rect x="${cx - termW / 2}" y="${cy - 20}" width="${termW}" height="40" rx="20" fill="${it.fill}"/>`, `<text x="${cx}" y="${cy + 5}" fill="#fff" font-size="15" font-weight="700" text-anchor="middle">${esc(it.label)}</text>`);
        }
        else if (it.t === 'header') {
            parts.push(`<rect x="${cx - boxW / 2}" y="${cy - 14}" width="${boxW}" height="28" rx="6" fill="#0D47A1"/>`, `<text x="${cx}" y="${cy + 5}" fill="#fff" font-size="13" font-weight="700" letter-spacing="0.5" text-anchor="middle">${esc(truncate(it.label, 46)).toUpperCase()}</text>`);
        }
        else if (it.t === 'queue') {
            const qw = 220, qh = 38, x = cx - qw / 2, ry = 7;
            parts.push(`<path d="M${x},${cy - qh / 2 + ry} a${qw / 2},${ry} 0 0 1 ${qw},0 v${qh - 2 * ry} a${qw / 2},${ry} 0 0 1 -${qw},0 z" fill="#37474F"/>`, `<ellipse cx="${cx}" cy="${cy - qh / 2 + ry}" rx="${qw / 2}" ry="${ry}" fill="#546E7A"/>`, `<text x="${cx}" y="${cy + 6}" fill="#fff" font-size="11.5" font-weight="700" text-anchor="middle">${esc(it.label)}</text>`);
        }
        else {
            const x = cx - boxW / 2;
            parts.push(`<rect x="${x}" y="${cy - 23}" width="${boxW}" height="46" rx="9" fill="${it.fill}"/>`);
            parts.push(`<circle cx="${x + 24}" cy="${cy}" r="13" fill="#FFFFFF" opacity="0.9"/>`, `<text x="${x + 24}" y="${cy + 4}" fill="${it.fill}" font-size="13" font-weight="700" text-anchor="middle">${it.n}</text>`);
            parts.push(wrapTspans(it.label, x + 24 + (boxW - 48) / 2 + 4, cy - (it.label.length > 44 ? 4 : -4), Math.floor((boxW - 64) / 6.2), 13, 2, 12, '#FFFFFF', '600'));
        }
    });
    parts.push('</svg>');
    const resvg = new resvg_js_1.Resvg(parts.join(''), { fitTo: { mode: 'width', value: W * 2 } });
    return { png: Buffer.from(resvg.render().asPng()), width: W, height: H };
}
/**
 * Render one high-level flow per project, side by side (Dispatcher | Performer |
 * Reporter), for a multi-project solution SDD.
 */
function renderCombinedHighLevelFlow(flows) {
    const usable = flows.filter((f) => f.steps.some((s) => s && s.trim())).slice(0, 4);
    if (usable.length <= 1) {
        const one = usable[0] ?? { project: '', steps: [] };
        return renderHighLevelFlow(one.project, one.steps);
    }
    const colW = 360;
    const W = usable.length * colW + 20;
    const cols = usable.map((f, i) => highLevelColumn(10 + i * colW, colW, f.project, f.steps));
    const H = Math.max(...cols.map((c) => c.height)) + 20;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`, `<defs><marker id="hlarr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L8,3 L0,6 z" fill="#37474F"/></marker></defs>`, `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`);
    for (let i = 1; i < usable.length; i++) {
        const x = 10 + i * colW;
        parts.push(`<line x1="${x}" y1="46" x2="${x}" y2="${H - 10}" stroke="#ECEFF1" stroke-width="1"/>`);
    }
    cols.forEach((c) => parts.push(c.svg));
    parts.push('</svg>');
    const resvg = new resvg_js_1.Resvg(parts.join(''), { fitTo: { mode: 'width', value: W * 2 } });
    return { png: Buffer.from(resvg.render().asPng()), width: W, height: H };
}
//# sourceMappingURL=flowchart.js.map