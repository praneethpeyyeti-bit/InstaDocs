import * as fs from 'fs';
import * as path from 'path';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.vs',
  'dist',
  'out',
  '.local',
  '.settings',
  '.objects',
]);

export interface WalkOptions {
  /** Lowercase extensions to include, with dot (e.g. ['.xaml', '.cs']). Empty = all. */
  extensions?: string[];
  maxFiles?: number;
}

/** Recursively list files under `root`, skipping noise directories. */
export function walkFiles(root: string, options: WalkOptions = {}): string[] {
  const { extensions, maxFiles = 20000 } = options;
  const results: string[] = [];
  const stack: string[] = [root];

  while (stack.length && results.length < maxFiles) {
    const dir = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        if (!extensions || extensions.includes(path.extname(entry.name).toLowerCase())) {
          results.push(full);
        }
      }
    }
  }
  return results;
}

/**
 * Render a clean ASCII folder tree for `root` (folders first, a few key files),
 * skipping noise dirs. Used for the SDD "Project folder structure" section.
 */
export function folderTree(root: string, maxDepth = 2, maxLines = 40): string {
  const lines: string[] = [`${path.basename(root)}/`];
  const walk = (dir: string, prefix: string, depth: number): void => {
    if (depth > maxDepth || lines.length >= maxLines) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const dirs = entries
      .filter((e) => e.isDirectory() && !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter((e) => e.isFile() && !e.name.startsWith('.'));
    const shownFiles = files.slice(0, depth === 0 ? 6 : 3);
    const items = [
      ...dirs.map((d) => ({ name: d.name, dir: true })),
      ...shownFiles.map((f) => ({ name: f.name, dir: false })),
    ];
    items.forEach((it, i) => {
      if (lines.length >= maxLines) return;
      const last = i === items.length - 1 && files.length <= shownFiles.length;
      lines.push(`${prefix}${last ? '└─ ' : '├─ '}${it.name}${it.dir ? '/' : ''}`);
      if (it.dir) walk(path.join(dir, it.name), prefix + (last ? '   ' : '│  '), depth + 1);
    });
    if (files.length > shownFiles.length && lines.length < maxLines) {
      lines.push(`${prefix}└─ … ${files.length - shownFiles.length} more file(s)`);
    }
  };
  walk(root, '', 0);
  return lines.join('\n');
}

export function readText(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

export function exists(file: string): boolean {
  return fs.existsSync(file);
}
