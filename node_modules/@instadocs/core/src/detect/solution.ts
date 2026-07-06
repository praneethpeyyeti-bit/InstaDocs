import * as fs from 'fs';
import * as path from 'path';
import { exists, readText } from '../util/files';

export interface ProjectRef {
  /** Display name — the role (Dispatcher / Performer / Reporter) when derivable,
   *  else the project.json name. Used for flow labels and test-case sheet names. */
  name: string;
  /** The raw project.json name (e.g. "ClaimsBot_Dispatcher"). Used to derive the
   *  shared <ProcessName> for the solution title. */
  fullName: string;
  /** Absolute path to the project folder. */
  dir: string;
}

const ROLE_RE = /(Dispatcher|Performer|Reporter|Process)$/i;

/** Strip a trailing role from "<ProcessName>_Dispatcher" → "<ProcessName>". */
export function stripRole(name: string): string {
  return name.replace(/[_\-\s]?(Dispatcher|Performer|Reporter|Process)$/i, '').trim();
}

/**
 * Discover the UiPath projects in a folder.
 *
 *  - If the folder itself is a project (has project.json), it is a single
 *    project → returns `[thatProject]`.
 *  - Otherwise it is treated as a SOLUTION folder: every immediate subfolder
 *    that contains a project.json is returned (e.g. Dispatcher / Performer /
 *    Reporter). Ordered Dispatcher → Performer → Reporter → rest for readability.
 *
 * Returns `[]` when nothing project-like is found.
 */
export function discoverProjects(workingDir: string): ProjectRef[] {
  const rootPj = path.join(workingDir, 'project.json');
  if (exists(rootPj)) {
    const full = readProjectName(workingDir);
    return [{ name: displayName(workingDir), fullName: full, dir: workingDir }];
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(workingDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const subs: ProjectRef[] = [];
  for (const e of entries) {
    if (!e.isDirectory() || e.name.startsWith('.')) continue;
    const dir = path.join(workingDir, e.name);
    if (exists(path.join(dir, 'project.json'))) subs.push({ name: displayName(dir), fullName: readProjectName(dir), dir });
  }
  return subs.sort(byRole);
}

/** True when the folder holds more than one project (a solution). */
export function isSolution(workingDir: string): boolean {
  return discoverProjects(workingDir).length > 1;
}

const ROLE_ORDER = ['dispatch', 'performer', 'perform', 'process', 'report'];
function byRole(a: ProjectRef, b: ProjectRef): number {
  const rank = (r: ProjectRef) => {
    const hay = `${r.name} ${path.basename(r.dir)}`.toLowerCase();
    const i = ROLE_ORDER.findIndex((k) => hay.includes(k));
    return i < 0 ? ROLE_ORDER.length : i;
  };
  const d = rank(a) - rank(b);
  return d !== 0 ? d : a.name.localeCompare(b.name);
}

/**
 * A project's display name (role) inside a solution. Prefers a clear REFramework
 * role from the folder name (e.g. "Performer") or from a "<ProcessName>_Performer"
 * project.json name; otherwise falls back to the project.json name.
 */
function displayName(dir: string): string {
  const folder = path.basename(dir);
  if (/^(dispatcher|performer|reporter|process)$/i.test(folder)) return cap(folder);
  const pj = readProjectName(dir);
  const m = ROLE_RE.exec(pj);
  if (m) return cap(m[1]);
  return pj;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function readProjectName(dir: string): string {
  const pj = path.join(dir, 'project.json');
  if (exists(pj)) {
    try {
      const obj = JSON.parse(readText(pj));
      if (obj.name) return String(obj.name);
    } catch {
      /* ignore */
    }
  }
  return path.basename(dir);
}
