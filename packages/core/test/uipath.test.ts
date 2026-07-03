import { describe, expect, it } from 'vitest';
import * as path from 'path';
import { parseUiPath } from '../src/parse/uipath';

const fixture = path.join(__dirname, 'fixtures', 'uipath-sample');

describe('parseUiPath', () => {
  it('extracts project metadata and entry point', async () => {
    const graph = await parseUiPath(fixture);
    expect(graph.projectName).toBe('InvoiceProcessing');
    expect(graph.platform).toBe('uipath');
    expect(graph.entryPoints).toContain('Main.xaml');
  });

  it('extracts in/out arguments across workflows', async () => {
    const graph = await parseUiPath(fixture);
    const names = graph.arguments.map((a) => a.name);
    expect(names).toEqual(
      expect.arrayContaining(['in_InboxFolder', 'in_MaxAmount', 'out_ProcessedCount', 'in_Invoice'])
    );
    const out = graph.arguments.find((a) => a.name === 'out_ProcessedCount');
    expect(out?.direction).toBe('out');
  });

  it('captures branches, invokes, throws and try/catch', async () => {
    const graph = await parseUiPath(fixture);
    const kinds = graph.nodes.map((n) => n.kind);
    expect(kinds).toContain('if');
    expect(kinds).toContain('invoke');
    expect(kinds).toContain('throw');
    expect(graph.invocations.map((i) => i.target)).toContain('PostToFinance.xaml');
    expect(graph.tryCatches.length).toBeGreaterThan(0);
  });

  it('captures the If condition and annotations', async () => {
    const graph = await parseUiPath(fixture);
    const ifNode = graph.nodes.find((n) => n.kind === 'if');
    expect(String(ifNode?.raw.condition)).toMatch(/in_MaxAmount/);
    const annotated = graph.nodes.find((n) => n.annotations);
    expect(annotated?.annotations).toBeTruthy();
  });
});
