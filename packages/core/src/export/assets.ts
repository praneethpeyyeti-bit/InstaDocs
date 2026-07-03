import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolve a bundled template asset (pdd-template.docx / testcases-template.xlsx)
 * across the ways InstaDocs runs:
 *   - core built normally:  <core>/dist/export -> ../../assets
 *   - bundled into the VS Code extension:  <ext>/dist/assets (next to the bundle)
 *   - explicit override:  INSTADOCS_ASSETS_DIR
 * Returns the first candidate that exists (falls back to the last one).
 */
export function resolveAsset(name: string): string {
  const candidates = [
    process.env.INSTADOCS_ASSETS_DIR && path.join(process.env.INSTADOCS_ASSETS_DIR, name),
    path.join(__dirname, '..', '..', 'assets', name), // core dev layout
    path.join(__dirname, 'assets', name), // bundled next to the extension
    path.join(__dirname, '..', 'assets', name),
  ].filter((p): p is string => Boolean(p));

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return candidates[candidates.length - 1];
}
