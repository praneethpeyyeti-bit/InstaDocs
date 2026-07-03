# InstaDocs

Turn an existing **UiPath automation project** into professional documentation.
Point InstaDocs at a git repo (or open folder), and it detects the source
platform, decides whether the project is a classic **RPA** automation or an
**AI Agent** (agentic) automation, reads the logic, and produces the matching
Word deliverable plus a test-case workbook — every section populated **only from
the parsed source**:

| Project type | Word deliverable | Also |
|---|---|---|
| **RPA** (`.xaml` / `.cs`) | **Solution Design Document (SDD)** → `.docx` | Test Cases → `.xlsx` |
| **Agentic** (`agent.json` / coded agent) | **Agentic Design Document (ADD)** → `.docx` | Test Cases → `.xlsx` |

The doc type is **auto-detected** (an `agent.json`, an `Agent` project type, or a
coded agent using LangGraph / LlamaIndex / OpenAI Agents / `uipath-langchain`
routes to the ADD; everything else to the SDD). Force it with `--doc-type add|sdd`.

> **Branded templates, code-only content.** Each deliverable is the actual
> corporate template (`Templates/SDD.docx`, `Templates/ADD.docx`,
> `Templates/TestCases.xlsx`) with its original structure, styling, cover, and
> headings preserved. Code-derivable tables and sections are filled from the
> parsed source; **every other section's sample data is cleared** and template
> guidance/emails are scrubbed, so nothing but source-derived content remains.
> Sections that require human input (sign-off, contacts, SLAs, evaluation
> targets, data residency) are left as labelled "To be provided by SME"
> structure — never fabricated.

> **LLM-only analysis.** The analyze stage always runs through the UiPath LLM
> Gateway (Claude) — there is no deterministic document mode. If the Gateway is
> not configured, InstaDocs fails with a clear message rather than emitting a
> mechanical document.

Inspired by [DocForge](https://docforge.net) (point-at-a-repo → AI-generated
docs), but specialized for the automation/RPA niche and the UiPath LLM Gateway.

## Supported source platforms

| Platform | Files parsed | Depth |
|---|---|---|
| **UiPath** | `project.json`, `*.xaml`, `*.cs` | Full (args, branches, invokes, try/catch, annotations) |
| **Power Automate** | flow `definition.json` | Initial (actions → nodes, `runAfter` → edges) |
| **Blue Prism** | `*.bprelease` / process XML | Initial (stages → nodes, links → edges) |
| **Automation Anywhere** | bot `*.json` (`.atmx` detected) | Initial (commands → nodes) |

## Architecture (layered)

```
VS Code extension (packages/vscode-ext)   ← shell: command, progress, webview, export
        │ imports
@instadocs/core (packages/core)           ← pure TS pipeline, no UI
  repo → detect → parse → analyze → generate → export
```

The pipeline is built around one normalized **ProcessGraph** IR
([packages/core/src/model/ir.ts](packages/core/src/model/ir.ts)): every parser
emits it, every downstream stage consumes it. That is what keeps analysis,
generation, and export platform-independent — and lets the same core power a
future UiPath Coded App or web shell with no rework.

- **repo** — clone a git URL or open a local folder ([repo/index.ts](packages/core/src/repo/index.ts))
- **detect** — signature-based platform scoring ([detect/index.ts](packages/core/src/detect/index.ts))
- **parse** — per-platform parsers → `ProcessGraph` ([parse/](packages/core/src/parse/))
- **analyze** — UiPath LLM Gateway enriches the graph into the SDD or ADD model
  (architecture/steps/exceptions, or agent role/tools/model/guardrails/eval),
  validated with zod; **LLM-only, no deterministic fallback** ([analyze/](packages/core/src/analyze/))
- **detect (doc type)** — RPA vs agentic classification ([detect/docType.ts](packages/core/src/detect/docType.ts))
- **parse (agent)** — `agent.json` / coded agent → `AgentSpec` on the IR ([parse/agent.ts](packages/core/src/parse/agent.ts))
- **generate** — doc AST used for the in-editor markdown preview
  ([export/sddMarkdown.ts](packages/core/src/export/sddMarkdown.ts))
- **export** ([export/](packages/core/src/export/)):
  - SDD → Word via `docxtemplater` filling the branded template
    ([sddTemplate.ts](packages/core/src/export/sddTemplate.ts))
  - ADD → Word via `docxtemplater` filling the agentic template
    ([addTemplate.ts](packages/core/src/export/addTemplate.ts))
  - Test Cases → Excel via `exceljs` filling the UAT template
    ([testcasesTemplate.ts](packages/core/src/export/testcasesTemplate.ts))
- **diagrams** ([export/flowchart.ts](packages/core/src/export/flowchart.ts)):
  the RPA doc embeds a **branch-aware structured process flow** (decisions
  fork/merge, loops and try/catch as containers — built from the real activity
  tree, no longer a linear chain) or the REFramework state machine; the agentic
  doc embeds an **agent ecosystem** diagram and an **agent lifecycle** diagram
  (trigger → reason → tools/knowledge → guardrails → escalation → output).

### Templates

Fill-ready assets live in [packages/core/assets/](packages/core/assets/):
`sdd-template.docx`, `add-template.docx` (tagged + scrubbed) and
`testcases-template.xlsx`. If a source template changes, regenerate the tagged
asset:

```bash
node scripts/tag-sdd-template.js   # RPA  Solution Design Document
node scripts/tag-add-template.js   # Agentic Design Document
```

The tagger injects `[[ ]]` loops into the code-derivable tables, clears every
other table's sample values (keeping the grid/labels), and scrubs template
guidance, emails, and sample tokens — preserving branding while guaranteeing
code-only content.

## Quick start

```bash
npm install
npm run build
npm test
```

### CLI

```bash
# From a local folder -> writes <Project>-SDD.docx (RPA) or <Project>-ADD.docx
# (agentic) + <Project>-TestCases.xlsx
node packages/core/dist/cli.js ./path/to/project --out ./out

# Force the deliverable type when auto-detection should be overridden
node packages/core/dist/cli.js ./path/to/agent --doc-type add --out ./out

# From a git URL
node packages/core/dist/cli.js https://github.com/org/repo.git --branch main --out ./out
```

The LLM Gateway is **required** (LLM-only). Configure it via env, or sign in with
`uip login` and InstaDocs reuses that session automatically:

```bash
export INSTADOCS_GATEWAY_URL="https://.../llmgateway_/.../chat/completions"
export INSTADOCS_GATEWAY_TOKEN="<uipath token>"
export INSTADOCS_GATEWAY_MODEL="anthropic.claude-opus-4-8"
```

### VS Code extension

Press **F5** (Run InstaDocs Extension). In the Extension Development Host:

1. Open a folder containing an automation project.
2. Run **InstaDocs: Generate Docs from Open Workspace** (or **… from Git URL**).
3. Review the SDD/ADD / Test Cases in the preview, then click **Export** and pick
   a folder.

Configure the LLM Gateway in Settings (`instadocs.gateway.baseUrl`,
`instadocs.gateway.model`); the token is prompted once and stored in VS Code
SecretStorage.

## Status / roadmap

- ✅ UiPath parser, RPA-vs-agentic detection, LLM-Gateway analysis (LLM-only),
  SDD + ADD + test-case generation, branch-aware process flow + agentic
  diagrams, VS Code shell, CLI.
- ⏭️ Deepen Power Automate / Blue Prism / Automation Anywhere parsers.
- ⏭️ Wire the exact UiPath LLM Gateway endpoint/model (see the `uipath-platform`
  skill).
- 🔒 Out of scope (vs DocForge): git-provider OAuth, auto-sync on PR merge,
  diff-based review.
