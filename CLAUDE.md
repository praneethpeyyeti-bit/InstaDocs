# CLAUDE.md — InstaDocs project context

> Auto-loaded by Claude Code. This gives an AI assistant (and a new teammate)
> everything needed to work in this repo effectively. Keep it current.

## What InstaDocs is

InstaDocs turns an existing **UiPath automation project** (or Power Automate /
Blue Prism / Automation Anywhere) into professional **documentation**. Point it
at a git repo or local folder → it detects the platform, decides whether the
project is a classic **RPA** automation or an **AI Agent**, reads the logic, and
produces:

| Project type | Word deliverable | Also |
|---|---|---|
| **RPA** (`.xaml`/`.cs`) | **Solution Design Document (SDD)** `.docx` | Test Cases `.xlsx` |
| **Agentic** (`agent.json` / coded agent) | **Agentic Design Document (ADD)** `.docx` | Test Cases `.xlsx` |

Deliverables are the branded corporate templates in `Templates/`, filled **only
from parsed source** + the LLM analysis. The analyze stage is **LLM-only** (UiPath
LLM Gateway / Claude) — there is no deterministic document mode; if the Gateway is
not configured, generation fails with a clear message.

## Architecture (layered, one IR)

```
packages/vscode-ext   ← VS Code shell: commands, panel, preview webview, export
        │ imports
packages/core         ← pure-TS pipeline, no UI
  repo → detect → parse → analyze → generate → export
```

Everything pivots on one normalized **ProcessGraph** IR
([packages/core/src/model/ir.ts](packages/core/src/model/ir.ts)): every parser
emits it, every downstream stage consumes it — that keeps the pipeline
platform-agnostic.

### Pipeline stages (`packages/core/src/`)
- **repo/** — clone a git URL to temp or open a local folder.
- **detect/** — signature-based platform scoring; `detect/docType.ts` = RPA(`sdd`)
  vs Agentic(`add`).
- **parse/** — per-platform parsers → `ProcessGraph`. `parse/uipath.ts` is the deep
  one (XAML→XML, activities→NodeKinds, branches/loops/try-catch, arguments,
  invocations, queue items, dependencies, **real REFramework state machine**, and
  `detectApps` = which apps each workflow uses). `parse/agent.ts` → `AgentSpec`.
- **context/** — folds in `AGENTS.md` project-discovery context when present.
- **analyze/** — **LLM-only.** `compact.ts` builds token-efficient evidence;
  `gateway.ts` calls the UiPath LLM Gateway; `sdd.ts`/`add.ts` hold the prompts and
  validate output with zod (`model/sdd.ts`, `model/add.ts`).
- **export/** — fills branded templates: docx via `pizzip`+`docxtemplater`, xlsx via
  `exceljs`; diagrams built as hand-authored **SVG rasterized to PNG via
  `@resvg/resvg-js`** (`export/flowchart.ts`) and injected into the Word OOXML.

## Build / test / run

```bash
npm install
npm run build            # tsc across workspaces
npm test                 # vitest (currently 20 tests)

# core only
cd packages/core && npx tsc -p tsconfig.json && npx vitest run

# CLI
node packages/core/dist/cli.js <repo-or-folder> --out ./out [--doc-type add|sdd]

# VS Code extension: press F5 (Run InstaDocs Extension), open a project, run
# "InstaDocs: Generate Docs from Open Workspace".
```

> ⚠️ **`dist/` and `node_modules/` are committed** in this repo, so it runs without
> a build. **After editing any `.ts` in `packages/core/src`, you MUST rebuild**
> (`cd packages/core && npx tsc -p tsconfig.json`) — the CLI and extension load
> from `dist/`. Commit `src` **and** the rebuilt `dist`.

## LLM Gateway config

Resolved (first non-empty wins) from: VS Code settings → env vars → `instadocs.config.json`
→ signed-in `uip` session (`~/.uipath/.auth`) → default model. See
[CONFIGURATION.md](CONFIGURATION.md). Simplest: `uip login --organization <org> --tenant <tenant>`.

## Process-flow diagrams — the recent work (2026-07)

The high-level process diagram in the SDD was reworked to be **accurate,
code-driven, and business-readable** for both project styles. Key facts:

- **Structure detection is by the entry `Main.xaml` ROOT element**, not naming or
  the presence of a `Framework/` folder:
  - `<StateMachine>` → **REFramework swimlane** (Init / Get Transaction / Process /
    End), driven by the real parsed states + transitions + guard conditions.
  - `<Sequence>`/`<Flowchart>` → **high-level linear/flowchart** business flow.
  This lives in `parse/uipath.ts` (`detectLayout`, `parseStateMachine`) and
  `export/flowchart.ts` (`renderEntryDiagram`, `isReframework`). A folder can
  contain the REFramework skeleton yet have a linear `Main` — always trust the root.
- **REFramework lanes show real business sub-steps** (not workflow file names):
  "Read config settings", "Retrieve Orchestrator assets", "Log in to ACME System1",
  "Calculate SHA1 hash", etc., plus decision diamonds from the real guards, YES/NO,
  off-page connectors (state codes), and SE#/BE# exception tags.
- Those per-state steps come from a new model field **`stateFlows`**
  ([model/sdd.ts](packages/core/src/model/sdd.ts)):
  1. **Primary (Gateway on):** the LLM fills `stateFlows`, grounded in per-state
     evidence emitted by `analyze/compact.ts` (each state's invoked workflows +
     apps + key activities) — prompt in `analyze/sdd.ts`.
  2. **Fallback (offline):** `deriveStateSteps(graph)` in `export/flowchart.ts`
     extracts the steps deterministically from parsed activities.
  The exporter picks LLM-first, else fallback (`export/sddTemplate.ts`).
- **`detectApps`** (`parse/uipath.ts`) captures the real applications each workflow
  touches (web URLs → site name, Excel, Email, Database, PDF, launched `.exe`),
  stored on `graph.workflowApps`. Only real navigation `Url=`/`Address=` attrs are
  scanned — XML namespace URIs and `System.Data.DataTable` variable types are
  explicitly excluded (they caused false "Database"/schema-host hits).
- **Linear (Dispatcher)** now renders the concise `highLevelSteps` business flow,
  not an activity-by-activity dump (`renderEntryDiagram` prefers `hasHighLevelSteps`).

### The renderer (`export/flowchart.ts`, ~1650 lines)
All diagrams are hand-built SVG → PNG via resvg. `stateMachineBlock` is the
REFramework swimlane; `renderHighLevelFlow` the linear flow; `renderProcessFlow`
the branch-aware flowchart; plus agentic diagrams. There is **no LLM in the
drawing** — the LLM only supplies the text content (`stateFlows`, `highLevelSteps`).

### Fast iteration pattern (no Gateway needed)
To eyeball a diagram against a real project without running the whole pipeline,
write a tiny CommonJS probe at the repo root that imports the compiled dist and
renders a PNG, then open the PNG:

```js
// probe.cjs  (run: node probe.cjs, then delete it)
const { parseProject } = require('./packages/core/dist/parse/index.js');
const fc = require('./packages/core/dist/export/flowchart.js');
const fs = require('fs');
(async () => {
  const g = await parseProject('uipath', 'C:/path/to/Performer');
  const stateSteps = fc.deriveStateSteps(g);         // offline per-state steps
  fs.writeFileSync('out.png', fc.renderEntryDiagram('Performer', g, [], stateSteps).png);
})();
```

Test projects used during this work (standard ACME REFramework demo):
- Linear Dispatcher + REFramework Performer:
  `ACMECodingAgentTest_ObjectRepo/ACME_CalculateClientSecurityHash/{Dispatcher,Performer}`

## Gotchas / conventions
- **LLM-only analysis** — no deterministic document path; `deterministicSdd` in
  `analyze/sdd.ts` is a test-only scaffold, never wired into the pipeline.
- **Rebuild `dist` after `src` edits** (see above).
- **Trust the XAML root** for REFramework vs linear, never the folder/name.
- Diagram text must be **code-derived** — do not invent steps; unknown human-only
  fields are left as "To be provided by SME".
- Keep SVG labels short; the swimlane lanes are narrow — long labels truncate.

## Repo map
- `packages/core/` — the pipeline (`@instadocs/core`), CLI at `dist/cli.js`.
- `packages/vscode-ext/` — VS Code extension shell.
- `Templates/` — branded `SDD.docx` / `ADD.docx` / `TestCases.xlsx`.
- `packages/core/assets/` — tagged+scrubbed template copies used at fill time.
- `scripts/` — `tag-sdd-template.js` / `tag-add-template.js` regenerate the tagged assets.
- `README.md`, `CONFIGURATION.md` — product + gateway docs.
