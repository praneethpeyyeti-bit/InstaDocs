import * as vscode from 'vscode';
import { resolveGatewayConfig, resolveUiPathSession } from '@instadocs/core';

const SHOW_ON_STARTUP = 'instadocs.showWelcomeOnStartup';

/** Show the welcome page on activation unless the user turned it off. */
export function maybeShowWelcomeOnStartup(context: vscode.ExtensionContext): void {
  if (context.globalState.get<boolean>(SHOW_ON_STARTUP, true)) {
    openWelcome(context);
  }
}

/** Open the branded InstaDocs welcome / get-started page. */
export function openWelcome(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel('instadocs.welcome', 'InstaDocs', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
  });
  panel.webview.html = renderWelcome(panel.webview, gatherStatus(context));

  panel.webview.onDidReceiveMessage(async (msg: { type: string; value?: boolean }) => {
    switch (msg.type) {
      case 'openPanel':
        await vscode.commands.executeCommand('instadocs.openPanel');
        break;
      case 'setupGateway':
        // Gateway config lives in Settings (and the panel's "Override config").
        await vscode.commands.executeCommand('workbench.action.openSettings', 'instadocs.gateway');
        break;
      case 'setStartup':
        await context.globalState.update(SHOW_ON_STARTUP, !!msg.value);
        break;
    }
  });
}

interface Status {
  signedIn: boolean;
  gatewayReady: boolean;
  projectOpen: boolean;
  endpoint: string;
  model: string;
  org: string;
  tenant: string;
  showOnStartup: boolean;
}

function gatherStatus(context: vscode.ExtensionContext): Status {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const session = resolveUiPathSession();
  const resolved = resolveGatewayConfig({}, folder);
  return {
    signedIn: !!session.token,
    gatewayReady: !!resolved.config,
    projectOpen: !!folder,
    endpoint: resolved.config?.baseUrl || '',
    model: resolved.config?.model || '',
    org: session.organization || '',
    tenant: session.tenant || '',
    showOnStartup: context.globalState.get<boolean>(SHOW_ON_STARTUP, true),
  };
}

function nonce(): string {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 24; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function renderWelcome(webview: vscode.Webview, st: Status): string {
  const n = nonce();
  const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}';`;
  const step = (ok: boolean, label: string) =>
    `<div class="step ${ok ? 'ok' : ''}"><span class="dot">${ok ? '✓' : '○'}</span>${esc(label)}</div>`;
  const signedLine = st.signedIn
    ? `SIGNED IN${st.org ? ' · ' + esc(st.org) : ''}${st.tenant ? ' / ' + esc(st.tenant) : ''}`
    : 'NOT SIGNED IN';

  return /* html */ `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<style>
  :root { --orange: #FA4616; --blue: #4C8DFF; --ink: #E6EDF3; --muted: #8B98A9; --panel: #11161F; --line: rgba(255,255,255,0.06); }
  * { box-sizing: border-box; }
  body { margin: 0; color: var(--ink); font-family: var(--vscode-font-family), 'Segoe UI', sans-serif;
    background: #0B0E14;
    background-image: linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px);
    background-size: 46px 46px; min-height: 100vh; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 22px 28px 80px; position: relative; }
  .top { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; letter-spacing: .2px; }
  .logo { width: 26px; height: 26px; border-radius: 7px; background: var(--orange); color: #fff; font-weight: 800;
    display: grid; place-items: center; font-size: 13px; }
  .steps { display: flex; gap: 14px; flex-wrap: wrap; }
  .step { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
  .step.ok { color: var(--ink); }
  .step .dot { width: 16px; height: 16px; border-radius: 50%; display: grid; place-items: center; font-size: 10px;
    background: rgba(255,255,255,.06); color: var(--muted); }
  .step.ok .dot { background: rgba(46,125,50,.25); color: #7EE787; }
  .hero { margin-top: 96px; max-width: 640px; }
  .eyebrow { color: var(--orange); font-size: 12px; font-weight: 700; letter-spacing: 1.4px; display: flex; align-items: center; gap: 8px; }
  .eyebrow .pip { width: 8px; height: 8px; border-radius: 50%; background: var(--orange); box-shadow: 0 0 0 4px rgba(250,70,22,.18); }
  h1 { font-size: 44px; line-height: 1.08; margin: 16px 0 6px; font-weight: 800; }
  h1 .b { color: var(--blue); }
  .lede { color: var(--muted); font-size: 15px; line-height: 1.6; max-width: 560px; }
  .cta { margin-top: 30px; display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .btn { border: none; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 600; padding: 12px 22px; border-radius: 10px;
    background: var(--blue); color: #fff; display: inline-flex; align-items: center; gap: 8px; }
  .btn:hover { filter: brightness(1.08); }
  .link { color: var(--blue); cursor: pointer; font-weight: 600; font-size: 14px; background: none; border: none; }
  .endpoint { margin-top: 22px; font-size: 12px; color: var(--muted); }
  .endpoint code { color: var(--ink); background: rgba(255,255,255,.05); padding: 1px 6px; border-radius: 4px; word-break: break-all; }
  .decor { position: absolute; border: 1px dashed rgba(255,255,255,.10); border-radius: 12px; }
  .d1 { width: 150px; height: 96px; right: 40px; top: 150px; }
  .d2 { width: 150px; height: 96px; right: 120px; bottom: 150px; }
  .startup { position: fixed; left: 24px; bottom: 18px; display: flex; align-items: center; gap: 9px; font-size: 13px; color: var(--muted); }
  .sw { width: 34px; height: 18px; border-radius: 10px; background: rgba(255,255,255,.14); position: relative; cursor: pointer; transition: background .15s; }
  .sw.on { background: var(--blue); }
  .sw::after { content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #fff; top: 2px; left: 2px; transition: left .15s; }
  .sw.on::after { left: 18px; }
</style></head><body>
  <div class="wrap">
    <div class="top">
      <div class="brand"><div class="logo">Ui</div> InstaDocs <span style="color:var(--muted);font-weight:500;">· UiPath docs generator</span></div>
      <div class="steps">
        ${step(st.signedIn, 'Signed in')}
        ${step(st.gatewayReady, 'LLM Gateway')}
        ${step(st.projectOpen, 'Project open')}
      </div>
    </div>

    <div class="decor d1"></div>
    <div class="decor d2"></div>

    <div class="hero">
      <div class="eyebrow"><span class="pip"></span>${signedLine} · READY TO GENERATE</div>
      <h1>Turn a UiPath project into<br><span class="b">a Solution Design Document.</span></h1>
      <div class="lede">Point InstaDocs at a project folder or a Git repo. It reads the workflows, calls the UiPath LLM Gateway, and produces a branded <strong>SDD/ADD (Word)</strong> + <strong>Test Cases (Excel)</strong> — with architecture and REFramework-state diagrams.<br><span style="opacity:.75">Tip: run the UiPath <strong>project-discovery</strong> agent first (creates <code>AGENTS.md</code>) for the sharpest, business-worded flow steps.</span></div>
      <div class="cta">
        <button class="btn" id="generate">＋ Generate documents</button>
        <button class="link" id="setup">${st.gatewayReady ? 'Gateway settings' : 'Set up Gateway'}</button>
      </div>
      <div class="endpoint">
        ${st.gatewayReady
          ? `Gateway: <code>${esc(st.endpoint)}</code> · model <code>${esc(st.model)}</code>`
          : 'Sign in with <code>uip login</code> or click <strong>Set up Gateway</strong> to configure org / tenant / model.'}
      </div>
    </div>
  </div>

  <div class="startup">
    <div class="sw ${st.showOnStartup ? 'on' : ''}" id="sw"></div> Show welcome page on startup
  </div>

<script nonce="${n}">
  const vscode = acquireVsCodeApi();
  document.getElementById('generate').addEventListener('click', () => vscode.postMessage({ type: 'openPanel' }));
  document.getElementById('setup').addEventListener('click', () => vscode.postMessage({ type: 'setupGateway' }));
  const sw = document.getElementById('sw');
  sw.addEventListener('click', () => { const on = !sw.classList.contains('on'); sw.classList.toggle('on', on); vscode.postMessage({ type: 'setStartup', value: on }); });
</script>
</body></html>`;
}
