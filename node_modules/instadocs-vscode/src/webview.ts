import * as vscode from 'vscode';

export interface PreviewData {
  projectName: string;
  platform: string;
  usedLlm: boolean;
  sddMarkdown: string;
  testCasesMarkdown: string;
}

/**
 * Render the preview webview. Markdown is rendered client-side by a tiny
 * converter (no network) and shown in two tabs with export buttons.
 */
export function renderWebview(webview: vscode.Webview, data: PreviewData): string {
  const nonce = makeNonce();
  const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  const engine = data.usedLlm ? 'UiPath LLM Gateway' : 'Deterministic (no LLM)';

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<style>
  body { font-family: var(--vscode-font-family); padding: 0 16px 40px; color: var(--vscode-foreground); }
  header { position: sticky; top: 0; background: var(--vscode-editor-background); padding: 12px 0; border-bottom: 1px solid var(--vscode-panel-border); }
  .badges span { display: inline-block; font-size: 12px; padding: 2px 8px; margin-right: 6px; border-radius: 10px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
  .tabs { margin: 10px 0; }
  button { font-family: inherit; cursor: pointer; border: none; padding: 6px 12px; margin-right: 6px; border-radius: 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  button.primary, .exports button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  button.active { outline: 2px solid var(--vscode-focusBorder); }
  .exports { margin: 8px 0 4px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 13px; }
  th, td { border: 1px solid var(--vscode-panel-border); padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: var(--vscode-editorWidget-background); }
  h1 { font-size: 22px; } h2 { font-size: 18px; margin-top: 24px; } h3 { font-size: 15px; }
  .doc { display: none; } .doc.active { display: block; }
</style>
</head>
<body>
<header>
  <div class="badges">
    <span>Project: ${escapeHtml(data.projectName)}</span>
    <span>Platform: ${escapeHtml(data.platform)}</span>
    <span>Analysis: ${escapeHtml(engine)}</span>
  </div>
  <div class="tabs">
    <button id="tab-sdd" class="primary active" onclick="showDoc('sdd')">SDD</button>
    <button id="tab-tc" onclick="showDoc('tc')">Test Cases</button>
  </div>
  <div class="exports">
    <button class="primary" onclick="doExport()">Export SDD (Word) + Test Cases (Excel)</button>
  </div>
</header>

<div id="doc-sdd" class="doc active"></div>
<div id="doc-tc" class="doc"></div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const sources = {
    sdd: ${JSON.stringify(data.sddMarkdown)},
    tc: ${JSON.stringify(data.testCasesMarkdown)}
  };
  document.getElementById('doc-sdd').innerHTML = mdToHtml(sources.sdd);
  document.getElementById('doc-tc').innerHTML = mdToHtml(sources.tc);

  function showDoc(which) {
    for (const id of ['sdd','tc']) {
      document.getElementById('doc-' + id).classList.toggle('active', id === which);
      document.getElementById('tab-' + id).classList.toggle('active', id === which);
    }
  }
  function doExport() { vscode.postMessage({ command: 'export' }); }

  // Minimal, dependency-free Markdown -> HTML (headings, tables, lists, bold).
  function mdToHtml(md) {
    const lines = md.split('\\n');
    let html = '', i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\\|.*\\|\\s*$/.test(line) && /^\\|[\\s:|-]+\\|\\s*$/.test(lines[i+1] || '')) {
        const header = cells(line);
        i += 2;
        let body = '';
        while (i < lines.length && /^\\|.*\\|\\s*$/.test(lines[i])) {
          body += '<tr>' + cells(lines[i]).map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>';
          i++;
        }
        html += '<table><thead><tr>' + header.map(h => '<th>' + inline(h) + '</th>').join('') + '</tr></thead><tbody>' + body + '</tbody></table>';
        continue;
      }
      const hd = /^(#{1,6})\\s+(.*)$/.exec(line);
      if (hd) { const l = hd[1].length; html += '<h' + l + '>' + inline(hd[2]) + '</h' + l + '>'; i++; continue; }
      if (/^[-*]\\s+/.test(line)) {
        html += '<ul>';
        while (i < lines.length && /^[-*]\\s+/.test(lines[i])) { html += '<li>' + inline(lines[i].replace(/^[-*]\\s+/, '')) + '</li>'; i++; }
        html += '</ul>'; continue;
      }
      if (line.trim() === '') { i++; continue; }
      html += '<p>' + inline(line) + '</p>'; i++;
    }
    return html;
  }
  function cells(row) { return row.replace(/^\\||\\|\\s*$/g, '').split('|').map(s => s.trim()); }
  function inline(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
            .replace(/<br>/g, '<br/>').replace(/_([^_]+)_/g, '<em>$1</em>');
  }
</script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
