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
exports.DEFAULT_GATEWAY_MODEL = void 0;
exports.loadInstadocsConfig = loadInstadocsConfig;
exports.resolveGatewayConfig = resolveGatewayConfig;
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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const uipathSession_1 = require("./uipathSession");
exports.DEFAULT_GATEWAY_MODEL = 'anthropic.claude-opus-4-8';
const CONFIG_NAME = 'instadocs.config.json';
/** Find + parse `instadocs.config.json` (project dir walking up, then home). */
function loadInstadocsConfig(startDir) {
    const candidates = [];
    let dir = startDir ? path.resolve(startDir) : undefined;
    while (dir) {
        candidates.push(path.join(dir, CONFIG_NAME));
        const parent = path.dirname(dir);
        if (parent === dir)
            break;
        dir = parent;
    }
    candidates.push(path.join(os.homedir(), '.instadocs', CONFIG_NAME));
    candidates.push(path.join(os.homedir(), CONFIG_NAME));
    for (const p of candidates) {
        try {
            if (!fs.existsSync(p))
                continue;
            const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
            // Accept both { ...fields } and { "gateway": { ...fields } }.
            const config = (raw && typeof raw === 'object' && raw.gateway ? raw.gateway : raw);
            return { config: config || {}, path: p };
        }
        catch {
            /* malformed file — skip it */
        }
    }
    return { config: {} };
}
const firstNonEmpty = (...vals) => {
    for (const v of vals)
        if (v && String(v).trim())
            return String(v).trim();
    return undefined;
};
/**
 * Resolve the effective Gateway config. `overrides` is used by the VS Code
 * extension to inject its settings; the CLI passes only `startDir`.
 */
function resolveGatewayConfig(overrides = {}, startDir) {
    const { config: file, path: configPath } = loadInstadocsConfig(startDir);
    const env = process.env;
    const session = (0, uipathSession_1.resolveUiPathSession)();
    const model = firstNonEmpty(overrides.model, env.INSTADOCS_GATEWAY_MODEL, file.model) || exports.DEFAULT_GATEWAY_MODEL;
    const token = firstNonEmpty(overrides.token, env.INSTADOCS_GATEWAY_TOKEN, file.token, session.token);
    // Full-URL override wins; otherwise build it from host + org + tenant + prefix.
    let baseUrl = firstNonEmpty(overrides.gatewayUrl, env.INSTADOCS_GATEWAY_URL, file.gatewayUrl);
    if (!baseUrl) {
        const host = (firstNonEmpty(overrides.baseHost, env.UIPATH_URL, file.baseHost, session.baseHost) || '').replace(/\/+$/, '');
        const org = firstNonEmpty(overrides.organization, env.UIPATH_ORGANIZATION_NAME, file.organization, session.organization);
        const tenant = firstNonEmpty(overrides.tenant, env.UIPATH_TENANT_NAME, file.tenant, session.tenant);
        if (host && org && tenant) {
            let prefix = firstNonEmpty(overrides.servicePrefix, file.servicePrefix) || (/\.uipath\.com/i.test(host) ? 'agenthub_' : 'orchestrator_');
            if (!prefix.endsWith('_'))
                prefix += '_';
            baseUrl = `${host}/${org}/${tenant}/${prefix}/llm/api/chat/completions`;
        }
    }
    if (!baseUrl)
        return { note: 'no Gateway URL — run `uip login`, add instadocs.config.json (baseHost/organization/tenant), or set INSTADOCS_GATEWAY_URL', configPath };
    if (!token)
        return { note: 'no token — run `uip login` or set INSTADOCS_GATEWAY_TOKEN', configPath };
    return { config: { baseUrl, token, model }, note: `${baseUrl} (model ${model})`, configPath };
}
//# sourceMappingURL=gatewayConfig.js.map