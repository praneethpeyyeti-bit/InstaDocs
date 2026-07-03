/**
 * Resolve a bundled template asset (pdd-template.docx / testcases-template.xlsx)
 * across the ways InstaDocs runs:
 *   - core built normally:  <core>/dist/export -> ../../assets
 *   - bundled into the VS Code extension:  <ext>/dist/assets (next to the bundle)
 *   - explicit override:  INSTADOCS_ASSETS_DIR
 * Returns the first candidate that exists (falls back to the last one).
 */
export declare function resolveAsset(name: string): string;
