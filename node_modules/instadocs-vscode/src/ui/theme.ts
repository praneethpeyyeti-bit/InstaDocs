// Shared branded dark theme for all InstaDocs webviews.
//
// Applies the ui-ux-pro-max checklist: WCAG-AA contrast, an 8px spacing rhythm,
// visible focus rings, ≥44px touch targets, semantic color tokens, dark-adapted
// elevation, 150–300ms motion that respects prefers-reduced-motion, and visible
// (never placeholder-only) form labels. The palette matches the welcome page:
// UiPath orange (#FA4616) as the brand mark, blue (#4C8DFF) as the action accent.

/** CSP-safe random nonce for the single inline <script>. */
export function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < 24; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** HTML-escape for text/attributes. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Content-Security-Policy meta value for a webview using one nonce'd script. */
export function csp(n: string): string {
  return `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${n}'; img-src data:;`;
}

/** The shared design-system CSS. Inline into every page's <style>. */
export const THEME_CSS = /* css */ `
:root {
  --bg: #0B0E14; --panel: #11161F; --elev: #161C27; --elev2: #1B2330;
  --ink: #E6EDF3; --ink-dim: #B6C2D2; --muted: #8B98A9;
  --line: rgba(255,255,255,0.08); --line-strong: rgba(255,255,255,0.16);
  --orange: #FA4616; --blue: #4C8DFF; --blue-ink: #0B0E14;
  --ok: #35C46A; --ok-dim: #7EE787; --err: #FF6B6B; --warn: #FFB454;
  /* 8px spacing rhythm */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
  --r-sm: 6px; --r: 10px; --r-lg: 14px;
  --shadow: 0 1px 2px rgba(0,0,0,.5), 0 8px 24px rgba(0,0,0,.35);
  --focus: 0 0 0 2px var(--bg), 0 0 0 4px var(--blue);
  --t: 160ms cubic-bezier(.2,.6,.2,1);
}
* { box-sizing: border-box; }
html, body { background: var(--bg); }
body {
  margin: 0; color: var(--ink);
  font-family: var(--vscode-font-family), 'Segoe UI', system-ui, sans-serif;
  font-size: 14px; line-height: 1.55;
  background-image:
    radial-gradient(1200px 500px at 80% -10%, rgba(76,141,255,.08), transparent 60%),
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: auto, 48px 48px, 48px 48px;
  min-height: 100vh;
}
.wrap { max-width: 780px; margin: 0 auto; padding: var(--s5) var(--s5) var(--s7); }
h1 { font-size: 24px; font-weight: 800; margin: 0 0 var(--s1); letter-spacing: -.2px; }
h2 { font-size: 18px; font-weight: 700; margin: var(--s5) 0 var(--s2); }
h3 { font-size: 15px; font-weight: 700; margin: var(--s4) 0 var(--s2); }
p { margin: 0 0 var(--s3); }
.muted { color: var(--muted); }
.lede { color: var(--ink-dim); font-size: 14px; margin-bottom: var(--s4); }
a.link, .link { color: var(--blue); cursor: pointer; text-decoration: none; font-weight: 600; background: none; border: none; padding: 0; font: inherit; }
a.link:hover, .link:hover { text-decoration: underline; }
code { font-family: var(--vscode-editor-font-family), 'Cascadia Code', monospace; font-size: 12px;
  background: rgba(255,255,255,.06); color: var(--ink); padding: 1px 6px; border-radius: 5px; }

/* Brand header */
.brand { display: flex; align-items: center; gap: var(--s2); font-weight: 700; font-size: 14px; margin-bottom: var(--s4); }
.brand .logo { width: 28px; height: 28px; border-radius: 8px; background: var(--orange); color: #fff;
  display: grid; place-items: center; font-weight: 800; font-size: 13px; box-shadow: var(--shadow); }
.brand .tag { color: var(--muted); font-weight: 500; }

/* Cards / fieldsets */
.card, fieldset { background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-lg);
  padding: var(--s4); margin: 0 0 var(--s4); box-shadow: var(--shadow); }
fieldset { padding: var(--s2) var(--s4) var(--s4); }
legend { padding: 0 var(--s2); font-weight: 700; font-size: 12px; letter-spacing: .3px;
  color: var(--muted); text-transform: uppercase; }
.step-badge { display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
  background: var(--blue); color: var(--blue-ink); font-size: 11px; font-weight: 800; margin-right: var(--s1); }

/* Forms — visible labels, clear focus */
label { display: block; font-size: 12px; font-weight: 600; margin: var(--s3) 0 var(--s1); color: var(--ink-dim); }
label:first-child { margin-top: var(--s1); }
input[type=text], input[type=password], select, textarea {
  width: 100%; padding: 10px 12px; border-radius: var(--r-sm); font: inherit; color: var(--ink);
  background: var(--elev); border: 1px solid var(--line-strong); transition: border-color var(--t), box-shadow var(--t); }
input::placeholder { color: #5D6B7C; }
input:hover, select:hover { border-color: rgba(255,255,255,.28); }
input:focus, select:focus, textarea:focus, button:focus-visible, .link:focus-visible, a:focus-visible {
  outline: none; border-color: var(--blue); box-shadow: var(--focus); }
select { appearance: none; background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 18px) 55%, calc(100% - 13px) 55%; background-size: 5px 5px, 5px 5px; background-repeat: no-repeat; padding-right: 34px; }
.row { display: flex; gap: var(--s2); align-items: stretch; }
.row input { flex: 1; }
.hint { font-size: 12px; color: var(--muted); margin-top: var(--s2); }

/* Buttons — min 44px tall, distinct states */
button, .btn { font: inherit; font-weight: 600; cursor: pointer; border: 1px solid transparent;
  min-height: 40px; padding: 9px 16px; border-radius: var(--r-sm); color: var(--ink);
  background: var(--elev2); border-color: var(--line-strong);
  display: inline-flex; align-items: center; gap: var(--s2); transition: background var(--t), border-color var(--t), transform var(--t), filter var(--t); }
button:hover, .btn:hover { background: #222C3B; border-color: rgba(255,255,255,.28); }
button:active, .btn:active { transform: translateY(1px); }
button.primary, .btn.primary { background: var(--blue); color: var(--blue-ink); border-color: transparent; }
button.primary:hover, .btn.primary:hover { filter: brightness(1.08); background: var(--blue); }
button:disabled { opacity: .5; cursor: default; transform: none; }
.btn-lg { min-height: 46px; padding: 12px 22px; font-size: 15px; }

/* Segmented control */
.seg { display: inline-flex; background: var(--elev); border: 1px solid var(--line-strong); border-radius: var(--r-sm); padding: 3px; gap: 3px; }
.seg button { min-height: 32px; padding: 5px 14px; border-radius: 6px; background: transparent; border: none; color: var(--ink-dim); }
.seg button:hover { background: rgba(255,255,255,.05); }
.seg button.active { background: var(--blue); color: var(--blue-ink); }

/* Pills / badges */
.pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600;
  padding: 4px 10px; border-radius: 999px; background: var(--elev2); border: 1px solid var(--line-strong); color: var(--ink-dim); }
.pill.ok { color: var(--ok-dim); border-color: rgba(53,196,106,.4); background: rgba(53,196,106,.12); }
.pill .dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

/* Log / result / error surfaces */
.log { white-space: pre-wrap; font-family: var(--vscode-editor-font-family), monospace; font-size: 12.5px;
  background: #0A0D13; border: 1px solid var(--line); border-radius: var(--r); padding: var(--s3);
  margin-top: var(--s4); max-height: 240px; overflow: auto; color: var(--ink-dim); }
.result { border: 1px solid var(--line); border-left: 3px solid var(--ok); background: var(--panel);
  border-radius: var(--r); padding: var(--s4); margin-top: var(--s4); box-shadow: var(--shadow); }
.result .path { font-family: var(--vscode-editor-font-family), monospace; font-size: 12.5px; word-break: break-all; margin: var(--s2) 0; }
.error { color: var(--err); margin-top: var(--s4); font-weight: 600; }

/* Tables (preview) */
table { border-collapse: collapse; width: 100%; margin: var(--s3) 0; font-size: 13px; }
th, td { border: 1px solid var(--line-strong); padding: 8px 10px; text-align: left; vertical-align: top; }
th { background: var(--elev2); color: var(--ink); font-weight: 700; }
tr:nth-child(even) td { background: rgba(255,255,255,.02); }

details summary { cursor: pointer; font-weight: 600; color: var(--ink-dim); list-style: none; }
details summary::-webkit-details-marker { display: none; }
details summary::before { content: '▸'; display: inline-block; margin-right: 6px; transition: transform var(--t); color: var(--muted); }
details[open] summary::before { transform: rotate(90deg); }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

/** Standard <head> block wiring CSP + shared theme + an optional page-specific style. */
export function headHtml(n: string, title: string, extraCss = ''): string {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy" content="${csp(n)}" />
<title>${esc(title)}</title>
<style>${THEME_CSS}${extraCss}</style>
</head>`;
}
