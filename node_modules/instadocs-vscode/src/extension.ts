import * as vscode from 'vscode';
import * as fs from 'fs';
import {
  runPipeline,
  exportDeliverables,
  PipelineResult,
  sddToMarkdown,
  testCasesToMarkdown,
  GatewayConfig,
  RepoSource,
  resolveUiPathSession,
  gatewayUrlFromSession,
} from '@instadocs/core';
import { renderWebview } from './webview';

const SECRET_TOKEN_KEY = 'instadocs.gateway.token';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    // Invoked from the Command Palette (no arg) or the Explorer right-click
    // context menu (passes the clicked folder's Uri).
    vscode.commands.registerCommand('instadocs.generateFromWorkspace', (uri?: vscode.Uri) =>
      generate(context, folderSource(uri))
    ),
    // AI mode: require the UiPath LLM Gateway (Claude) — no deterministic fallback.
    vscode.commands.registerCommand('instadocs.generateWithGateway', (uri?: vscode.Uri) =>
      generate(context, folderSource(uri), { requireGateway: true })
    ),
    vscode.commands.registerCommand('instadocs.generateFromGitUrl', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'Git URL of the automation project (GitHub / GitLab / Bitbucket)',
        placeHolder: 'https://github.com/org/repo.git',
        ignoreFocusOut: true,
      });
      if (!url) return;
      const branch = await vscode.window.showInputBox({
        prompt: 'Branch (optional)',
        ignoreFocusOut: true,
      });
      await generate(context, { location: url, branch: branch || undefined });
    })
  );
}

export function deactivate(): void {
  /* nothing to clean up */
}

function folderSource(uri?: vscode.Uri): RepoSource | undefined {
  // Prefer the right-clicked folder; else the first open workspace folder.
  const fsPath = uri?.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!fsPath) {
    vscode.window.showErrorMessage(
      'InstaDocs: open a project folder first (File → Open Folder), or right-click a folder in the Explorer.'
    );
    return undefined;
  }
  return { location: fsPath };
}

async function generate(
  context: vscode.ExtensionContext,
  source: RepoSource | undefined,
  _opts: { requireGateway?: boolean } = {}
): Promise<void> {
  if (!source) return;

  // LLM-only: the UiPath LLM Gateway is always required (no deterministic mode).
  const gateway = await resolveGateway(context);
  if (!gateway) {
    vscode.window.showErrorMessage(
      'InstaDocs needs the UiPath LLM Gateway. Sign in with `uip login` (or set the Gateway URL/token in settings), then try again.'
    );
    return;
  }

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'InstaDocs', cancellable: false },
    async (progress): Promise<PipelineResult | undefined> => {
      try {
        return await runPipeline({
          source,
          generatedOn: new Date().toISOString().slice(0, 10),
          enrich: { gateway },
          onProgress: (m) => progress.report({ message: m }),
        });
      } catch (err) {
        vscode.window.showErrorMessage(`InstaDocs failed: ${(err as Error).message}`);
        return undefined;
      }
    }
  );

  if (!result) return;

  const engine = result.usedLlm ? 'UiPath LLM Gateway' : 'deterministic analysis';
  vscode.window.setStatusBarMessage(
    `InstaDocs: ${result.detection.platform} · ${engine}`,
    6000
  );

  // Nudge toward richer output when no discovery context was found (UiPath only).
  if (result.detection.platform === 'uipath' && !result.graph.projectContext) {
    vscode.window.showInformationMessage(
      'InstaDocs: run the UiPath "project discovery" agent to generate AGENTS.md and enrich this PDD ' +
        '(dependencies, conventions, key workflows).'
    );
  }

  // Auto-export both deliverables straight into the project folder when the
  // source is a local directory (a git URL is cloned to a temp dir that is
  // already cleaned up, so fall back to the preview's "Export" button there).
  const localDir = localFolder(source);
  if (localDir) {
    await doExport(result, localDir);
  }

  showPreview(context, result);
}

/** The source's local folder path, if it is an existing directory on disk. */
function localFolder(source: RepoSource): string | undefined {
  try {
    const p = source.location;
    return fs.statSync(p).isDirectory() ? p : undefined;
  } catch {
    return undefined; // git URL or non-existent path
  }
}

function showPreview(context: vscode.ExtensionContext, result: PipelineResult): void {
  const panel = vscode.window.createWebviewPanel(
    'instadocs.preview',
    `InstaDocs — ${result.model.projectName}`,
    vscode.ViewColumn.Active,
    { enableScripts: true }
  );

  panel.webview.html = renderWebview(panel.webview, {
    projectName: result.model.projectName,
    platform: result.detection.platform,
    usedLlm: result.usedLlm,
    sddMarkdown: sddToMarkdown(result.model),
    testCasesMarkdown: testCasesToMarkdown(result.model),
  });

  panel.webview.onDidReceiveMessage(async (msg: { command: string }) => {
    if (msg.command === 'export') {
      await exportBoth(result);
    }
  });

  void context;
}

/** Export both deliverables: Word PDD + Excel test cases, prompting for a folder. */
async function exportBoth(result: PipelineResult): Promise<void> {
  const target = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    openLabel: 'Export here',
  });
  if (!target || !target[0]) return;
  await doExport(result, target[0].fsPath);
}

/** Write both deliverables into outDir and offer to open them. */
async function doExport(result: PipelineResult, outDir: string): Promise<void> {
  try {
    const paths = await exportDeliverables(
      result.model,
      result.graph,
      new Date().toISOString().slice(0, 10),
      outDir
    );
    const pick = await vscode.window.showInformationMessage(
      `InstaDocs: exported SDD (Word) + Test Cases (Excel) to ${outDir}.`,
      'Open SDD',
      'Open Test Cases'
    );
    if (pick === 'Open SDD') openExternal(paths.sddDocx);
    if (pick === 'Open Test Cases') openExternal(paths.testCasesXlsx);
  } catch (err) {
    vscode.window.showErrorMessage(`InstaDocs export failed: ${(err as Error).message}`);
  }
}

function openExternal(fsPath: string): void {
  void vscode.env.openExternal(vscode.Uri.file(fsPath));
}

/**
 * Build a GatewayConfig from (1) explicit settings/SecretStorage, else (2) the
 * signed-in UiPath `uip` session (token + org/tenant → URL). Returns undefined
 * when neither yields a URL + token (=> deterministic unless strict).
 */
async function resolveGateway(
  context: vscode.ExtensionContext
): Promise<GatewayConfig | undefined> {
  const cfg = vscode.workspace.getConfiguration('instadocs');
  const model = cfg.get<string>('gateway.model')?.trim() || 'anthropic.claude-opus-4-8';
  const session = resolveUiPathSession();

  const baseUrl = cfg.get<string>('gateway.baseUrl')?.trim() || gatewayUrlFromSession(session);
  if (!baseUrl) return undefined;

  // Prefer an explicitly stored token; else reuse the uip session token.
  let token = (await context.secrets.get(SECRET_TOKEN_KEY)) || session.token;
  if (!token && cfg.get<string>('gateway.baseUrl')?.trim()) {
    // A manual URL was set but no token — prompt once and store it.
    token = await vscode.window.showInputBox({
      prompt: 'UiPath LLM Gateway token (stored securely in VS Code SecretStorage)',
      password: true,
      ignoreFocusOut: true,
    });
    if (token) await context.secrets.store(SECRET_TOKEN_KEY, token);
  }
  if (!token) return undefined;

  return { baseUrl, model, token };
}
