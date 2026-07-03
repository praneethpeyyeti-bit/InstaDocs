import { describe, expect, it } from 'vitest';
import * as path from 'path';
import PizZip from 'pizzip';
import { parseProject } from '../src/index';
import { parseAgent } from '../src/parse/agent';
import { AddModel, AddModelSchema } from '../src/model/add';
import { fillAddDocx } from '../src/export/addTemplate';
import { addToMarkdown, testCasesToMarkdown } from '../src/export/sddMarkdown';
import { ProcessGraph } from '../src/model/ir';

const agentFixture = path.join(__dirname, 'fixtures', 'uipath-agent');

function docxText(buf: Buffer): string {
  const xml = new PizZip(buf).file('word/document.xml')!.asText();
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join(' ');
}

/** Offline AddModel source (stands in for the LLM output) for template tests. */
function sampleAddModel(graph: ProcessGraph): AddModel {
  const a = graph.agent!;
  return AddModelSchema.parse({
    projectName: graph.projectName,
    agentName: a.name,
    platformLabel: 'UiPath',
    purposeScope: 'Triage invoices and escalate exceptions.',
    agentRoleGoals: 'Accounts-payable triage assistant.',
    ioSchema: a.inputs.map((i) => i.name).join(', '),
    toolsIntegrations: a.tools.map((t) => t.name).join(', '),
    llmModels: a.model?.name ?? '',
    humanInLoop: a.escalations.map((e) => e.name).join(', '),
    abbreviations: [{ term: 'ADD', description: 'Agentic Design Document', remarks: '' }],
    testScenarios: [
      { id: 'TC-01', title: 'Happy path', type: 'positive', expectedResult: 'Auto-approved.' },
    ],
  });
}

describe('agentic parsing', () => {
  it('parses a low-code agent.json into an AgentSpec', () => {
    const spec = parseAgent(agentFixture);
    expect(spec).toBeDefined();
    expect(spec!.kind).toBe('lowCode');
    expect(spec!.name).toBe('InvoiceTriageAgent');
    expect(spec!.model?.name).toBe('gpt-4o-2024-08-06');
    expect(spec!.systemPrompt).toMatch(/accounts-payable/i);
    expect(spec!.tools.map((t) => t.name)).toContain('PostInvoiceToFinance');
    expect(spec!.inputs.map((i) => i.name)).toContain('invoiceEmail');
    expect(spec!.outputs.map((o) => o.name)).toContain('decision');
    expect(spec!.escalations.length).toBeGreaterThan(0);
    expect(spec!.knowledge.length).toBeGreaterThan(0);
    expect(spec!.guardrails.length).toBeGreaterThan(0);
  });

  it('attaches the agent spec to the ProcessGraph', async () => {
    const graph = await parseProject('uipath', agentFixture);
    expect(graph.agent).toBeDefined();
    expect(graph.agent!.name).toBe('InvoiceTriageAgent');
  });
});

describe('ADD generation (offline components)', () => {
  it('fills the branded ADD template with diagrams and no unresolved tags', async () => {
    const graph = await parseProject('uipath', agentFixture);
    const buf = fillAddDocx(sampleAddModel(graph), graph, '2026-07-03');
    expect(buf.subarray(0, 2).toString('utf8')).toBe('PK'); // docx zip magic

    const zip = new PizZip(buf);
    const media = Object.keys(zip.files).filter((f) => /word\/media\/instadocs-agent-.*\.png$/i.test(f));
    expect(media.length).toBeGreaterThanOrEqual(2); // ecosystem + lifecycle diagrams
    expect(zip.file('[Content_Types].xml')!.asText()).toMatch(/image\/png/);

    const text = docxText(buf);
    expect(text).not.toMatch(/\[\[/); // all placeholders resolved
    expect(text).not.toMatch(/INSTADOCS_/); // all image markers swapped
    expect(text).toMatch(/InvoiceTriageAgent/);
    expect(text).toMatch(/PostInvoiceToFinance/);
  });

  it('renders an agentic markdown preview', async () => {
    const graph = await parseProject('uipath', agentFixture);
    const model = sampleAddModel(graph);
    expect(addToMarkdown(model)).toMatch(/Agentic Design Document/);
    expect(testCasesToMarkdown(model)).toMatch(/Test Cases/);
  });
});
