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

export function readText(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

export function exists(file: string): boolean {
  return fs.existsSync(file);
}
