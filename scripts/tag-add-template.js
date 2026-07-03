#!/usr/bin/env node
/**
 * Tag + scrub the branded Agentic Design Document (ADD) template so it can be
 * filled with source/LLM-derived data while keeping the original structure and
 * styling.
 *
 *   Templates/ADD.docx  ->  packages/core/assets/add-template.docx
 *
 * Same machinery as the SDD tagger: fill the control tables (version history,
 * sign-off, abbreviations) with docxtemplater `[[ ]]` loops, replace each prose
 * section body (matched by heading text) with `[[field]]` placeholders, insert
 * the two diagram markers, drop the trailing sample abbreviations, and scrub
 * guidance/sample runs.
 *
 * Re-run after changing Templates/ADD.docx:  node scripts/tag-add-template.js
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'Templates', 'ADD.docx');
const OUT_DIR = path.join(ROOT, 'packages', 'core', 'assets');
const OUT = path.join(OUT_DIR, 'add-template.docx');

// Tables in document order: 0 version history, 1 sign-off, 2 abbreviations,
// 3 = stray 1x1 sample table (dropped).
const FILL_SPECS = {
  0: ['[[#versionHistory]][[version]]', '[[description]]', '[[status]]', '[[changedBy]]', '[[approvedBy]]', '[[date]][[/versionHistory]]'],
  1: ['[[#signOff]][[num]]', '[[role]]', '[[nameEmail]]', '[[department]]', '[[signature]]', '[[date]][[/signOff]]'],
  2: ['[[#abbreviations]][[num]]', '[[term]]', '[[description]]', '[[remarks]][[/abbreviations]]'],
};
const DROP_TABLES = new Set([3]);

const FAKE_TOKENS = [
  'Femi Otu', 'John D', 'Jane D', 'Lorem', 'ipsum', 'Sample', 'example.com',
  'Contoso', 'Acme', 'Placeholder', 'placeholder',
];

function main() {
  const zip = new PizZip(fs.readFileSync(SRC));
  let xml = zip.file('word/document.xml').asText();

  xml = rewriteTables(xml);

  // H1 section intros (heading → its first H2): replace the narrative only.
  xml = replaceSectionBody(xml, 'Introduction', para('[[introOverview]]'));
  xml = replaceSectionBody(xml, 'Architecture Overview', para('[[architectureOverview]]'));
  xml = replaceSectionBody(xml, 'Agent Design Specification', para('[[designSpecOverview]]'));
  xml = replaceSectionBody(xml, 'Model Selection & Configuration', para('[[modelConfigOverview]]'));
  xml = replaceSectionBody(xml, 'Development & Build Process', para('[[devOverview]]'));
  xml = replaceSectionBody(xml, 'Evaluation & Optimization', para('[[evalOverview]]'));
  xml = replaceSectionBody(xml, 'Deployment Strategy', para('[[deployOverview]]'));
  xml = replaceSectionBody(xml, 'Operational Management', para('[[opsOverview]]'));
  xml = replaceSectionBody(xml, 'Compliance, Risk & Security', para('[[complianceOverview]]'));
  xml = replaceSectionBody(xml, 'Non-functional Requirements (NFRs)', para('[[nfrOverview]]'));

  // H2 leaf sections.
  xml = replaceSectionBody(xml, 'Purpose & Scope', para('[[purposeScope]]'));
  xml = replaceSectionBody(xml, 'Objectives', para('[[objectives]]'));
  xml = replaceSectionBody(xml, 'Constraints & Assumptions', para('[[constraintsAssumptions]]'));
  xml = replaceSectionBody(xml, 'Agentic Ecosystem', para('[[agenticEcosystem]]') + imageBlock('INSTADOCS_AGENT_ECO', 'Agentic ecosystem — the agent, its tools and the systems/people it collaborates with:'));
  xml = replaceSectionBody(xml, 'High-Level Flow Diagram', para('[[highLevelFlow]]') + imageBlock('INSTADOCS_AGENT_FLOW', 'High-level agent lifecycle:'));
  xml = replaceSectionBody(xml, 'Agent Role, Goals & Capabilities', para('[[agentRoleGoals]]'));
  xml = replaceSectionBody(xml, 'Input/Output Schema', para('[[ioSchema]]'));
  xml = replaceSectionBody(xml, 'Tools & Integrations', para('[[toolsIntegrations]]'));
  xml = replaceSectionBody(xml, 'Context & Knowledge Sources', para('[[contextKnowledge]]'));
  xml = replaceSectionBody(xml, 'Human-in-the-Loop & Escalations', para('[[humanInLoop]]'));
  xml = replaceSectionBody(xml, 'LLM or Custom Models', para('[[llmModels]]'));
  xml = replaceSectionBody(xml, 'Guardrails & Trust Settings', para('[[guardrails]]'));
  xml = replaceSectionBody(xml, 'Evaluation Settings', para('[[evaluationSettings]]'));
  xml = replaceSectionBody(xml, 'Studio Web / Agent Builder Overview', para('[[studioWebOverview]]'));
  xml = replaceSectionBody(xml, 'Workspace, Panels & Inspector', para('[[workspacePanels]]'));
  xml = replaceSectionBody(xml, 'Testing & Playground Iterations', para('[[testingPlayground]]'));
  xml = replaceSectionBody(xml, 'Evaluation Sets & Metrics', para('[[evalSets]]'));
  xml = replaceSectionBody(xml, 'Agent Scoring & Optimizer', para('[[agentScoring]]'));
  xml = replaceSectionBody(xml, 'Autopilot Suggestions & Refinement', para('[[autopilot]]'));
  xml = replaceSectionBody(xml, 'Monitoring & Tracing', para('[[monitoringTracing]]'));
  xml = replaceSectionBody(xml, 'Environments & Orchestrator', para('[[environments]]'));
  xml = replaceSectionBody(xml, 'Integration with Maestro', para('[[maestroIntegration]]'));
  xml = replaceSectionBody(xml, 'Security & Governance', para('[[securityGovernance]]'));
  xml = replaceSectionBody(xml, 'Monitoring & Health', para('[[monitoringHealth]]'));
  xml = replaceSectionBody(xml, 'Self-healing & Maintenance', para('[[selfHealing]]'));
  xml = replaceSectionBody(xml, 'Versioning & Updates', para('[[versioningUpdates]]'));
  xml = replaceSectionBody(xml, 'Data Residency & Governance', para('[[dataResidency]]'));
  xml = replaceSectionBody(xml, 'Trust Layer Policies', para('[[trustLayer]]'));
  xml = replaceSectionBody(xml, 'Escalation and Human Safety Controls', para('[[escalationControls]]'));
  xml = replaceSectionBody(xml, 'Performance', para('[[performance]]'));
  xml = replaceSectionBody(xml, 'Scalability', para('[[scalability]]'));
  xml = replaceSectionBody(xml, 'Reliability', para('[[reliability]]'));
  xml = replaceSectionBody(xml, 'Maintainability', para('[[maintainability]]'));
  xml = replaceSectionBody(xml, 'Usability', para('[[usability]]'));

  // H1 leaf sections (no sub-headings).
  xml = replaceSectionBody(xml, 'References', loopBlock('references', '[[.]]', ''));
  xml = replaceSectionBody(xml, 'Appendix', para('[[appendix]]'));

  // Cover page: replace the "<process Name>" placeholder with the project name.
  xml = xml.replace(/(<w:t[^>]*>)[^<]*process Name[^<]*(<\/w:t>)/i, `$1[[projectName]]$2`);

  // Remove the trailing sample abbreviation paragraphs after the abbrev table.
  xml = stripAfterAbbrev(xml);

  xml = scrubProse(xml);

  zip.file('word/document.xml', xml);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('Wrote', path.relative(ROOT, OUT));
}

// ---- entities ----
function decode(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/ /g, ' ');
}

// ---- tables ----
function rewriteTables(xml) {
  let ti = -1;
  return xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    ti++;
    if (DROP_TABLES.has(ti)) {
      console.log(`drop table #${ti}`);
      return '';
    }
    const spec = FILL_SPECS[ti];
    if (spec) return fillTable(tbl, spec, ti);
    return clearTableValues(tbl, ti);
  });
}

function fillTable(tbl, cols, ti) {
  const rows = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  if (rows.length < 2) return tbl;
  const headerCells = rows[0].match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
  const taggedRow = buildRow(headerCells, cols);
  const body = rows.slice(1).join('');
  if (!tbl.includes(body)) {
    console.warn(`fill #${ti}: body not contiguous`);
    return tbl;
  }
  console.log(`fill #${ti}: ${cols.length} cols`);
  return tbl.replace(body, taggedRow);
}

function clearTableValues(tbl, ti) {
  const rows = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  if (rows.length < 2) return tbl;
  const newRows = rows.map((row, ri) => {
    if (ri === 0) return row;
    const cells = row.match(/<w:tc>[\s\S]*?<\/w:tc>/g);
    if (!cells) return row;
    const kept = cells.map((cell, ci) => (ci === 0 ? cell : blankCellText(cell)));
    return row.replace(cells.join(''), kept.join(''));
  });
  const oldBody = rows.slice(1).join('');
  const newBody = newRows.slice(1).join('');
  if (tbl.includes(oldBody)) return tbl.replace(oldBody, newBody);
  return tbl;
}

function blankCellText(cell) {
  return cell.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/g, '$1$2');
}

function buildRow(headerCells, cols) {
  const cells = cols.map((text, c) => {
    const tcPr = cellTcPr(headerCells[c]);
    return (
      `<w:tc>${tcPr}<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/>` +
      `<w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr>` +
      `<w:r><w:rPr><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr>` +
      `<w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`
    );
  });
  return `<w:tr>${cells.join('')}</w:tr>`;
}

function cellTcPr(cell) {
  if (!cell) return '<w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>';
  const m = /<w:tcPr>[\s\S]*?<\/w:tcPr>/.exec(cell);
  return m ? m[0].replace(/<w:shd\b[^>]*\/>/g, '') : '<w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>';
}

// ---- prose blocks ----
function para(inner) {
  return (
    `<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/>` +
    `<w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:sz w:val="20"/></w:rPr>` +
    `<w:t xml:space="preserve">${inner}</w:t></w:r></w:p>`
  );
}

function loopBlock(loopName, boldTag, restTag) {
  const tagPara = (tag) =>
    `<w:p><w:pPr><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:t xml:space="preserve">${tag}</w:t></w:r></w:p>`;
  const bullet =
    `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/>` +
    `<w:numId w:val="1"/></w:numPr><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${boldTag}</w:t></w:r>` +
    (restTag ? `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${restTag}</w:t></w:r>` : '') +
    `</w:p>`;
  return tagPara(`[[#${loopName}]]`) + bullet + tagPara(`[[/${loopName}]]`);
}

function imageBlock(marker, caption) {
  const intro =
    `<w:p><w:pPr><w:rPr><w:i/><w:sz w:val="18"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:i/><w:sz w:val="18"/></w:rPr>` +
    `<w:t xml:space="preserve">${caption}</w:t></w:r></w:p>`;
  const image =
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    `<w:r><w:t xml:space="preserve">${marker}</w:t></w:r></w:p>`;
  return intro + image;
}

function replaceSectionBody(xml, headingText, insertXml) {
  const pRe = /<w:p\b(?:[^>]*\/>|[\s\S]*?<\/w:p>)/g;
  const ps = [];
  let m;
  while ((m = pRe.exec(xml))) ps.push({ start: m.index, end: m.index + m[0].length, xml: m[0] });

  const txt = (p) =>
    decode([...p.xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((x) => x[1]).join('')).trim();
  const isHeading = (p) => /<w:pStyle w:val="(Heading\d|Title)"/.test(p.xml);

  const hi = ps.findIndex((p) => isHeading(p) && txt(p) === headingText);
  if (hi < 0) {
    console.warn(`section heading not found: "${headingText}"`);
    return xml;
  }
  let ni = hi + 1;
  while (ni < ps.length && !isHeading(ps[ni])) ni++;

  const from = ps[hi].end;
  const to = ni < ps.length ? ps[ni].start : ps[hi].end;
  console.log(`section "${headingText}": replaced ${ni - hi - 1} paragraph(s)`);
  return xml.slice(0, from) + insertXml + xml.slice(to);
}

/** Blank the sample abbreviation paragraphs that follow the abbreviations table. */
function stripAfterAbbrev(xml) {
  const mi = xml.indexOf('[[/abbreviations]]');
  if (mi < 0) return xml;
  const tblEnd = xml.indexOf('</w:tbl>', mi);
  if (tblEnd < 0) return xml;
  const after = tblEnd + '</w:tbl>'.length;
  const sectIdx = xml.indexOf('<w:sectPr', after);
  const end = sectIdx >= 0 ? sectIdx : xml.length;
  const middle = xml.slice(after, end).replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/g, '$1$2');
  console.log('stripped trailing sample abbreviations');
  return xml.slice(0, after) + middle + xml.slice(end);
}

function scrubProse(xml) {
  let n = 0;
  const out = xml.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (mm, open, text, close) => {
    if (text.includes('[[')) return mm;
    if (text.includes('INSTADOCS_')) return mm;
    if (!text.trim()) return mm;

    const looksLikeCode = text.includes('[') || /&lt;=|&gt;=/.test(text);
    const hasAngle = /&lt;|&gt;/.test(text);
    const isGuidance = hasAngle && !looksLikeCode;
    const isEmail = /@/.test(text) || /https?:/i.test(text);
    const hasFake = !looksLikeCode && FAKE_TOKENS.some((tok) => text.includes(tok));

    if (isGuidance || isEmail || hasFake) {
      n++;
      return `${open}${close}`;
    }
    return mm;
  });
  console.log(`scrub: blanked ${n} sample run(s)`);
  return out;
}

main();
