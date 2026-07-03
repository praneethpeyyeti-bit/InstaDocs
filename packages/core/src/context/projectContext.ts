import * as path from 'path';
import {
  ContextDependency,
  ContextEntryPoint,
  ContextKeyWorkflow,
  ProjectContext,
  ProjectContextOverview,
} from '../model/context';
import { exists, readText } from '../util/files';

/**
 * Locate and parse a UiPath "Project Context" document produced by the
 * `uipath-project-discovery-agent`.
 *
 * Locations, in priority order:
 *   1. AGENTS.md — the block between <!-- PROJECT-CONTEXT:START --> and
 *      <!-- PROJECT-CONTEXT:END --> (the cross-agent convention).
 *   2. .claude/rules/project-context.md — the full file.
 *
 * Returns undefined when no discovery document is present, so the pipeline
 * cleanly falls back to InstaDocs' own project.json parse.
 */
export function loadProjectContext(workingDir: string): ProjectContext | undefined {
  const found = locate(workingDir);
  if (!found) return undefined;
  return parseProjectContext(found.raw, found.source);
}

const START = '<!-- PROJECT-CONTEXT:START -->';
const END = '<!-- PROJECT-CONTEXT:END -->';

function locate(workingDir: string): { raw: string; source: string } | undefined {
  const agents = path.join(workingDir, 'AGENTS.md');
  if (exists(agents)) {
    const text = readText(agents);
    const s = text.indexOf(START);
    const e = text.indexOf(END);
    if (s >= 0 && e > s) {
      return { raw: text.slice(s + START.length, e).trim(), source: 'AGENTS.md' };
    }
    if (isContextDoc(text)) return { raw: text, source: 'AGENTS.md' };
  }

  const rules = path.join(workingDir, '.claude', 'rules', 'project-context.md');
  if (exists(rules)) {
    const text = readText(rules);
    if (isContextDoc(text)) return { raw: text, source: '.claude/rules/project-context.md' };
  }
  return undefined;
}

/** A discovery doc is identified by its metadata comment or the title suffix. */
function isContextDoc(text: string): boolean {
  return /<!--\s*discovery-metadata:/.test(text) || /—\s*Project Context/.test(text);
}

export function parseProjectContext(raw: string, source: string): ProjectContext {
  const sections = splitSections(raw);
  return {
    raw,
    source,
    overview: parseOverview(sections['Overview']),
    dependencies: parseDependencies(sections['Dependencies']),
    entryPoints: parseEntryPoints(sections['Entry Points']),
    keyWorkflows: parseKeyWorkflows(sections['Key Workflows']),
    conventions: parseBullets(sections['Conventions']),
    architecture: sections['Architecture']?.trim() || undefined,
  };
}

/** Split markdown into a map of `## Heading` -> body text. */
function splitSections(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^##\s+(.+?)\s*$/gm;
  const matches = [...md.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : md.length;
    out[title] = md.slice(start, end).trim();
  }
  return out;
}

/** Parse a GitHub-flavored markdown table into rows of trimmed cells. */
function parseTable(body?: string): string[][] {
  if (!body) return [];
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));
  const rows: string[][] = [];
  for (const line of lines) {
    if (/^\|[\s:|-]+\|?$/.test(line)) continue; // separator row
    const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    rows.push(cells);
  }
  // Drop the header row if present.
  if (rows.length && /package|file|workflow|name|item/i.test(rows[0].join(' '))) rows.shift();
  return rows;
}

function parseOverview(body?: string): ProjectContextOverview | undefined {
  const rows = parseTable(body);
  if (!rows.length) return undefined;
  const ov: ProjectContextOverview = {};
  // Overview is often a 2-col key/value table, or a single wide row.
  for (const r of rows) {
    if (r.length >= 2) assignOverview(ov, r[0], r[1]);
  }
  return Object.keys(ov).length ? ov : undefined;
}

function assignOverview(ov: ProjectContextOverview, key: string, value: string): void {
  const k = key.toLowerCase();
  if (/name/.test(k)) ov.name = value;
  else if (/type/.test(k)) ov.type = value;
  else if (/description/.test(k)) ov.description = value;
  else if (/framework/.test(k)) ov.targetFramework = value;
  else if (/expression|language/.test(k)) ov.expressionLanguage = value;
}

function parseDependencies(body?: string): ContextDependency[] {
  return parseTable(body).map((r) => ({
    package: r[0] ?? '',
    version: r[1],
    category: r[2],
    description: r[3],
  })).filter((d) => d.package);
}

function parseEntryPoints(body?: string): ContextEntryPoint[] {
  return parseTable(body).map((r) => ({
    file: r[0] ?? '',
    inputs: r[1],
    outputs: r[2],
    purpose: r[3],
  })).filter((e) => e.file);
}

function parseKeyWorkflows(body?: string): ContextKeyWorkflow[] {
  return parseTable(body).map((r) => ({
    workflow: r[0] ?? '',
    purpose: r[1],
    uses: r[2],
  })).filter((w) => w.workflow);
}

/**
 * Map UiPath dependency packages to the business applications/systems they
 * imply, for the PDD "Applications Used" section. Shared by the deterministic
 * fallback and the template fill.
 */
/** Map a single dependency package to the application/system it implies. */
export function packageToApp(pkg: string): string | undefined {
  const p = pkg.toLowerCase();
  if (/\.excel\./.test(p)) return 'MS Excel';
  if (/\.mail\.|\.outlook/.test(p)) return 'Email (Outlook/SMTP)';
  if (/\.word\./.test(p)) return 'MS Word';
  if (/\.database\.|\.sql/.test(p)) return 'Database';
  if (/\.web(api)?\.|\.http/.test(p)) return 'HTTP/REST API';
  if (/\.ui\.?automation|\.uiautomation/.test(p)) return 'Desktop/Web UI';
  if (/\.pdf\./.test(p)) return 'PDF documents';
  if (/\.ftp/.test(p)) return 'FTP';
  if (/\.salesforce/.test(p)) return 'Salesforce';
  if (/\.sap/.test(p)) return 'SAP';
  return undefined;
}

export function dependenciesToApplications(deps: ContextDependency[]): string[] {
  const apps = new Set<string>();
  for (const d of deps) {
    const app = packageToApp(d.package);
    if (app) apps.add(app);
  }
  return [...apps];
}

function parseBullets(body?: string): string[] {
  if (!body) return [];
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}
