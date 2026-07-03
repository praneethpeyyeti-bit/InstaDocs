import { SddModel, TestScenario } from '../model/sdd';
import { AddModel } from '../model/add';

/** Render an SddModel to a compact Markdown preview for the VS Code webview. */
export function sddToMarkdown(m: SddModel): string {
  const L: string[] = [];
  const h = (t: string) => L.push(`\n## ${t}`);
  const p = (t?: string) => t && L.push(t);
  const table = (headers: string[], rows: string[][]) => {
    if (!rows.length) return;
    L.push('| ' + headers.join(' | ') + ' |');
    L.push('| ' + headers.map(() => '---').join(' | ') + ' |');
    for (const r of rows) L.push('| ' + r.map((c) => (c || '').replace(/\n/g, '<br>')).join(' | ') + ' |');
  };
  const bullets = (items: string[]) => items.forEach((i) => L.push(`- ${i}`));

  L.push(`# Solution Design Document — ${m.projectName}`);
  h('Purpose'); p(m.purpose);
  h('Summary'); p(m.summary);
  h('Architecture'); p(m.architecture);

  if (m.systemsPrereq.length) { h('Systems & Prerequisites'); table(['System', 'Requisite'], m.systemsPrereq.map((x) => [x.system, x.requisite])); }
  if (m.robotInfo.length) { h('Robot & Process Information'); table(['Item', 'Detail'], m.robotInfo.map((x) => [x.item, x.desc])); }
  if (m.processes.length) { h('Processes'); table(['Process', 'Folder', 'Description'], m.processes.map((x) => [x.name, x.folderPath, x.description])); }
  if (m.queues.length) { h('Queues'); table(['Queue', 'Folder', 'Details'], m.queues.map((x) => [x.name, x.folderPath, x.details])); }
  if (m.namingConventions.length) { h('Naming Conventions'); bullets(m.namingConventions); }
  if (m.modules.length) { h('Technical Process Design — Modules'); table(['Module', 'Parent', 'Args', 'Reusable', 'Description'], m.modules.map((x) => [x.name, x.parent, x.arguments, x.reusable, x.description])); }
  p('\n_High-level process flow diagram is embedded in the Word SDD._');
  if (m.exceptions.length) { h('Exceptions'); table(['Code', 'Detail', 'Type', 'Bot Action'], m.exceptions.map((x) => [x.code, x.detail, x.type, x.botAction])); }
  if (m.dependencies.length) { h('Dependencies'); bullets(m.dependencies.map((d) => `**${d.name}**${d.version ? ` (${d.version})` : ''} — ${d.purpose || ''}`)); }
  if (m.futureImprovements.length) { h('Future Improvements'); bullets(m.futureImprovements); }
  p(m.dataSecurity ? `\n## Data Security\n${m.dataSecurity}` : '');
  if (m.glossary.length) { h('Glossary'); table(['Term', 'Definition'], m.glossary.map((x) => [x.term, x.definition])); }

  return L.join('\n');
}

/** Render an AddModel to a compact Markdown preview for the VS Code webview. */
export function addToMarkdown(m: AddModel): string {
  const L: string[] = [];
  const h = (t: string) => L.push(`\n## ${t}`);
  const p = (t?: string) => t && L.push(t);
  const bullets = (items: string[]) => items.forEach((i) => L.push(`- ${i}`));
  const table = (headers: string[], rows: string[][]) => {
    if (!rows.length) return;
    L.push('| ' + headers.join(' | ') + ' |');
    L.push('| ' + headers.map(() => '---').join(' | ') + ' |');
    for (const r of rows) L.push('| ' + r.map((c) => (c || '').replace(/\n/g, '<br>')).join(' | ') + ' |');
  };

  L.push(`# Agentic Design Document — ${m.projectName}`);
  if (m.agentName) L.push(`_Agent: ${m.agentName}_`);
  h('Purpose & Scope'); p(m.purposeScope);
  h('Objectives'); p(m.objectives);
  h('Architecture Overview'); p(m.architectureOverview);
  h('Agentic Ecosystem'); p(m.agenticEcosystem);
  p('\n_Agentic ecosystem & high-level lifecycle diagrams are embedded in the Word ADD._');
  h('Agent Role, Goals & Capabilities'); p(m.agentRoleGoals);
  h('Input/Output Schema'); p(m.ioSchema);
  h('Tools & Integrations'); p(m.toolsIntegrations);
  h('Context & Knowledge Sources'); p(m.contextKnowledge);
  h('Human-in-the-Loop & Escalations'); p(m.humanInLoop);
  h('LLM / Model Configuration'); p(m.llmModels);
  h('Guardrails & Trust Settings'); p(m.guardrails);
  h('Deployment'); p(m.environments); p(m.maestroIntegration);
  h('Compliance, Risk & Security'); p(m.trustLayer); p(m.dataResidency);
  if (m.references.length) { h('References'); bullets(m.references); }
  if (m.abbreviations.length) { h('Abbreviations'); table(['Term', 'Description', 'Remarks'], m.abbreviations.map((x) => [x.term, x.description, x.remarks])); }

  return L.join('\n');
}

/** Render the test scenarios to a Markdown table for the preview. */
export function testCasesToMarkdown(m: { projectName: string; testScenarios: TestScenario[] }): string {
  const L: string[] = [`# Test Cases — ${m.projectName}`, ''];
  L.push('| ID | Title | Type | Expected Result |');
  L.push('| --- | --- | --- | --- |');
  for (const t of m.testScenarios) {
    L.push(`| ${t.id} | ${t.title} | ${t.type} | ${(t.expectedResult || '').replace(/\n/g, '<br>')} |`);
  }
  return L.join('\n');
}
