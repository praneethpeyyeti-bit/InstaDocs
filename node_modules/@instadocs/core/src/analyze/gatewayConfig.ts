/**
 * Customer-facing LLM Gateway configuration.
 *
 * Resolution order for every field (first non-empty wins):
 *   1. caller overrides   (e.g. VS Code settings passed by the extension)
 *   2. environment vars   (INSTADOCS_GATEWAY_* / UIPATH_*)
 *   3. `instadocs.config.json`  (project dir → parents → ~/.instadocs/ → ~)
 *   4. the signed-in `uip` session (~/.uipath/.auth)
 *   5. built-in default (model only)
 *
 * A customer with a different org/tenant/environment can therefore either just
 * `uip login` to their tenant, drop an `instadocs.config.json` next to their
 * project, set env vars, or set VS Code settings — no code change.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { GatewayConfig } from './gateway';
import { resolveUiPathSession } from './uipathSession';

export interface InstadocsGatewayConfig {
  /** Cloud base, e.g. https://cloud.uipath.com or https://staging.uipath.com */
  baseHost?: string;
  /** Organization LOGICAL NAME (e.g. "acme"), not the GUID. */
  organization?: string;
  /** Tenant name (case-sensitive, e.g. "DefaultTenant"). */
  tenant?: string;
  /** Service prefix in the gateway path: "agenthub_" or "orchestrator_". Auto if omitted. */
  servicePrefix?: string;
  /** Full chat/completions URL — overrides host/org/tenant when set. */
  gatewayUrl?: string;
  /** Model id, e.g. anthropic.claude-opus-4-8. */
  model?: string;
  /** Bearer token / PAT — overrides the uip session token when set. */
  token?: string;
}

export const DEFAULT_GATEWAY_MODEL = 'anthropic.claude-opus-4-8';
const CONFIG_NAME = 'instadocs.config.json';

/** Find + parse `instadocs.config.json` (project dir walking up, then home). */
export function loadInstadocsConfig(startDir?: string): { config: InstadocsGatewayConfig; path?: string } {
  const candidates: string[] = [];
  let dir = startDir ? path.resolve(startDir) : undefined;
  while (dir) {
    candidates.push(path.join(dir, CONFIG_NAME));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  candidates.push(path.join(os.homedir(), '.instadocs', CONFIG_NAME));
  candidates.push(path.join(os.homedir(), CONFIG_NAME));

  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
      // Accept both { ...fields } and { "gateway": { ...fields } }.
      const config = (raw && typeof raw === 'object' && raw.gateway ? raw.gateway : raw) as InstadocsGatewayConfig;
      return { config: config || {}, path: p };
    } catch {
      /* malformed file — skip it */
    }
  }
  return { config: {} };
}

export interface GatewayResolution {
  /** Ready-to-use client config, or undefined when URL/token could not be resolved. */
  config?: GatewayConfig;
  /** Human-readable status for logging. */
  note: string;
  /** Absolute path of the config file that contributed, if any. */
  configPath?: string;
}

const firstNonEmpty = (...vals: (string | undefined)[]): string | undefined => {
  for (const v of vals) if (v && String(v).trim()) return String(v).trim();
  return undefined;
};

/**
 * Resolve the effective Gateway config. `overrides` is used by the VS Code
 * extension to inject its settings; the CLI passes only `startDir`.
 */
export function resolveGatewayConfig(
  overrides: InstadocsGatewayConfig = {},
  startDir?: string
): GatewayResolution {
  const { config: file, path: configPath } = loadInstadocsConfig(startDir);
  const env = process.env;
  const session = resolveUiPathSession();

  const model =
    firstNonEmpty(overrides.model, env.INSTADOCS_GATEWAY_MODEL, file.model) || DEFAULT_GATEWAY_MODEL;
  const token = firstNonEmpty(overrides.token, env.INSTADOCS_GATEWAY_TOKEN, file.token, session.token);

  // Full-URL override wins; otherwise build it from host + org + tenant + prefix.
  let baseUrl = firstNonEmpty(overrides.gatewayUrl, env.INSTADOCS_GATEWAY_URL, file.gatewayUrl);
  if (!baseUrl) {
    const host = (firstNonEmpty(overrides.baseHost, env.UIPATH_URL, file.baseHost, session.baseHost) || '').replace(/\/+$/, '');
    const org = firstNonEmpty(overrides.organization, env.UIPATH_ORGANIZATION_NAME, file.organization, session.organization);
    const tenant = firstNonEmpty(overrides.tenant, env.UIPATH_TENANT_NAME, file.tenant, session.tenant);
    if (host && org && tenant) {
      let prefix = firstNonEmpty(overrides.servicePrefix, file.servicePrefix) || (/\.uipath\.com/i.test(host) ? 'agenthub_' : 'orchestrator_');
      if (!prefix.endsWith('_')) prefix += '_';
      baseUrl = `${host}/${org}/${tenant}/${prefix}/llm/api/chat/completions`;
    }
  }

  if (!baseUrl)
    return { note: 'no Gateway URL — run `uip login`, add instadocs.config.json (baseHost/organization/tenant), or set INSTADOCS_GATEWAY_URL', configPath };
  if (!token)
    return { note: 'no token — run `uip login` or set INSTADOCS_GATEWAY_TOKEN', configPath };
  return { config: { baseUrl, token, model }, note: `${baseUrl} (model ${model})`, configPath };
}
