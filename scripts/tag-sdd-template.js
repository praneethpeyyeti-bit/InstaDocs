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

  // Remove the template's generic sample process diagrams (EMF metafiles — the
  // swimlane "High Level Design", sample architecture/folder-structure pictures).
  // They are boilerplate not linked to the parsed process; the real, grounded
  // architecture + high-level flow diagrams are inserted at the image markers.
  xml = stripSampleImages(xml, zip);

  xml = rewriteTables(xml);

  // Prose-only sections -> code/LLM-derived content (heading-style boundaries).
  xml = replaceSectionBody(xml, 'Introduction', para('[[purpose]]'));
  xml = replaceSectionBody(
    xml,
    'Architectural structure',
    para('[[architecture]]') +
      loopBlock('architecturePoints', '[[aspect]]', ': [[detail]]') +
      imageBlock('INSTADOCS_ARCH', 'Solution architecture (components and data flow):')
  );
  xml = replaceSectionBody(xml, 'Summary', para('[[summary]]'));
  xml = replaceSectionBody(xml, 'Design specifications.', bulletList('designSpecifications'));
  xml = replaceSectionBody(xml, 'Orchestrator Folder structure', para('[[orchestratorFolders]]'));
  xml = replaceSectionBody(
    xml,
    'Orchestrator assets',
    loopTable('orchestratorAssets', [
      { header: 'Asset', tag: '[[item]]', w: 3200 },
      { header: 'Type / Details', tag: '[[desc]]', w: 6000 },
    ])
  );
  xml = replaceSectionBody(xml, 'Initial design considerations', bulletList('designConsiderations'));
  xml = replaceSectionBody(xml, 'Naming conventions', loopBlock('namingConventions', '[[.]]', ''));
  xml = replaceSectionBody(
    xml,
    'High level process flow diagrams',
    imageBlock('INSTADOCS_FLOWCHART_MAIN', 'High-level process flow:') +
      imageBlock('INSTADOCS_FLOWCHART_PROJECTS', 'Per-process high-level flows:')
  );
  xml = replaceSectionBody(xml, 'Reporting', bulletList('reporting'));
  xml = replaceSectionBody(xml, 'Project folder structure', codeBlock('[[folderStructure]]'));
  xml = replaceSectionBody(xml, 'Process runs.', bulletList('processRuns'));
  xml = replaceSectionBody(xml, 'Debugging tips', bulletList('debuggingTips'));
  xml = replaceSectionBody(xml, 'Code and performance optimization techniques used.', bulletList('optimizations'));
  xml = replaceSectionBody(xml, 'Code review, issues, and fixes', bulletList('codeReview'));
  xml = replaceSectionBody(
    xml,
    'Dependencies',
    loopTable('dependencies', [
      { header: 'Package', tag: '[[name]]', w: 3400 },
      { header: 'Version', tag: '[[version]]', w: 1400 },
      { header: 'Purpose', tag: '[[purpose]]', w: 4400 },
    ])
  );
  xml = replaceSectionBody(
    xml,
    'External libraries',
    loopTable('externalLibraries', [
      { header: 'Library', tag: '[[name]]', w: 3400 },
      { header: 'Version', tag: '[[version]]', w: 1400 },
      { header: 'Purpose', tag: '[[purpose]]', w: 4400 },
    ])
  );
  xml = replaceSectionBody(xml, 'Future improvements', loopBlock('futureImprovements', '[[.]]', ''));
  xml = replaceSectionBody(xml, 'Data security and privacy considerations', bulletList('dataSecurity'));
  xml = replaceSectionBody(xml, 'Glossary', loopBlock('glossary', '[[term]]', ': [[definition]]'));

  // The "Process design" intro is generic guidance that references the (removed)
  // sample swim-lane — replace with a short accurate lead-in.
  xml = replaceSectionBody(
    xml,
    'Process design',
    para('This section describes how the solution is structured into reusable modules and its high-level process flow, including control flow, exception handling and retry mechanisms.')
  );

  // Cover page placeholders: {PROCESS NAME} → project name, {Description} → blurb.
  xml = xml.replace(/(<w:t[^>]*>)PROCESS NAME(<\/w:t>)/g, '$1[[projectName]]$2');
  xml = xml.replace(/(<w:t[^>]*>)\{Description\}(<\/w:t>)/g, '$1[[coverDescription]]$2');
  xml = xml.replace(/(<w:t[^>]*>)[{}](<\/w:t>)/g, '$1$2'); // drop stray "{" / "}" runs

  // Queue-item JSON after the Queues table (only rendered when queues are used).
  xml = insertQueueJson(xml);

  xml = scrubGuidanceParagraphs(xml);
  xml = scrubProse(xml);

  zip.file('word/document.xml', xml);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('Wrote', path.relative(ROOT, OUT));
}

/** Remove drawings/pictures that reference an .emf sample diagram. */
function stripSampleImages(xml, zip) {
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (!relsFile) return xml;
  const rels = relsFile.asText();
  const emf = new Set();
  for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="[^"]*\.emf"/gi)) emf.add(m[1]);
  if (!emf.size) return xml;

  const hasEmf = (block) => [...emf].some((id) => block.includes(`"${id}"`));
  let removed = 0;
  const strip = (re) => {
    xml = xml.replace(re, (block) => (hasEmf(block) ? ((removed++), '') : block));
  };
  // AlternateContent wraps the drawing + its VML fallback — remove as a unit first.
  strip(/<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g);
  // Sample diagrams are embedded Visio OLE objects (<w:object> with <v:imagedata>).
  strip(/<w:object\b[\s\S]*?<\/w:object>/g);
  strip(/<w:drawing>[\s\S]*?<\/w:drawing>/g);
  strip(/<w:pict>[\s\S]*?<\/w:pict>/g);
  console.log(`stripped ${removed} sample diagram(s) (EMF)`);
  return xml;
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

/** Monospace paragraph (Consolas) for trees / JSON, preserving whitespace + line breaks. */
function codeBlock(inner) {
  return (
    `<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>` +
    `<w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="16"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="16"/></w:rPr>` +
    `<w:t xml:space="preserve">${inner}</w:t></w:r></w:p>`
  );
}

/**
 * Replace everything in the Queues section after the queues table (the template's
 * sample JSON + guidance) with a conditional, code-derived queue-item JSON block.
 */
function insertQueueJson(xml) {
  const mi = xml.indexOf('[[/queues]]');
  if (mi < 0) return xml;
  const end = xml.indexOf('</w:tbl>', mi);
  if (end < 0) return xml;
  const at = end + '</w:tbl>'.length;
  // Drop the sample JSON/guidance up to the next heading.
  const rest = xml.slice(at);
  const hIdx = rest.search(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?w:pStyle w:val="Heading/);
  const cut = hIdx >= 0 ? at + hIdx : at;

  const openTag = (t) => `<w:p><w:pPr><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  const caption =
    `<w:p><w:pPr><w:spacing w:before="120"/><w:rPr><w:i/><w:sz w:val="18"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:i/><w:sz w:val="18"/></w:rPr>` +
    `<w:t xml:space="preserve">Representative queue item uploaded to Orchestrator (from Add/Bulk Add Queue Item):</w:t></w:r></w:p>`;
  const block = openTag('[[#hasQueueItem]]') + caption + codeBlock('[[queueItemJson]]') + openTag('[[/hasQueueItem]]');
  console.log('replaced queue sample with code-derived JSON block');
  return xml.slice(0, at) + block + xml.slice(cut);
}

const TAG_PARA = (tag) =>
  `<w:p><w:pPr><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:t xml:space="preserve">${tag}</w:t></w:r></w:p>`;

/**
 * A real bullet paragraph using a literal "•" glyph + hanging indent (NOT a
 * numbered <w:numPr> — the template's numId 1 is a decimal list, which is why
 * every list was rendering as "1. 2. 3.").
 */
function bulletPara(boldTag, restTag) {
  const rpr = '<w:rPr><w:sz w:val="20"/></w:rPr>';
  return (
    `<w:p><w:pPr><w:ind w:left="360" w:hanging="240"/><w:spacing w:after="40" w:line="240" w:lineRule="auto"/>${rpr}</w:pPr>` +
    `<w:r>${rpr}<w:t xml:space="preserve">•  </w:t></w:r>` +
    (boldTag ? `<w:r><w:rPr><w:b/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${boldTag}</w:t></w:r>` : '') +
    (restTag ? `<w:r>${rpr}<w:t xml:space="preserve">${restTag}</w:t></w:r>` : '') +
    `</w:p>`
  );
}

/** Plain bulleted list bound to a string[] loop (one bullet per item). */
function bulletList(loopName) {
  return TAG_PARA(`[[#${loopName}]]`) + bulletPara('', '[[.]]') + TAG_PARA(`[[/${loopName}]]`);
}

/** 3-paragraph loop block: open tag / repeating bullet / close tag. */
function loopBlock(loopName, boldTag, restTag) {
  return TAG_PARA(`[[#${loopName}]]`) + bulletPara(boldTag, restTag) + TAG_PARA(`[[/${loopName}]]`);
}

/**
 * A bordered table bound to an object[] loop — one row per item. `columns` is
 * [{header, tag, w}] (w = column width in twips). The row `<w:tr>` repeats via
 * docxtemplater ([[#loop]] in the first cell, [[/loop]] in the last).
 */
function loopTable(loopName, columns) {
  const totalW = columns.reduce((s, c) => s + c.w, 0);
  const grid = columns.map((c) => `<w:gridCol w:w="${c.w}"/>`).join('');
  const side = (s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="BFBFBF"/>`;
  const borders = `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(side).join('')}</w:tblBorders>`;
  const headCell = (c) =>
    `<w:tc><w:tcPr><w:tcW w:w="${c.w}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="D9E1F2"/></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:rPr><w:b/><w:sz w:val="18"/></w:rPr></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${c.header}</w:t></w:r></w:p></w:tc>`;
  const dataCell = (c, i) => {
    const open = i === 0 ? `[[#${loopName}]]` : '';
    const close = i === columns.length - 1 ? `[[/${loopName}]]` : '';
    return (
      `<w:tc><w:tcPr><w:tcW w:w="${c.w}" w:type="dxa"/></w:tcPr>` +
      `<w:p><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:rPr><w:sz w:val="18"/></w:rPr></w:pPr>` +
      `<w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${open}${c.tag}${close}</w:t></w:r></w:p></w:tc>`
    );
  };
  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${totalW}" w:type="dxa"/>${borders}<w:tblLayout w:type="fixed"/></w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>` +
    `<w:tr>${columns.map(headCell).join('')}</w:tr>` +
    `<w:tr>${columns.map(dataCell).join('')}</w:tr></w:tbl>` +
    `<w:p><w:pPr><w:spacing w:after="0"/><w:rPr><w:sz w:val="4"/></w:rPr></w:pPr></w:p>` // spacer so adjacent tables don't merge
  );
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

/**
 * Blank whole paragraphs that are pure template guidance (their combined text is
 * wrapped in <…>), which per-run scrubbing misses when the < and > sit in
 * separate runs.
 */
function scrubGuidanceParagraphs(xml) {
  let n = 0;
  const out = xml.replace(/<w:p\b(?:[^>]*\/>|[\s\S]*?<\/w:p>)/g, (p) => {
    const text = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('').trim();
    if (!text || text.includes('[[') || text.includes('INSTADOCS_')) return p;
    const guidance = /^(&lt;|<)[\s\S]*(&gt;|>)$/.test(text);
    if (!guidance) return p;
    n++;
    return p.replace(/(<w:t(?:\s[^>]*)?>)[\s\S]*?(<\/w:t>)/g, '$1$2');
  });
  console.log(`scrub guidance paragraphs: blanked ${n}`);
  return out;
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
