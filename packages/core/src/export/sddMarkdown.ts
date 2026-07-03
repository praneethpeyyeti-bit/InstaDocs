import { SddModel } from '../model/sdd';

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

/** Render the test scenarios to a Markdown table for the preview. */
export function testCasesToMarkdown(m: SddModel): string {
  const L: string[] = [`# Test Cases — ${m.projectName}`, ''];
  L.push('| ID | Title | Type | Expected Result |');
  L.push('| --- | --- | --- | --- |');
  for (const t of m.testScenarios) {
    L.push(`| ${t.id} | ${t.title} | ${t.type} | ${(t.expectedResult || '').replace(/\n/g, '<br>')} |`);
  }
  return L.join('\n');
}
