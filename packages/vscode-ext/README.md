# InstaDocs (VS Code extension)

Generate a **Solution Design Document (Word)** and a **Test Case Document (Excel)**
from an existing RPA / automation project — straight from the source code.

## Install (from .vsix)

1. Download `instadocs-vscode-<version>-win32-x64.vsix`.
2. In VS Code: **Extensions** panel → **⋯** (top-right) → **Install from VSIX…** →
   pick the file. (Or run: `code --install-extension instadocs-vscode-*.vsix`.)
3. Reload if prompted.

> This build is **Windows x64** only (it bundles a native image renderer).
> For the `Generate from Git URL` command, **Git** must be installed and on PATH.

## Use

1. Open a folder that contains an automation project (e.g. a UiPath project with
   `project.json` + `.xaml`).
2. **Ctrl+Shift+P** → **InstaDocs: Generate Docs from Open Workspace**
   (or **InstaDocs: Generate Docs from Git URL**).
3. Review the preview, then **Export SDD (Word) + Test Cases (Excel)** to a folder.

Runs in deterministic mode by default (no network). To enable the AI narrative,
set **`instadocs.gateway.baseUrl`** / **`instadocs.gateway.model`** in Settings;
the token is prompted once and stored in VS Code SecretStorage.

## Build the .vsix yourself

```bash
npm install          # at the repo root
npm run build        # builds core + bundles the extension
npm run package -w instadocs-vscode   # produces the .vsix in packages/vscode-ext
```
