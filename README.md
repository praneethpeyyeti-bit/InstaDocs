# InstaDocs

Turn an existing **RPA / automation project** into professional documentation.
Point InstaDocs at a git repo (or open folder), and it detects the source
platform, reads the workflow logic, and produces two deliverables whose every
section is populated **only from the parsed source code** — no template sample
data is retained:

- **Process Design Document (PDD)** → **Word (.docx)**
- **Test Case Document** → **Excel (.xlsx)**

These are the only two output formats.

> **Branded templates, code-only content.** Both deliverables are the actual
> corporate templates (`Templates/PDD.docx`, `Templates/TestCases.xlsx`) with
> their original structure, styling, cover, and headings preserved. The
> code-derivable tables (version control, references, applications, inputs/
> outputs, process steps, exceptions, business rules) are filled from the parsed
> source; **every other section's sample data is cleared** and template guidance/
> emails are scrubbed, so nothing but source-derived content remains. Sections
> that require human input (sign-off, contacts, ROI, SLAs, reporting, risk) are
> left as empty labelled structure — never fabricated.

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
- **analyze** — UiPath LLM Gateway enriches the graph into steps, rules, I/O,
  exceptions, test scenarios; validated with zod; **deterministic fallback** if
  no gateway is configured ([analyze/](packages/core/src/analyze/))
- **generate** — PDD **doc AST** used for the in-editor markdown preview
  ([generate/pdd.ts](packages/core/src/generate/pdd.ts))
- **export** ([export/](packages/core/src/export/)):
  - PDD → Word via `docxtemplater` filling the branded template
    ([pddTemplate.ts](packages/core/src/export/pddTemplate.ts))
  - Test Cases → Excel via `exceljs` filling the UAT template
    ([testcasesTemplate.ts](packages/core/src/export/testcasesTemplate.ts))

### Templates

Fill-ready assets live in [packages/core/assets/](packages/core/assets/):
`pdd-template.docx` (tagged + scrubbed) and `testcases-template.xlsx`. If the
source `Templates/PDD.docx` changes, regenerate the tagged asset:

```bash
node scripts/tag-pdd-template.js
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
# From a local folder  -> writes <Project>-PDD.docx and <Project>-TestCases.xlsx
node packages/core/dist/cli.js ./path/to/project --out ./out

# From a git URL
node packages/core/dist/cli.js https://github.com/org/repo.git --branch main --out ./out
```

Optional LLM Gateway (otherwise deterministic analysis is used):

```bash
export INSTADOCS_GATEWAY_URL="https://.../llmgateway_/.../chat/completions"
export INSTADOCS_GATEWAY_TOKEN="<uipath token>"
export INSTADOCS_GATEWAY_MODEL="gpt-4o-mini"
```

### VS Code extension

Press **F5** (Run InstaDocs Extension). In the Extension Development Host:

1. Open a folder containing an automation project.
2. Run **InstaDocs: Generate Docs from Open Workspace** (or **… from Git URL**).
3. Review the PDD / Test Cases in the preview, then click **Export PDD (Word) +
   Test Cases (Excel)** and pick a folder.

Configure the LLM Gateway in Settings (`instadocs.gateway.baseUrl`,
`instadocs.gateway.model`); the token is prompted once and stored in VS Code
SecretStorage.

## Status / roadmap

- ✅ UiPath parser, detection, LLM-Gateway + deterministic analysis, PDD +
  test-case generation, MD/Word/PDF export, VS Code shell, CLI.
- ⏭️ Deepen Power Automate / Blue Prism / Automation Anywhere parsers.
- ⏭️ Wire the exact UiPath LLM Gateway endpoint/model (see the `uipath-platform`
  skill).
- 🔒 Out of scope (vs DocForge): git-provider OAuth, auto-sync on PR merge,
  diff-based review.
