"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderFlowchart = renderFlowchart;
exports.businessLabel = businessLabel;
exports.laneOf = laneOf;
exports.renderSwimlane = renderSwimlane;
exports.isReframework = isReframework;
exports.renderReframeworkStates = renderReframeworkStates;
exports.renderArchitecture = renderArchitecture;
const resvg_js_1 = require("@resvg/resvg-js");
const MAX_NODES = 18;
const W = 780;
const PAD_TOP = 24;
const GAP = 30;
const PROC_H = 50;
const DEC_H = 74;
const TERM_H = 44;
const BOX_W = 460;
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
function renderFlowchart(graph) {
    const items = buildItems(graph);
    const svg = buildSvg(items);
    const scale = 2; // render at 2x for crisp output
    const resvg = new resvg_js_1.Resvg(svg, { fitTo: { mode: 'width', value: W * scale } });
    const png = Buffer.from(resvg.render().asPng());
    const height = svgHeight(items);
    return { png, width: W, height };
}
function buildItems(graph) {
    const meaningful = graph.nodes.filter((n) => ['io', 'ui', 'invoke', 'if', 'switch', 'loop', 'throw', 'assign', 'log'].includes(n.kind));
    const chosen = (meaningful.length ? meaningful : graph.nodes).slice(0, MAX_NODES);
    const items = [{ kind: 'start', title: 'Start' }];
    for (const n of chosen)
        items.push(toItem(n));
    if ((meaningful.length ? meaningful : graph.nodes).length > MAX_NODES) {
        items.push({ kind: 'other', title: '… more activities' });
    }
    items.push({ kind: 'end', title: 'End' });
    return items;
}
function toItem(n) {
    const condition = n.raw && n.raw.condition ? String(n.raw.condition) : undefined;
    return { kind: n.kind, title: businessLabel(n.displayName), condition };
}
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
/** Group a node under the application/system swimlane it belongs to. */
function laneOf(n) {
    const name = n.displayName;
    if (/excel|workbook|spreadsheet/i.test(name))
        return 'MS Excel';
    if (/mail|email|outlook|smtp|notif/i.test(name))
        return 'Email';
    if (/browser|web|http|api|url|navigate/i.test(name))
        return 'Web / API';
    if (/sap/i.test(name))
        return 'SAP';
    if (/database|sql|query/i.test(name))
        return 'Database';
    if (n.kind === 'ui')
        return 'Business Application';
    if (n.kind === 'invoke')
        return 'Sub-process';
    return 'RPA Bot';
}
function itemHeight(kind) {
    if (kind === 'start' || kind === 'end')
        return TERM_H;
    if (kind === 'if' || kind === 'switch')
        return DEC_H;
    return PROC_H;
}
function svgHeight(items) {
    let h = PAD_TOP;
    items.forEach((it, i) => {
        h += itemHeight(it.kind);
        if (i < items.length - 1)
            h += GAP;
    });
    return h + PAD_TOP;
}
function buildSvg(items) {
    const height = svgHeight(items);
    const cx = W / 2;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" font-family="Segoe UI, Arial, sans-serif">`, `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">` +
        `<path d="M0,0 L8,3 L0,6 z" fill="#37474F"/></marker></defs>`, `<rect x="0" y="0" width="${W}" height="${height}" fill="#FFFFFF"/>`);
    // Compute vertical center of each item.
    const centers = [];
    let y = PAD_TOP;
    for (let i = 0; i < items.length; i++) {
        const h = itemHeight(items[i].kind);
        centers.push(y + h / 2);
        y += h + GAP;
    }
    // Arrows first (behind shapes).
    for (let i = 0; i < items.length - 1; i++) {
        const y1 = centers[i] + itemHeight(items[i].kind) / 2;
        const y2 = centers[i + 1] - itemHeight(items[i + 1].kind) / 2;
        parts.push(`<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2 - 2}" stroke="#37474F" stroke-width="1.6" marker-end="url(#arrow)"/>`);
    }
    // Shapes.
    items.forEach((it, i) => {
        parts.push(shape(it, cx, centers[i]));
    });
    parts.push('</svg>');
    return parts.join('');
}
function shape(it, cx, cy) {
    const fill = FILL[it.kind] ?? FILL.other;
    const isDecision = it.kind === 'if' || it.kind === 'switch';
    const isTerm = it.kind === 'start' || it.kind === 'end';
    const tag = LABEL[it.kind] ?? 'Step';
    const dark = isDecision; // amber → dark text
    const textColor = dark ? '#212121' : '#FFFFFF';
    let body;
    if (isDecision) {
        const hw = BOX_W / 2;
        const hh = DEC_H / 2;
        const pts = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
        body = `<polygon points="${pts}" fill="${fill}" stroke="#00000022"/>`;
    }
    else if (isTerm) {
        const w = 150;
        const x = cx - w / 2;
        body = `<rect x="${x}" y="${cy - TERM_H / 2}" width="${w}" height="${TERM_H}" rx="${TERM_H / 2}" ry="${TERM_H / 2}" fill="${fill}"/>`;
    }
    else {
        const x = cx - BOX_W / 2;
        body = `<rect x="${x}" y="${cy - PROC_H / 2}" width="${BOX_W}" height="${PROC_H}" rx="8" ry="8" fill="${fill}"/>`;
    }
    const labelRun = isTerm
        ? `<text x="${cx}" y="${cy + 5}" fill="${textColor}" font-size="16" font-weight="600" text-anchor="middle">${esc(it.title)}</text>`
        : decoratedText(it, cx, cy, tag, textColor, isDecision);
    return body + labelRun;
}
function decoratedText(it, cx, cy, tag, color, isDecision) {
    const title = truncate(it.title, isDecision ? 40 : 52);
    const cond = it.condition ? truncate(it.condition, 46) : '';
    const tagRun = `<text x="${cx}" y="${cy - (cond ? 12 : 6)}" fill="${color}" font-size="10" font-weight="700" letter-spacing="0.5" text-anchor="middle" opacity="0.85">${esc(tag.toUpperCase())}</text>`;
    const titleRun = `<text x="${cx}" y="${cy + (cond ? 4 : 8)}" fill="${color}" font-size="13" font-weight="600" text-anchor="middle">${esc(title)}</text>`;
    const condRun = cond
        ? `<text x="${cx}" y="${cy + 20}" fill="${color}" font-size="10" text-anchor="middle" opacity="0.9">${esc(cond)}</text>`
        : '';
    return tagRun + titleRun + condRun;
}
function truncate(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// ----------------------------------------------------------------------------
// Swimlane (As-Is) — a cross-functional flowchart grouped by application/system.
// ----------------------------------------------------------------------------
const LANE_COLORS = ['#1565C0', '#00838F', '#6A1B9A', '#283593', '#2E7D32', '#B71C1C', '#455A64', '#795548'];
const LANE_W = 230;
const HEADER_H = 46;
const ROW_H = 72;
const SW_PADX = 12;
const SW_PADTOP = HEADER_H + 16;
const SW_PADBOT = 18;
function renderSwimlane(graph) {
    const meaningful = graph.nodes
        .filter((n) => ['io', 'ui', 'invoke', 'if', 'switch', 'loop', 'throw', 'assign', 'log'].includes(n.kind))
        .slice(0, MAX_NODES);
    const rows = [
        { lane: 'RPA Bot', kind: 'start', label: 'Start' },
        ...meaningful.map((n) => ({
            lane: laneOf(n),
            kind: n.kind,
            label: businessLabel(n.displayName),
            condition: n.raw && n.raw.condition ? String(n.raw.condition) : undefined,
        })),
        { lane: 'RPA Bot', kind: 'end', label: 'End' },
    ];
    const lanes = [];
    for (const r of rows)
        if (!lanes.includes(r.lane))
            lanes.push(r.lane);
    const W = SW_PADX * 2 + lanes.length * LANE_W;
    const H = SW_PADTOP + rows.length * ROW_H + SW_PADBOT;
    const laneColor = (lane) => LANE_COLORS[lanes.indexOf(lane) % LANE_COLORS.length];
    const laneCx = (lane) => SW_PADX + lanes.indexOf(lane) * LANE_W + LANE_W / 2;
    const rowCy = (i) => SW_PADTOP + i * ROW_H + ROW_H / 2;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Segoe UI, Arial, sans-serif">`, `<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">` +
        `<path d="M0,0 L8,3 L0,6 z" fill="#37474F"/></marker></defs>`, `<rect x="0" y="0" width="${W}" height="${H}" fill="#FFFFFF"/>`);
    // Lane headers + column separators.
    lanes.forEach((lane, li) => {
        const x = SW_PADX + li * LANE_W;
        parts.push(`<rect x="${x + 3}" y="8" width="${LANE_W - 6}" height="${HEADER_H - 10}" rx="6" fill="${laneColor(lane)}"/>`, `<text x="${x + LANE_W / 2}" y="${8 + (HEADER_H - 10) / 2 + 5}" fill="#FFFFFF" font-size="14" font-weight="700" text-anchor="middle">${esc(lane)}</text>`, `<line x1="${x}" y1="${HEADER_H + 4}" x2="${x}" y2="${H - 6}" stroke="#ECEFF1" stroke-width="1"/>`);
    });
    parts.push(`<line x1="${W - SW_PADX}" y1="${HEADER_H + 4}" x2="${W - SW_PADX}" y2="${H - 6}" stroke="#ECEFF1" stroke-width="1"/>`);
    // Orthogonal connectors between consecutive rows.
    for (let i = 0; i < rows.length - 1; i++) {
        const x1 = laneCx(rows[i].lane);
        const x2 = laneCx(rows[i + 1].lane);
        const y1 = rowCy(i) + halfH(rows[i].kind);
        const y2 = rowCy(i + 1) - halfH(rows[i + 1].kind);
        const midY = (y1 + y2) / 2;
        const d = x1 === x2 ? `M${x1},${y1} L${x2},${y2 - 2}` : `M${x1},${y1} L${x1},${midY} L${x2},${midY} L${x2},${y2 - 2}`;
        parts.push(`<path d="${d}" fill="none" stroke="#37474F" stroke-width="1.6" marker-end="url(#arrow)"/>`);
    }
    // Shapes.
    rows.forEach((r, i) => parts.push(swimShape(r, laneCx(r.lane), rowCy(i), laneColor(r.lane))));
    parts.push('</svg>');
    const svg = parts.join('');
    const resvg = new resvg_js_1.Resvg(svg, { fitTo: { mode: 'width', value: W * 2 } });
    return { png: Buffer.from(resvg.render().asPng()), width: W, height: H };
}
function halfH(kind) {
    if (kind === 'start' || kind === 'end')
        return 20;
    if (kind === 'if' || kind === 'switch')
        return 29;
    return 23;
}
function swimShape(r, cx, cy, color) {
    const bw = LANE_W - 44;
    const isDecision = r.kind === 'if' || r.kind === 'switch';
    const isTerm = r.kind === 'start' || r.kind === 'end';
    // Diamonds are narrower than rectangles, so truncate their text harder.
    const label = truncate(r.label, isDecision ? 16 : 26);
    const cond = r.condition ? truncate(r.condition, isDecision ? 18 : 28) : '';
    const titleSize = isDecision ? 10.5 : 12;
    let body;
    if (isDecision) {
        const hw = bw / 2 + 12; // widen the diamond a touch for the label
        const hh = 30;
        body = `<polygon points="${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}" fill="${color}" stroke="#00000022"/>`;
    }
    else if (isTerm) {
        const w = 120;
        body = `<rect x="${cx - w / 2}" y="${cy - 20}" width="${w}" height="40" rx="20" ry="20" fill="${color}"/>`;
    }
    else {
        body = `<rect x="${cx - bw / 2}" y="${cy - 23}" width="${bw}" height="46" rx="7" ry="7" fill="${color}"/>`;
    }
    const title = `<text x="${cx}" y="${cy + (cond ? -1 : 5)}" fill="#FFFFFF" font-size="${titleSize}" font-weight="600" text-anchor="middle">${esc(label)}</text>`;
    const condRun = cond
        ? `<text x="${cx}" y="${cy + 13}" fill="#FFFFFF" font-size="9" text-anchor="middle" opacity="0.9">${esc(cond)}</text>`
        : '';
    return body + title + condRun;
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
//# sourceMappingURL=flowchart.js.map