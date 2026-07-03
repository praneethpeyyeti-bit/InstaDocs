#!/usr/bin/env node
/**
 * Bundle the InstaDocs VS Code extension into a self-contained, distributable
 * form (dist/), then vsce can package it into a .vsix.
 *
 *   - esbuild bundles src/extension.ts + @instadocs/core + all pure-JS deps into
 *     dist/extension.js.
 *   - `vscode` and the native `@resvg/resvg-js` are kept EXTERNAL.
 *   - core template assets are copied to dist/assets (resolved at runtime by
 *     export/assets.ts).
 *   - the native @resvg scope (loader + platform binary) is copied to
 *     dist/node_modules/@resvg so the external require resolves inside the vsix.
 *
 * Usage: node build.js [--production] [--watch]
 */
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const ROOT = __dirname;
const REPO = path.join(ROOT, '..', '..');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isSymbolicLink()) fs.copyFileSync(fs.realpathSync(s), d);
    else fs.copyFileSync(s, d);
  }
}

function copyAssetsAndNative() {
  // 1. core template assets -> dist/assets
  const assetsSrc = path.join(REPO, 'packages', 'core', 'assets');
  copyDir(assetsSrc, path.join(ROOT, 'dist', 'assets'));

  // 2. native @resvg scope (loader + platform binary) -> dist/node_modules/@resvg
  const resvgSrc = firstExisting([
    path.join(REPO, 'node_modules', '@resvg'),
    path.join(ROOT, 'node_modules', '@resvg'),
  ]);
  if (!resvgSrc) throw new Error('Could not locate node_modules/@resvg to bundle.');
  copyDir(resvgSrc, path.join(ROOT, 'dist', 'node_modules', '@resvg'));
  console.log('Copied assets + native @resvg into dist/');
}

function firstExisting(paths) {
  return paths.find((p) => fs.existsSync(p));
}

const options = {
  entryPoints: [path.join(ROOT, 'src', 'extension.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: path.join(ROOT, 'dist', 'extension.js'),
  external: ['vscode', '@resvg/resvg-js'],
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

async function main() {
  // Start from a clean dist so no stale files (e.g. old tsc output) ship.
  fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });

  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    copyAssetsAndNative();
    console.log('esbuild watching…');
  } else {
    await esbuild.build(options);
    copyAssetsAndNative();
    console.log('Bundle complete.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
