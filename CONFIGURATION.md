# InstaDocs — Configuring the UiPath LLM Gateway (per customer / tenant)

InstaDocs derives the LLM Gateway **URL, org, tenant, and token** automatically. A
customer on a different org/tenant/environment does **not** edit any code — they
choose one of the channels below.

## Resolution order (first non-empty wins, per field)

1. **Caller overrides** — VS Code settings (`instadocs.gateway.*`) passed by the extension.
2. **Environment variables** — `INSTADOCS_GATEWAY_URL` · `INSTADOCS_GATEWAY_TOKEN` · `INSTADOCS_GATEWAY_MODEL`; also `UIPATH_URL` · `UIPATH_ORGANIZATION_NAME` · `UIPATH_TENANT_NAME` · `UIPATH_ACCESS_TOKEN`.
3. **`instadocs.config.json`** — searched from the project dir upward, then `~/.instadocs/`, then `~`.
4. **Signed-in `uip` session** — `~/.uipath/.auth` (token auto-refreshed on 401).
5. **Built-in default** — model `anthropic.claude-opus-4-8`.

The Gateway URL is built as
`{baseHost}/{organization}/{tenant}/{servicePrefix}/llm/api/chat/completions`,
where `servicePrefix` auto-selects `agenthub_` for `*.uipath.com` else `orchestrator_`
(override with `servicePrefix`, or set a full `gatewayUrl`).

## Option A — just log in (simplest)
```bash
uip login --organization <ORG_NAME> --tenant <TENANT_NAME>
# other environment:
uip login --authority https://staging.uipath.com --organization <ORG_NAME> --tenant <TENANT_NAME>
```

## Option B — `instadocs.config.json` (portable, CLI + extension)
Copy [`instadocs.config.example.json`](instadocs.config.example.json) → `instadocs.config.json`
next to the project (or in `~/.instadocs/`). Omit any field to fall back to the session.
```json
{ "gateway": { "baseHost": "https://cloud.uipath.com", "organization": "acme", "tenant": "Production", "model": "anthropic.claude-opus-4-8" } }
```
Token: prefer `uip login` (auto-refreshed). Only set `"token"` for headless/CI, and never commit a real one.

## Option C — environment variables (CI / headless)
```bash
export INSTADOCS_GATEWAY_URL="https://<host>/<org>/<tenant>/agenthub_/llm/api/chat/completions"
export INSTADOCS_GATEWAY_TOKEN="<bearer-or-PAT>"
export INSTADOCS_GATEWAY_MODEL="anthropic.claude-opus-4-8"
```

## Option D — VS Code settings (**Settings → InstaDocs**)
`instadocs.gateway.baseHost` · `organization` · `tenant` · `servicePrefix` · `baseUrl` (full URL) · `model`.
A manual URL/host with no token prompts once and stores it in SecretStorage.

Open these from the extension: the welcome page's **Gateway settings** button
jumps straight to `instadocs.gateway` in Settings, and the **Open Generator**
panel has an inline **Override config** section (host/org/tenant/model/token)
that applies just to that generation run.

## Notes
- **Model must be routable in the customer's tenant** (region/product gating). If a model returns `417 "No llm routing rule found"`, pick another via `model`.
- Calls consume **Agent Units**.
- Resolution is centralized in [`packages/core/src/analyze/gatewayConfig.ts`](packages/core/src/analyze/gatewayConfig.ts) (`resolveGatewayConfig`).
