import * as fs from 'fs';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { SddModel } from '../model/sdd';
import { ProcessGraph } from '../model/ir';
import { renderSwimlane, renderReframeworkStates, renderArchitecture, isReframework, ArchSystem } from './flowchart';
import { resolveAsset } from './assets';

const FLOWCHART_MARKER = 'INSTADOCS_FLOWCHART_MAIN';
const ARCH_MARKER = 'INSTADOCS_ARCH';
const EMU_PER_PX = 9525;
const MAX_IMG_WIDTH_PX = 600;

/**
 * Fill the branded SDD Word template with code/LLM-derived data and return a
 * .docx buffer.
 *
 * `assets/sdd-template.docx` is a tagged + scrubbed copy of the corporate
 * `Templates/SDD.docx` (see `scripts/tag-sdd-template.js`): technical tables
 * carry `[[ ]]` loops, prose sections are replaced with `[[ ]]` fields, and
 * sample data/guidance is removed — so the output keeps the original structure
 * and styling while containing only source-derived content.
 */
export function defaultSddTemplatePath(): string {
  return resolveAsset('sdd-template.docx');
}

export function fillSddDocx(
  model: SddModel,
  graph: ProcessGraph,
  generatedOn: string,
  templatePath = defaultSddTemplatePath()
): Buffer {
  const zip = new PizZip(fs.readFileSync(templatePath));
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '[[', end: ']]' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });

  doc.render(buildData(model, generatedOn));

  const outZip = doc.getZip();
  ensurePngContentType(outZip);

  // Architecture diagram — robot + the systems it integrates with.
  embedImage(outZip, ARCH_MARKER, 'instadocs-arch.png', renderArchitecture(model.projectName, archSystems(model)), 9301);

  // Process-design diagram — REFramework state machine (4 states) when the
  // project is REFramework, otherwise the application-segregated swimlane.
  const flow = isReframework(graph) ? renderReframeworkStates() : renderSwimlane(graph);
  embedImage(outZip, FLOWCHART_MARKER, 'instadocs-flow.png', flow, 9001);

  return outZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

/**
 * Derive architecture-diagram systems from the model. Uses `accessSettings`
 * (authoritative — it carries the access method); `systemsPrereq` is only a
 * fallback when access settings are absent (the two often reword the same
 * systems, which would otherwise duplicate boxes).
 */
function archSystems(model: SddModel): ArchSystem[] {
  const source: ArchSystem[] = model.accessSettings.length
    ? model.accessSettings.map((a) => ({ name: a.system, method: a.method }))
    : model.systemsPrereq.map((s) => ({ name: s.system }));

  // Fuzzy key: drop parentheticals / "UiPath" / punctuation / trailing version
  // tokens so "UiPath Test Manager API v2" and "Test Manager (REST API)" merge.
  const key = (name: string) =>
    name
      .toLowerCase()
      .replace(/\(.*?\)/g, '')
      .replace(/\buipath\b|\bapi\b|\brest\b|\bv?\d+(\.\d+)?\b/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .join(' ');

  const seen = new Set<string>();
  const out: ArchSystem[] = [];
  const add = (s: ArchSystem) => {
    const k = key(s.name);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };
  for (const s of source) add(s);
  if (model.queues.length && !out.some((s) => /orchestrator/i.test(s.name))) add({ name: 'UiPath Orchestrator', method: 'Queues/Assets' });
  return out.slice(0, 6);
}

function buildData(model: SddModel, generatedOn: string): Record<string, unknown> {
  const orDash = <T,>(arr: T[], make: () => T): T[] => (arr.length ? arr : [make()]);

  return {
    projectName: model.projectName,
    platformLabel: model.platformLabel,
    generatedOn,

    purpose: model.purpose,
    summary: model.summary,
    architecture: model.architecture,
    designSpecifications: model.designSpecifications,
    orchestratorFolders: model.orchestratorFolders,
    designConsiderations: model.designConsiderations,
    reporting: model.reporting,
    folderStructure: model.folderStructure,
    processRuns: model.processRuns,
    debuggingTips: model.debuggingTips,
    optimizations: model.optimizations,
    codeReview: model.codeReview,
    dataSecurity: model.dataSecurity,

    revisions: orDash(
      model.revisions.length
        ? model.revisions
        : [{ rev: '1.0', date: generatedOn, role: 'InstaDocs', summary: 'Initial draft auto-generated from source code', author: 'InstaDocs' }],
      () => ({ rev: '', date: '', role: '', summary: '', author: '' })
    ),
    contacts: orDash(model.contacts, () => ({ role: 'To be provided by SME', name: '', email: '', org: '' })),
    sourceDocs: orDash(model.sourceDocuments, () => ({ title: 'AGENTS.md (project discovery context)', author: 'UiPath Project Discovery', version: '', date: generatedOn })),
    systemsPrereq: orDash(model.systemsPrereq, () => ({ system: '', requisite: '' })),
    accessSettings: orDash(model.accessSettings, () => ({ system: '', detail: '', level: '', method: '' })),
    robotInfo: orDash(model.robotInfo, () => ({ item: '', desc: '' })),
    processes: orDash(model.processes, () => ({ name: '', folderPath: '', description: '' })),
    triggers: orDash(model.triggers, () => ({ process: '', type: '', recurrence: '', folderPath: '', notes: '' })),
    queues: orDash(model.queues, () => ({ name: '', folderPath: '', details: '' })),
    orchestratorAssets: orDash(model.orchestratorAssets, () => ({ item: '', desc: '' })),
    namingConventions: model.namingConventions,
    modules: orDash(model.modules, () => ({ name: '', parent: '', arguments: '', reusable: '', folderPath: '', description: '' })),
    exceptions: orDash(model.exceptions, () => ({ code: '', detail: '', type: '', botAction: '', notification: '' })),
    dependencies: model.dependencies.map(withVersion),
    externalLibraries: model.externalLibraries.map(withVersion),
    futureImprovements: model.futureImprovements,
    complianceItems: orDash(model.complianceItems, () => ({ item: '', desc: '' })),
    glossary: orDash(model.glossary, () => ({ term: '', definition: '' })),
  };

  function withVersion(l: { name: string; version?: string; purpose?: string }) {
    return { name: l.name, version: l.version ? ` (${l.version})` : '', purpose: l.purpose || '' };
  }
}

function ensurePngContentType(zip: PizZip): void {
  const ctPath = '[Content_Types].xml';
  let ct = zip.file(ctPath)!.asText();
  if (!/Extension="png"/i.test(ct)) {
    ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
    zip.file(ctPath, ct);
  }
}

function embedImage(
  zip: PizZip,
  marker: string,
  mediaName: string,
  image: { png: Buffer; width: number; height: number },
  idBase: number,
  maxWidthPx = MAX_IMG_WIDTH_PX
): void {
  let docXml = zip.file('word/document.xml')!.asText();
  if (!docXml.includes(marker)) return;

  const [wPx, hPx] = fitToPage(image.width, image.height, maxWidthPx);
  const cx = Math.round(wPx * EMU_PER_PX);
  const cy = Math.round(hPx * EMU_PER_PX);

  zip.file(`word/media/${mediaName}`, image.png);

  const relsPath = 'word/_rels/document.xml.rels';
  const rId = `rIdInsta_${mediaName.replace(/[^a-z0-9]/gi, '')}`;
  let rels = zip.file(relsPath)!.asText();
  if (!rels.includes(rId)) {
    rels = rels.replace(
      '</Relationships>',
      `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`
    );
    zip.file(relsPath, rels);
  }

  let n = 0;
  docXml = docXml.replace(new RegExp(`<w:t[^>]*>${marker}</w:t>`, 'g'), () => drawingXml(rId, cx, cy, idBase + n++));
  zip.file('word/document.xml', docXml);
}

function drawingXml(rId: string, cx: number, cy: number, id: number): string {
  return (
    `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" ` +
    `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${id}" name="ProcessFlowchart${id}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="ProcessFlowchart${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`
  );
}

function fitToPage(width: number, height: number, maxW = MAX_IMG_WIDTH_PX): [number, number] {
  if (width <= maxW) return [width, height];
  const scale = maxW / width;
  return [Math.round(width * scale), Math.round(height * scale)];
}
