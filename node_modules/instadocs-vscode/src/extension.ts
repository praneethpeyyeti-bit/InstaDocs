import * as vscode from 'vscode';
import * as fs from 'fs';
import {
  runPipeline,
  exportDeliverables,
  PipelineResult,
  SddModel,
  AddModel,
  sddToMarkdown,
  addToMarkdown,
  testCasesToMarkdown,
  GatewayConfig,
  RepoSource,
  resolveGatewayConfig,
  InstadocsGatewayConfig,
} from '@instadocs/core';
import { renderWebview } from './webview';
import { openGeneratePanel } from './panel';
import { openWelcome, maybeShowWelcomeOnStartup } from './welcome';

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
    }),
    // Guided setup: write the Gateway settings without touching a file or the UI.
    vscode.commands.registerCommand('instadocs.setupGateway', () => setupGateway(context)),
    // Main UI: a single panel for source + config + generate + saved path.
    vscode.commands.registerCommand('instadocs.openPanel', (uri?: vscode.Uri) =>
      openGeneratePanel(context, uri?.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath)
    ),
    // Branded welcome / get-started page.
    vscode.commands.registerCommand('instadocs.welcome', () => openWelcome(context))
  );

  // Show the welcome page on startup (until the user turns it off).
  maybeShowWelcomeOnStartup(context);
}

/** Guided wizard that writes the InstaDocs Gateway settings (org / tenant / host / model). */
async function setupGateway(context: vscode.ExtensionContext): Promise<void> {
  const cancelled = 'InstaDocs: setup cancelled.';

  // 1. Where to save.
  const hasWs = !!vscode.workspace.workspaceFolders?.length;
  const scopePick = await vscode.window.showQuickPick(
    [
      { label: 'All my projects (User settings)', target: vscode.ConfigurationTarget.Global },
      ...(hasWs ? [{ label: 'This workspace only', target: vscode.ConfigurationTarget.Workspace }] : []),
    ],
    { title: 'InstaDocs Gateway setup — where to save', ignoreFocusOut: true }
  );
  if (!scopePick) return void vscode.window.showInformationMessage(cancelled);
  const target = scopePick.target;

  // 2. Base host.
  const hostPick = await vscode.window.showQuickPick(
    ['https://cloud.uipath.com', 'https://staging.uipath.com', 'https://alpha.uipath.com', 'Other…'],
    { title: 'UiPath Cloud base host', ignoreFocusOut: true }
  );
  if (!hostPick) return void vscode.window.showInformationMessage(cancelled);
  let baseHost = hostPick;
  if (hostPick === 'Other…') {
    const v = await vscode.window.showInputBox({ title: 'Base host URL', placeHolder: 'https://my-uipath-host', ignoreFocusOut: true, validateInput: (s) => (/^https?:\/\//i.test(s) ? undefined : 'Must start with http(s)://') });
    if (!v) return void vscode.window.showInformationMessage(cancelled);
    baseHost = v.trim();
  }

  // 3. Organization (logical name).
  const organization = await vscode.window.showInputBox({
    title: 'Organization logical name (not the GUID)',
    placeHolder: 'e.g. acme',
    ignoreFocusOut: true,
    validateInput: (s) => (s.trim() ? undefined : 'Required'),
  });
  if (!organization) return void vscode.window.showInformationMessage(cancelled);

  // 4. Tenant.
  const tenant = await vscode.window.showInputBox({
    title: 'Tenant name (case-sensitive)',
    placeHolder: 'e.g. DefaultTenant',
    ignoreFocusOut: true,
    validateInput: (s) => (s.trim() ? undefined : 'Required'),
  });
  if (!tenant) return void vscode.window.showInformationMessage(cancelled);

  // 5. Model.
  const KNOWN_MODELS = [
    'anthropic.claude-sonnet-4-5-20250929-v1:0',
    'anthropic.claude-haiku-4-5-20251001-v1:0',
    'anthropic.claude-opus-4-8',
    'anthropic.claude-opus-4-7',
    'Other…',
  ];
  const modelPick = await vscode.window.showQuickPick(KNOWN_MODELS, { title: 'Model (must be routable in your tenant)', ignoreFocusOut: true });
  if (!modelPick) return void vscode.window.showInformationMessage(cancelled);
  let model = modelPick;
  if (modelPick === 'Other…') {
    const v = await vscode.window.showInputBox({ title: 'Model id', placeHolder: 'anthropic.claude-…', ignoreFocusOut: true, validateInput: (s) => (s.trim() ? undefined : 'Required') });
    if (!v) return void vscode.window.showInformationMessage(cancelled);
    model = v.trim();
  }

  // Write settings.
  const cfg = vscode.workspace.getConfiguration('instadocs');
  await cfg.update('gateway.baseHost', baseHost, target);
  await cfg.update('gateway.organization', organization.trim(), target);
  await cfg.update('gateway.tenant', tenant.trim(), target);
  await cfg.update('gateway.model', model, target);

  // 6. Auth: prefer uip login; optionally store a token now.
  const authPick = await vscode.window.showQuickPick(
    ['I will sign in with `uip login` (recommended, auto-refreshes)', 'Enter a token now (headless / CI — expires)'],
    { title: 'How will you authenticate?', ignoreFocusOut: true }
  );
  if (authPick && authPick.startsWith('Enter a token')) {
    const token = await vscode.window.showInputBox({ title: 'UiPath Gateway token (stored in SecretStorage)', password: true, ignoreFocusOut: true });
    if (token) await context.secrets.store(SECRET_TOKEN_KEY, token.trim());
  }

  // Confirm + preview the resolved URL.
  const resolved = resolveGatewayConfig({ baseHost, organization: organization.trim(), tenant: tenant.trim(), model }, undefined);
  const urlNote = resolved.config ? resolved.config.baseUrl : '(URL will resolve once you sign in)';
  const next = await vscode.window.showInformationMessage(
    `InstaDocs Gateway configured (${scopePick.label}).\nEndpoint: ${urlNote}`,
    'Done',
    'Generate now'
  );
  if (next === 'Generate now') await vscode.commands.executeCommand('instadocs.generateWithGateway');
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
  const gateway = await resolveGateway(context, localFolder(source));
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
      'InstaDocs: run the UiPath "project discovery" agent to generate AGENTS.md and enrich this document ' +
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

  const docMarkdown =
    result.docType === 'add'
      ? addToMarkdown(result.model as AddModel)
      : sddToMarkdown(result.model as SddModel);

  panel.webview.html = renderWebview(panel.webview, {
    projectName: result.model.projectName,
    platform: result.detection.platform,
    usedLlm: result.usedLlm,
    sddMarkdown: docMarkdown,
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
      outDir,
      result.docType
    );
    const docLabel = result.docType === 'add' ? 'ADD' : 'SDD';
    const pick = await vscode.window.showInformationMessage(
      `InstaDocs: exported ${docLabel} (Word) + Test Cases (Excel) to ${outDir}.`,
      `Open ${docLabel}`,
      'Open Test Cases'
    );
    if (pick === `Open ${docLabel}`) openExternal(paths.docx);
    if (pick === 'Open Test Cases') openExternal(paths.testCasesXlsx);
  } catch (err) {
    vscode.window.showErrorMessage(`InstaDocs export failed: ${(err as Error).message}`);
  }
}

function openExternal(fsPath: string): void {
  void vscode.env.openExternal(vscode.Uri.file(fsPath));
}

/**
 * Build a GatewayConfig by merging InstaDocs settings + a project-level
 * `instadocs.config.json` + env + the signed-in `uip` session (via the shared
 * core resolver). A customer configures org/tenant/host/model/URL/token via any
 * of those — no code change. Returns undefined when URL + token can't be found.
 */
async function resolveGateway(
  context: vscode.ExtensionContext,
  startDir?: string
): Promise<GatewayConfig | undefined> {
  const cfg = vscode.workspace.getConfiguration('instadocs');
  const get = (k: string) => cfg.get<string>(k)?.trim() || undefined;
  const storedToken = await context.secrets.get(SECRET_TOKEN_KEY);

  const overrides: InstadocsGatewayConfig = {
    baseHost: get('gateway.baseHost'),
    organization: get('gateway.organization'),
    tenant: get('gateway.tenant'),
    servicePrefix: get('gateway.servicePrefix'),
    gatewayUrl: get('gateway.baseUrl'),
    model: get('gateway.model'),
    token: storedToken || undefined,
  };

  let { config } = resolveGatewayConfig(overrides, startDir);
  if (config) return config;

  // A manual URL/host is configured but no token — prompt once, store, retry.
  if ((overrides.gatewayUrl || overrides.baseHost) && !storedToken) {
    const token = await vscode.window.showInputBox({
      prompt: 'UiPath LLM Gateway token (stored securely in VS Code SecretStorage)',
      password: true,
      ignoreFocusOut: true,
    });
    if (token) {
      await context.secrets.store(SECRET_TOKEN_KEY, token);
      config = resolveGatewayConfig({ ...overrides, token }, startDir).config;
    }
  }
  return config;
}
