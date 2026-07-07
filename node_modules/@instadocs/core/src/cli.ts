#!/usr/bin/env node
/**
 * InstaDocs CLI — thin shell over runPipeline for terminal / CI use.
 *
 * Usage:
 *   instadocs <repo-url-or-path> [--out ./docs] [--branch main]
 *             [--subpath src] [--platform uipath]
 *
 * Output is fixed: a Word SDD (.docx) + an Excel test-case doc (.xlsx),
 * filled from the branded templates in assets/.
 *
 * LLM Gateway (optional) via env:
 *   INSTADOCS_GATEWAY_URL, INSTADOCS_GATEWAY_TOKEN, INSTADOCS_GATEWAY_MODEL
 * When unset, the deterministic analyzer is used.
 */
import { runPipeline, exportDeliverables, compactGraph } from './index';
import { openRepo } from './repo';
import { detectPlatform } from './detect';
import { parseProject } from './parse';
import { loadProjectContext } from './context/projectContext';
import { resolveGatewayConfig } from './analyze/gatewayConfig';
import { Platform } from './model/ir';
import { DocType } from './detect/docType';

interface Args {
  location?: string;
  out: string;
  branch?: string;
  subpath?: string;
  platform?: Platform;
  /** Force the deliverable type (sdd = RPA, add = agentic); else auto-detect. */
  docType?: DocType;
  /** Require the LLM Gateway; fail instead of falling back to deterministic. */
  llm: boolean;
  /** Path to a pre-authored model JSON to use instead of analysis. */
  model?: string;
  /** Print parsed evidence (discovery context + compacted workflow) as JSON and exit. */
  dumpCompact?: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { out: './instadocs-output', llm: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') args.out = argv[++i];
    else if (a === '--branch') args.branch = argv[++i];
    else if (a === '--subpath') args.subpath = argv[++i];
    else if (a === '--platform') args.platform = argv[++i] as Platform;
    else if (a === '--doc-type' || a === '--type') args.docType = argv[++i] as DocType;
    else if (a === '--llm' || a === '--strict') args.llm = true;
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--dump-compact') args.dumpCompact = true;
    else if (!a.startsWith('--')) args.location = a;
  }
  return args;
}

/**
 * Parse the project and print the LLM "evidence" (discovery context + compacted
 * workflow) as JSON to stdout, then exit. Used by the Python LLM-Gateway driver
 * to feed a Claude model without re-implementing the parser.
 */
async function dumpCompact(args: Args): Promise<void> {
  const repo = await openRepo({ location: args.location!, branch: args.branch, subPath: args.subpath });
  try {
    const platform = args.platform ?? detectPlatform(repo.workingDir).platform;
    const graph = await parseProject(platform, repo.workingDir);
    const ctx = loadProjectContext(repo.workingDir);
    if (ctx) graph.projectContext = ctx;
    process.stdout.write(
      JSON.stringify({
        projectName: graph.projectName,
        platform,
        entryPoints: graph.entryPoints,
        nodeCount: graph.nodes.length,
        argumentCount: graph.arguments.length,
        compact: compactGraph(graph),
      })
    );
  } finally {
    repo.cleanup();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.location) {
    console.error('Usage: instadocs <repo-url-or-path> [--out DIR] [--branch B] [--platform P]');
    process.exit(1);
  }

  if (args.dumpCompact) {
    await dumpCompact(args);
    return;
  }

  let preAuthored: import('./index').PipelineOptions['model'];
  if (args.model) {
    const fs = await import('fs');
    preAuthored = JSON.parse(fs.readFileSync(args.model, 'utf8'));
    console.error(`• Using pre-authored analysis: ${args.model}`);
  }

  // Resolve Gateway config from env / instadocs.config.json (searched from the
  // project dir) / the uip session. Customers configure via any of those.
  const startDir = args.location && !/^(https?|git|ssh):/i.test(args.location) ? args.location : undefined;
  const { config: gateway, note } = resolveGatewayConfig({}, startDir);
  if (!preAuthored) {
    // LLM-only: the Gateway is required (no deterministic mode).
    console.error(`• LLM Gateway (required): ${gateway ? note : 'NOT AVAILABLE — ' + note}`);
  }

  const result = await runPipeline({
    source: { location: args.location, branch: args.branch, subPath: args.subpath },
    platformOverride: args.platform,
    docTypeOverride: args.docType,
    generatedOn: new Date().toISOString().slice(0, 10),
    model: preAuthored,
    enrich: { gateway },
    onProgress: (m) => console.error(`• ${m}`),
  });

  const paths = await exportDeliverables(
    result.model,
    result.graph,
    new Date().toISOString().slice(0, 10),
    args.out,
    result.docType
  );
  const docLabel = result.docType === 'add' ? 'ADD  (Word)' : 'SDD  (Word)';
  console.error(`✓ ${docLabel}:  ${paths.docx}`);
  console.error(`✓ Tests (Excel): ${paths.testCasesXlsx}`);
  console.error(
    `Done. Platform=${result.detection.platform}, DocType=${result.docType}, LLM=${result.usedLlm ? 'yes' : 'no'}.`
  );
}

main().catch((err) => {
  console.error('InstaDocs failed:', err.message);
  process.exit(1);
});
