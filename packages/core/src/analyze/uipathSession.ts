/**
 * Reuse the signed-in UiPath CLI (`uip`) session so InstaDocs can call the LLM
 * Gateway without the caller pasting a token.
 *
 * The `uip login` flow writes an env-style file at `~/.uipath/.auth` containing
 * `UIPATH_ACCESS_TOKEN=<bearer>` (and, depending on the CLI version, the org /
 * tenant / base URL). We read the app's OWN provider credential here at runtime;
 * the token is never logged or printed.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

export interface UiPathSession {
  token?: string;
  /** Cloud base, e.g. https://cloud.uipath.com (or a staging/alpha host). */
  baseHost?: string;
  /** Organization LOGICAL NAME (e.g. "my-org") — used in the gateway URL path. */
  organization?: string;
  /** Tenant name (e.g. "DefaultTenant"). */
  tenant?: string;
}

function authFilePath(): string {
  return process.env.UIPATH_AUTH_FILE || path.join(os.homedir(), '.uipath', '.auth');
}

/** Parse the KEY=VALUE `.auth` file (best-effort; missing file => empty). */
function readAuthFile(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(authFilePath(), 'utf8').replace(/^﻿/, '');
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq > 0) out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  } catch {
    /* not logged in via uip, or file unreadable */
  }
  return out;
}

/**
 * Resolve the UiPath session: prefer explicit environment variables, then the
 * `uip` CLI's `.auth` file. Returns whatever pieces are available.
 */
export function resolveUiPathSession(): UiPathSession {
  const env = process.env;
  const auth = readAuthFile();
  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = env[k] ?? auth[k];
      if (v) return v;
    }
    return undefined;
  };

  const baseHost = pick('UIPATH_URL', 'UIPATH_BASE_URL', 'UIPATH_CLOUD_URL')?.replace(/\/+$/, '');
  return {
    token: pick('UIPATH_ACCESS_TOKEN', 'INSTADOCS_GATEWAY_TOKEN'),
    baseHost,
    // The gateway URL path needs the org LOGICAL NAME (not the GUID), so prefer
    // *_NAME keys; fall back to id only if that is all we have.
    organization: pick('UIPATH_ORGANIZATION_NAME', 'UIPATH_ORGANIZATION', 'UIPATH_ACCOUNT', 'UIPATH_ORGANIZATION_ID'),
    tenant: pick('UIPATH_TENANT_NAME', 'UIPATH_TENANT', 'UIPATH_TENANT_ID'),
  };
}

/**
 * Proactively refresh the signed-in `uip` session token by invoking
 * `uip login refresh`, then re-read the session. Best-effort: returns the
 * refreshed session on success, or undefined if the CLI is unavailable / not
 * logged in. The token is never printed (stdout is discarded).
 */
export function refreshUiPathSession(): UiPathSession | undefined {
  try {
    // Single command string (not args array) with shell:true avoids Node's
    // DEP0190 warning; the command is fixed (no interpolation), so it is safe.
    const res = spawnSync('uip login refresh', {
      shell: true, // resolve uip / uip.cmd on Windows
      stdio: ['ignore', 'ignore', 'ignore'],
      timeout: 60_000,
      windowsHide: true,
    });
    if (res.status !== 0) return undefined;
    return resolveUiPathSession();
  } catch {
    return undefined;
  }
}
