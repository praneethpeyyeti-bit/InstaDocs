#!/usr/bin/env node
/**
 * Tag + scrub the branded SDD template so it can be filled with code-derived
 * data while keeping the original structure and styling.
 *
 *   Templates/SDD.docx  ->  packages/core/assets/sdd-template.docx
 *
 * Same machinery as the PDD tagger: fill tables by document order with
 * docxtemplater `[[ ]]` loops, clear other tables' value cells, replace
 * prose-section bodies (heading-style boundaries), scrub guidance/emails.
 *
 * Re-run after changing Templates/SDD.docx:  node scripts/tag-sdd-template.js
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'Templates', 'SDD.docx');
const OUT_DIR = path.join(ROOT, 'packages', 'core', 'assets');
const OUT = path.join(OUT_DIR, 'sdd-template.docx');

// Fill tables by document order (verified against the latest SDD.docx: 12
// tables, no leading logo table — Revision History is index 0).
const FILL_SPECS = {
  0: ['[[#revisions]][[rev]]', '[[date]]', '[[role]]', '[[summary]]', '[[author]][[/revisions]]'],
  1: ['[[#contacts]][[role]]', '[[name]]', '[[email]]', '[[org]][[/contacts]]'],
  2: ['[[#sourceDocs]][[title]]', '[[author]]', '[[version]]', '[[date]][[/sourceDocs]]'],
  3: ['[[#systemsPrereq]][[system]]', '[[requisite]][[/systemsPrereq]]'],
  4: ['[[#accessSettings]][[system]]', '[[detail]]', '[[level]]', '[[method]][[/accessSettings]]'],
  5: ['[[#robotInfo]][[item]]', '[[desc]][[/robotInfo]]'],
  6: ['[[#processes]][[name]]', '[[folderPath]]', '[[description]][[/processes]]'],
  7: ['[[#triggers]][[process]]', '[[type]]', '[[recurrence]]', '[[folderPath]]', '[[notes]][[/triggers]]'],
  8: ['[[#queues]][[name]]', '[[folderPath]]', '[[details]][[/queues]]'],
  9: ['[[#modules]][[name]]', '[[parent]]', '[[arguments]]', '[[reusable]]', '[[folderPath]]', '[[description]][[/modules]]'],
  10: ['[[#exceptions]][[code]]', '[[detail]]', '[[type]]', '[[botAction]]', '[[notification]][[/exceptions]]'],
  11: ['[[#complianceItems]][[item]]', '[[desc]][[/complianceItems]]'],
};

const FAKE_TOKENS = [
  'ABC', 'XYZ', 'John D', 'Jane D', 'Lorem', 'ipsum', 'Sample', 'example.com',
  'Contoso', 'Acme', 'Placeholder', 'placeholder',
];

function main() {
  const zip = new PizZip(fs.readFileSync(SRC));
  let xml = zip.file('word/document.xml').asText();

  xml = rewriteTables(xml);

  // Prose-only sections -> code/LLM-derived content (heading-style boundaries).
  xml = replaceSectionBody(xml, 'Introduction', para('[[purpose]]'));
  xml = replaceSectionBody(xml, 'Architectural structure', para('[[architecture]]') + imageBlock('INSTADOCS_ARCH', 'Solution architecture (components and data flow):'));
  xml = replaceSectionBody(xml, 'Summary', para('[[summary]]'));
  xml = replaceSectionBody(xml, 'Design specifications.', para('[[designSpecifications]]'));
  xml = replaceSectionBody(xml, 'Orchestrator Folder structure', para('[[orchestratorFolders]]'));
  xml = replaceSectionBody(xml, 'Orchestrator assets', loopBlock('orchestratorAssets', '[[item]]', ': [[desc]]'));
  xml = replaceSectionBody(xml, 'Initial design considerations', para('[[designConsiderations]]'));
  xml = replaceSectionBody(xml, 'Naming conventions', loopBlock('namingConventions', '[[.]]', ''));
  xml = replaceSectionBody(xml, 'High level process flow diagrams', imageBlock('INSTADOCS_FLOWCHART_MAIN', 'High-level process flow:'));
  xml = replaceSectionBody(xml, 'Reporting', para('[[reporting]]'));
  xml = replaceSectionBody(xml, 'Project folder structure', para('[[folderStructure]]'));
  xml = replaceSectionBody(xml, 'Process runs.', para('[[processRuns]]'));
  xml = replaceSectionBody(xml, 'Debugging tips', para('[[debuggingTips]]'));
  xml = replaceSectionBody(xml, 'Code and performance optimization techniques used.', para('[[optimizations]]'));
  xml = replaceSectionBody(xml, 'Code review, issues, and fixes', para('[[codeReview]]'));
  xml = replaceSectionBody(xml, 'Dependencies', loopBlock('dependencies', '[[name]][[version]]', ': [[purpose]]'));
  xml = replaceSectionBody(xml, 'External libraries', loopBlock('externalLibraries', '[[name]][[version]]', ': [[purpose]]'));
  xml = replaceSectionBody(xml, 'Future improvements', loopBlock('futureImprovements', '[[.]]', ''));
  xml = replaceSectionBody(xml, 'Data security and privacy considerations', para('[[dataSecurity]]'));
  xml = replaceSectionBody(xml, 'Glossary', loopBlock('glossary', '[[term]]', ': [[definition]]'));

  xml = scrubProse(xml);

  zip.file('word/document.xml', xml);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('Wrote', path.relative(ROOT, OUT));
}

function rewriteTables(xml) {
  let ti = -1;
  return xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    ti++;
    const spec = FILL_SPECS[ti];
    if (spec) return fillTable(tbl, spec, ti);
    return clearTableValues(tbl, ti);
  });
}

function fillTable(tbl, cols, ti) {
  const rows = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
  if (rows.length < 2) return tbl;
  // Header may span 1-2 rows; use the LAST header-looking row for cell styling.
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

function para(inner) {
  return (
    `<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/>` +
    `<w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:sz w:val="20"/></w:rPr>` +
    `<w:t xml:space="preserve">${inner}</w:t></w:r></w:p>`
  );
}

/** 3-paragraph loop block (open tag / repeating bullet / close tag). */
function loopBlock(loopName, boldTag, restTag) {
  const tagPara = (tag) =>
    `<w:p><w:pPr><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:t xml:space="preserve">${tag}</w:t></w:r></w:p>`;
  const bullet =
    `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/>` +
    `<w:numId w:val="1"/></w:numPr><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${boldTag}</w:t></w:r>` +
    (restTag
      ? `<w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${restTag}</w:t></w:r>`
      : '') +
    `</w:p>`;
  return tagPara(`[[#${loopName}]]`) + bullet + tagPara(`[[/${loopName}]]`);
}

/** Italic caption + a centered image placeholder (swapped by the exporter). */
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
    [...p.xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((x) => x[1]).join('').trim();
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

function scrubProse(xml) {
  let n = 0;
  const out = xml.replace(/(<w:t(?:\s[^>]*)?>)([\s\S]*?)(<\/w:t>)/g, (m, open, text, close) => {
    if (text.includes('[[')) return m;
    if (text.includes('INSTADOCS_')) return m; // image markers (arch/flow)
    if (!text.trim()) return m;

    const looksLikeCode = text.includes('[') || /&lt;=|&gt;=/.test(text);
    const hasAngle = /&lt;|&gt;/.test(text);
    const isGuidance = hasAngle && !looksLikeCode;
    const isEmail = /@/.test(text) || /https?:/i.test(text);
    const hasFake = !looksLikeCode && FAKE_TOKENS.some((tok) => text.includes(tok));

    if (isGuidance || isEmail || hasFake) {
      n++;
      return `${open}${close}`;
    }
    return m;
  });
  console.log(`scrub: blanked ${n} sample run(s)`);
  return out;
}

main();
