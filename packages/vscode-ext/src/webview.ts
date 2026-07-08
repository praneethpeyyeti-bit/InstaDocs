import * as vscode from 'vscode';
import { nonce as makeNonce, esc as escapeHtml, headHtml } from './ui/theme';

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
  const engine = data.usedLlm ? 'UiPath LLM Gateway' : 'Deterministic (no LLM)';
  const extraCss = /* css */ `
  header { position: sticky; top: 0; z-index: 10; background: rgba(11,14,20,.86); backdrop-filter: blur(8px);
    padding: var(--s3) var(--s5); border-bottom: 1px solid var(--line); }
  .badges { display: flex; flex-wrap: wrap; gap: var(--s2); margin-bottom: var(--s3); }
  .tabs { display: inline-flex; gap: var(--s1); background: var(--elev); border: 1px solid var(--line-strong); border-radius: var(--r-sm); padding: 3px; }
  .tabs button { min-height: 32px; padding: 5px 16px; background: transparent; border: none; color: var(--ink-dim); border-radius: 6px; }
  .tabs button.active { background: var(--blue); color: var(--blue-ink); }
  .exports { margin-top: var(--s3); }
  .body { padding: var(--s4) var(--s5) var(--s7); }
  .doc { display: none; } .doc.active { display: block; }`;

  return /* html */ `${headHtml(nonce, 'InstaDocs — Preview', extraCss)}
<body>
<header>
  <div class="brand"><div class="logo">Ui</div> InstaDocs <span class="tag">· ${escapeHtml(data.projectName)}</span></div>
  <div class="badges">
    <span class="pill"><span class="dot"></span>${escapeHtml(data.platform)}</span>
    <span class="pill ok"><span class="dot"></span>${escapeHtml(engine)}</span>
  </div>
  <div class="tabs" role="tablist">
    <button id="tab-sdd" class="active">SDD</button>
    <button id="tab-tc">Test Cases</button>
  </div>
  <div class="exports">
    <button id="btn-export" class="primary">⬇ Export SDD (Word) + Test Cases (Excel)</button>
  </div>
</header>

<div class="body">
  <div id="doc-sdd" class="doc active"></div>
  <div id="doc-tc" class="doc"></div>
</div>

<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const sources = {
    sdd: ${JSON.stringify(data.sddMarkdown)},
    tc: ${JSON.stringify(data.testCasesMarkdown)}
  };
  document.getElementById('doc-sdd').innerHTML = mdToHtml(sources.sdd);
  document.getElementById('doc-tc').innerHTML = mdToHtml(sources.tc);

  // Wire events here — a strict webview CSP (nonce script-src, no unsafe-inline)
  // blocks inline onclick= handlers, so buttons must be bound programmatically.
  document.getElementById('tab-sdd').addEventListener('click', function () { showDoc('sdd'); });
  document.getElementById('tab-tc').addEventListener('click', function () { showDoc('tc'); });
  document.getElementById('btn-export').addEventListener('click', doExport);

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
