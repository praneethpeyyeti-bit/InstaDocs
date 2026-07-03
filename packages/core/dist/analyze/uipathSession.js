"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUiPathSession = resolveUiPathSession;
exports.refreshUiPathSession = refreshUiPathSession;
exports.gatewayUrlFromSession = gatewayUrlFromSession;
/**
 * Reuse the signed-in UiPath CLI (`uip`) session so InstaDocs can call the LLM
 * Gateway without the caller pasting a token.
 *
 * The `uip login` flow writes an env-style file at `~/.uipath/.auth` containing
 * `UIPATH_ACCESS_TOKEN=<bearer>` (and, depending on the CLI version, the org /
 * tenant / base URL). We read the app's OWN provider credential here at runtime;
 * the token is never logged or printed.
 */
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
function authFilePath() {
    return process.env.UIPATH_AUTH_FILE || path.join(os.homedir(), '.uipath', '.auth');
}
/** Parse the KEY=VALUE `.auth` file (best-effort; missing file => empty). */
function readAuthFile() {
    const out = {};
    try {
        const raw = fs.readFileSync(authFilePath(), 'utf8').replace(/^﻿/, '');
        for (const line of raw.split(/\r?\n/)) {
            const t = line.trim();
            if (!t || t.startsWith('#'))
                continue;
            const eq = t.indexOf('=');
            if (eq > 0)
                out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
        }
    }
    catch {
        /* not logged in via uip, or file unreadable */
    }
    return out;
}
/**
 * Resolve the UiPath session: prefer explicit environment variables, then the
 * `uip` CLI's `.auth` file. Returns whatever pieces are available.
 */
function resolveUiPathSession() {
    const env = process.env;
    const auth = readAuthFile();
    const pick = (...keys) => {
        for (const k of keys) {
            const v = env[k] ?? auth[k];
            if (v)
                return v;
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
function refreshUiPathSession() {
    try {
        // Single command string (not args array) with shell:true avoids Node's
        // DEP0190 warning; the command is fixed (no interpolation), so it is safe.
        const res = (0, child_process_1.spawnSync)('uip login refresh', {
            shell: true, // resolve uip / uip.cmd on Windows
            stdio: ['ignore', 'ignore', 'ignore'],
            timeout: 60_000,
            windowsHide: true,
        });
        if (res.status !== 0)
            return undefined;
        return resolveUiPathSession();
    }
    catch {
        return undefined;
    }
}
/**
 * Build the UiPath LLM Gateway "normalized" chat/completions URL.
 *
 * The gateway is fronted by AgentHub (`agenthub_/llm/...`) on `.uipath.com`, and
 * by Orchestrator (`orchestrator_/llm/...`) elsewhere — matching the official
 * uipath-langchain SDK's endpoint selection. The path uses the org LOGICAL NAME.
 * Returns undefined if any piece is missing.
 */
function gatewayUrlFromSession(session) {
    const { baseHost, organization, tenant } = session;
    if (!baseHost || !organization || !tenant)
        return undefined;
    const service = /\.uipath\.com/i.test(baseHost) ? 'agenthub_' : 'orchestrator_';
    return `${baseHost}/${organization}/${tenant}/${service}/llm/api/chat/completions`;
}
//# sourceMappingURL=uipathSession.js.map