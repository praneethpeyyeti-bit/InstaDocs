import * as vscode from 'vscode';
import {
  runPipeline,
  exportDeliverables,
  resolveGatewayConfig,
  RepoSource,
  InstadocsGatewayConfig,
} from '@instadocs/core';
import { nonce, esc, headHtml } from './ui/theme';

const SECRET_TOKEN_KEY = 'instadocs.gateway.token';

interface GeneratePayload {
  sourceMode: 'folder' | 'git';
  folder?: string;
  gitUrl?: string;
  branch?: string;
  outputDir?: string;
  gateway: {
    baseHost?: string;
    organization?: string;
    tenant?: string;
    model?: string;
    token?: string;
  };
}

const today = () => new Date().toISOString().slice(0, 10);

/** Open the InstaDocs generator panel — a single form: source + config + generate. */
export function openGeneratePanel(context: vscode.ExtensionContext, initialFolder?: string): void {
  const panel = vscode.window.createWebviewPanel('instadocs.generatePanel', 'InstaDocs — Generate', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  panel.webview.html = renderPanel(panel.webview, gatherDefaults(initialFolder));

  panel.webview.onDidReceiveMessage(async (msg: { type: string; path?: string; payload?: GeneratePayload }) => {
    switch (msg.type) {
      case 'browseSource': {
        const p = await pickFolder('Select the automation project folder');
        if (p) panel.webview.postMessage({ type: 'sourcePath', path: p });
        break;
      }
      case 'browseOutput': {
        const p = await pickFolder('Select the output folder');
        if (p) panel.webview.postMessage({ type: 'outputPath', path: p });
        break;
      }
      case 'generate':
        if (msg.payload) await runGenerate(context, panel, msg.payload);
        break;
      case 'openFile':
        if (msg.path) void vscode.env.openExternal(vscode.Uri.file(msg.path));
        break;
      case 'revealFolder':
        if (msg.path) void vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(msg.path));
        break;
    }
  });
}

async function pickFolder(openLabel: string): Promise<string | undefined> {
  const sel = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, openLabel });
  return sel?.[0]?.fsPath;
}

interface PanelDefaults {
  folder: string;
  baseHost: string;
  organization: string;
  tenant: string;
  model: string;
  hasSessionToken: boolean;
  resolvedEndpoint: string;
}

function gatherDefaults(initialFolder?: string): PanelDefaults {
  const cfg = vscode.workspace.getConfiguration('instadocs');
  const get = (k: string) => cfg.get<string>(k)?.trim() || '';
  const folder = initialFolder || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  const resolved = resolveGatewayConfig({}, folder || undefined);
  return {
    folder,
    baseHost: get('gateway.baseHost'),
    organization: get('gateway.organization'),
    tenant: get('gateway.tenant'),
    model: get('gateway.model') || 'anthropic.claude-sonnet-4-5-20250929-v1:0',
    hasSessionToken: !!resolved.config?.token,
    resolvedEndpoint: resolved.config?.baseUrl || '(sign in with `uip login` or fill the fields below)',
  };
}

async function runGenerate(context: vscode.ExtensionContext, panel: vscode.WebviewPanel, p: GeneratePayload): Promise<void> {
  const post = (o: Record<string, unknown>) => void panel.webview.postMessage(o);
  const progress = (message: string) => post({ type: 'progress', message });
  try {
    // Source.
    let source: RepoSource;
    if (p.sourceMode === 'git') {
      const url = (p.gitUrl || '').trim();
      if (!url) return post({ type: 'error', message: 'Enter a Git repository URL.' });
      source = { location: url, branch: (p.branch || '').trim() || undefined };
    } else {
      const folder = (p.folder || '').trim();
      if (!folder) return post({ type: 'error', message: 'Select a local project folder.' });
      source = { location: folder };
    }

    // Token: form field wins and is stored; else the stored/session token is used.
    const formToken = (p.gateway.token || '').trim();
    if (formToken) await context.secrets.store(SECRET_TOKEN_KEY, formToken);
    const token = formToken || (await context.secrets.get(SECRET_TOKEN_KEY)) || undefined;

    const overrides: InstadocsGatewayConfig = {
      baseHost: (p.gateway.baseHost || '').trim() || undefined,
      organization: (p.gateway.organization || '').trim() || undefined,
      tenant: (p.gateway.tenant || '').trim() || undefined,
      model: (p.gateway.model || '').trim() || undefined,
      token,
    };
    const startDir = p.sourceMode === 'folder' ? p.folder : undefined;
    const { config: gateway, note } = resolveGatewayConfig(overrides, startDir);
    if (!gateway) {
      return post({ type: 'error', message: `LLM Gateway not configured — ${note}` });
    }
    progress(`Using Gateway: ${note}`);

    const result = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: 'InstaDocs', cancellable: false },
      async (prog) =>
        runPipeline({
          source,
          generatedOn: today(),
          enrich: { gateway },
          onProgress: (m) => {
            progress(m);
            prog.report({ message: m });
          },
        })
    );

    // Output folder: the field, else the source folder (local), else ask.
    let outDir = (p.outputDir || '').trim();
    if (!outDir) outDir = p.sourceMode === 'folder' ? (p.folder || '').trim() : '';
    if (!outDir) outDir = (await pickFolder('Where should the documents be saved?')) || '';
    if (!outDir) return post({ type: 'error', message: 'No output folder selected.' });

    progress('Writing documents…');
    const paths = await exportDeliverables(result.model, result.graph, today(), outDir, result.docType);
    post({
      type: 'done',
      project: result.model.projectName,
      docType: paths.docType,
      docLabel: paths.docType === 'add' ? 'ADD' : 'SDD',
      docx: paths.docx,
      testCasesXlsx: paths.testCasesXlsx,
      outDir,
    });
  } catch (err) {
    post({ type: 'error', message: (err as Error).message });
  }
}

const MODELS: { value: string; label: string }[] = [
  { value: 'anthropic.claude-sonnet-4-5-20250929-v1:0', label: 'Sonnet 4.5 — balanced (recommended)' },
  { value: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Haiku 4.5 — fastest' },
  { value: 'anthropic.claude-opus-4-8', label: 'Opus 4.8 — best quality (slower)' },
  { value: 'anthropic.claude-opus-4-7', label: 'Opus 4.7 — high quality (slower)' },
];

function renderPanel(webview: vscode.Webview, d: PanelDefaults): string {
  const n = nonce();
  const modelOpts = MODELS.map((m) => `<option value="${esc(m.value)}" ${m.value === d.model ? 'selected' : ''}>${esc(m.label)}</option>`).join('');
  const tokenPill = d.hasSessionToken
    ? `<span class="pill ok"><span class="dot"></span>Token from uip session</span>`
    : `<span class="pill"><span class="dot"></span>No session token</span>`;
  return /* html */ `${headHtml(n, 'InstaDocs — Generate')}<body>
  <div class="wrap">
  <div class="brand"><div class="logo">Ui</div> InstaDocs <span class="tag">· document generator</span></div>
  <h1>Generate documentation</h1>
  <div class="lede">Point InstaDocs at a UiPath project — a local folder or a Git repo — and it produces a branded <strong>SDD/ADD (Word)</strong> + <strong>Test Cases (Excel)</strong> via the UiPath LLM Gateway.</div>

  <fieldset>
    <legend><span class="step-badge">1</span> Source</legend>
    <div class="seg" id="seg">
      <button id="mode-folder" class="active" data-mode="folder">Local folder</button>
      <button id="mode-git" data-mode="git">Git repository</button>
    </div>
    <div id="src-folder">
      <label for="folder">Project folder</label>
      <div class="row"><input type="text" id="folder" value="${esc(d.folder)}" placeholder="C:\\path\\to\\project" /><button id="browse">Browse…</button></div>
    </div>
    <div id="src-git" style="display:none">
      <label for="gitUrl">Git repository URL</label>
      <input type="text" id="gitUrl" placeholder="https://github.com/org/repo.git" />
      <label for="branch">Branch (optional)</label>
      <input type="text" id="branch" placeholder="main" />
    </div>
  </fieldset>

  <fieldset>
    <legend><span class="step-badge">2</span> UiPath LLM Gateway</legend>
    <div class="hint">Endpoint: <code>${esc(d.resolvedEndpoint)}</code></div>
    <div style="margin-top:10px">${tokenPill}</div>
    <details ${d.hasSessionToken ? '' : 'open'} style="margin-top:12px">
      <summary>Override config (leave blank to use your <code>uip login</code> session)</summary>
      <label for="baseHost">Base host</label>
      <input type="text" id="baseHost" value="${esc(d.baseHost)}" placeholder="https://cloud.uipath.com" />
      <label for="organization">Organization (logical name)</label>
      <input type="text" id="organization" value="${esc(d.organization)}" placeholder="acme" />
      <label for="tenant">Tenant</label>
      <input type="text" id="tenant" value="${esc(d.tenant)}" placeholder="DefaultTenant" />
      <label for="model">Model</label>
      <select id="model">${modelOpts}</select>
      <label for="token">Token (optional — stored securely; prefer <code>uip login</code>)</label>
      <input type="password" id="token" placeholder="${d.hasSessionToken ? 'using uip session token' : 'paste a Gateway token'}" />
    </details>
  </fieldset>

  <fieldset>
    <legend><span class="step-badge">3</span> Output</legend>
    <label for="outputDir">Save documents to</label>
    <div class="row"><input type="text" id="outputDir" value="${esc(d.folder)}" placeholder="Defaults to the project folder" /><button id="browseOut">Browse…</button></div>
  </fieldset>

  <button id="generate" class="primary btn-lg">＋ Generate documents</button>

  <div class="log" id="log" style="display:none"></div>
  <div class="error" id="error" style="display:none"></div>
  <div class="result" id="result" style="display:none">
    <div><strong id="result-title">Done</strong></div>
    <div class="path">📄 <a class="link" href="#" id="open-doc"></a></div>
    <div class="path">📊 <a class="link" href="#" id="open-test"></a></div>
    <div style="margin-top:8px"><button id="reveal">Show in folder</button></div>
  </div>
  </div>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  let mode = 'folder';
  const $ = (id) => document.getElementById(id);

  function setMode(m) {
    mode = m;
    $('mode-folder').classList.toggle('active', m === 'folder');
    $('mode-git').classList.toggle('active', m === 'git');
    $('src-folder').style.display = m === 'folder' ? 'block' : 'none';
    $('src-git').style.display = m === 'git' ? 'block' : 'none';
  }
  $('mode-folder').addEventListener('click', () => setMode('folder'));
  $('mode-git').addEventListener('click', () => setMode('git'));
  $('browse').addEventListener('click', () => vscode.postMessage({ type: 'browseSource' }));
  $('browseOut').addEventListener('click', () => vscode.postMessage({ type: 'browseOutput' }));

  function log(m) { const el = $('log'); el.style.display = 'block'; el.textContent += m + '\\n'; el.scrollTop = el.scrollHeight; }

  $('generate').addEventListener('click', () => {
    $('error').style.display = 'none';
    $('result').style.display = 'none';
    $('log').style.display = 'block'; $('log').textContent = '';
    $('generate').disabled = true;
    vscode.postMessage({ type: 'generate', payload: {
      sourceMode: mode,
      folder: $('folder').value,
      gitUrl: $('gitUrl').value,
      branch: $('branch').value,
      outputDir: $('outputDir').value,
      gateway: {
        baseHost: $('baseHost').value, organization: $('organization').value,
        tenant: $('tenant').value, model: $('model').value, token: $('token').value,
      },
    }});
  });

  let lastDoc = '', lastTest = '', lastOut = '';
  $('open-doc').addEventListener('click', (e) => { e.preventDefault(); vscode.postMessage({ type: 'openFile', path: lastDoc }); });
  $('open-test').addEventListener('click', (e) => { e.preventDefault(); vscode.postMessage({ type: 'openFile', path: lastTest }); });
  $('reveal').addEventListener('click', () => vscode.postMessage({ type: 'revealFolder', path: lastOut }));

  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (m.type === 'sourcePath') { $('folder').value = m.path; if (!$('outputDir').value) $('outputDir').value = m.path; }
    else if (m.type === 'outputPath') { $('outputDir').value = m.path; }
    else if (m.type === 'progress') { log('• ' + m.message); }
    else if (m.type === 'error') { $('generate').disabled = false; const e = $('error'); e.style.display = 'block'; e.textContent = '✗ ' + m.message; }
    else if (m.type === 'done') {
      $('generate').disabled = false;
      lastDoc = m.docx; lastTest = m.testCasesXlsx; lastOut = m.outDir;
      $('result-title').textContent = m.project + ' — ' + m.docLabel + ' + Test Cases generated';
      $('open-doc').textContent = m.docx;
      $('open-test').textContent = m.testCasesXlsx;
      $('result').style.display = 'block';
      log('✓ Saved to ' + m.outDir);
    }
  });
</script>
</body></html>`;
}
