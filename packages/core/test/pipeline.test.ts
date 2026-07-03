import { describe, expect, it } from 'vitest';
import * as path from 'path';
import PizZip from 'pizzip';
import { parseProject, loadProjectContext } from '../src/index';
import { deterministicSdd } from '../src/analyze/sdd';
import { sddToMarkdown, testCasesToMarkdown } from '../src/export/sddMarkdown';
import { fillSddDocx } from '../src/export/sddTemplate';
import { fillTestCasesXlsx } from '../src/export/testcasesTemplate';
import { ProcessGraph } from '../src/model/ir';

function docxText(buf: Buffer): string {
  const xml = new PizZip(buf).file('word/document.xml')!.asText();
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(' ');
}

const fixture = path.join(__dirname, 'fixtures', 'uipath-sample');

// The runtime is LLM-only (no deterministic fallback in the pipeline), so the
// tests exercise the parser + SDD model builder + template fillers directly and
// offline, using `deterministicSdd` as a deterministic model source.
async function buildGraph(): Promise<ProcessGraph> {
  const graph = await parseProject('uipath', fixture);
  const ctx = loadProjectContext(fixture);
  if (ctx) graph.projectContext = ctx;
  return graph;
}

describe('SDD generation (offline components)', () => {
  it('builds an SDD model with modules, dependencies and test scenarios', async () => {
    const graph = await buildGraph();
    const model = deterministicSdd(graph);

    expect(model.projectName).toBe('InvoiceProcessing');
    expect(model.modules.length).toBeGreaterThan(0);
    expect(model.dependencies.length).toBeGreaterThan(0);
    expect(model.testScenarios.length).toBeGreaterThan(0);

    expect(sddToMarkdown(model)).toMatch(/Solution Design Document/);
    expect(testCasesToMarkdown(model)).toMatch(/Test Cases/);
  });

  it('fills the branded SDD template with diagrams and no unresolved tags', async () => {
    const graph = await buildGraph();
    const buf = fillSddDocx(deterministicSdd(graph), graph, '2026-07-02');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK'); // docx zip magic

    const zip = new PizZip(buf);
    // Architecture diagram + process-design diagram are embedded as PNGs.
    const media = Object.keys(zip.files).filter((f) => /word\/media\/instadocs-.*\.png$/i.test(f));
    expect(media.length).toBeGreaterThanOrEqual(2);
    expect(zip.file('[Content_Types].xml')!.asText()).toMatch(/image\/png/);

    const text = docxText(buf);
    expect(text).not.toMatch(/\[\[/); // all placeholders resolved
    expect(text).not.toMatch(/INSTADOCS_/); // all image markers swapped
  });

  it('fills the Test Case xlsx template from the SDD model', async () => {
    const graph = await buildGraph();
    const model = deterministicSdd(graph);
    const buf = await fillTestCasesXlsx({ projectName: model.projectName, testScenarios: model.testScenarios });
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK'); // xlsx zip magic

    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.getWorksheet('UAT Test Cases')!;
    expect(ws.getCell('B1').value).toBe('InvoiceProcessing');
    expect(String(ws.getCell('D8').value)).toMatch(/^TC-/);
  });
});
