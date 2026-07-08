import { GatewayConfig } from './gateway';
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
export declare const DEFAULT_GATEWAY_MODEL = "anthropic.claude-sonnet-4-5-20250929-v1:0";
/** Find + parse `instadocs.config.json` (project dir walking up, then home). */
export declare function loadInstadocsConfig(startDir?: string): {
    config: InstadocsGatewayConfig;
    path?: string;
};
export interface GatewayResolution {
    /** Ready-to-use client config, or undefined when URL/token could not be resolved. */
    config?: GatewayConfig;
    /** Human-readable status for logging. */
    note: string;
    /** Absolute path of the config file that contributed, if any. */
    configPath?: string;
}
/**
 * Resolve the effective Gateway config. `overrides` is used by the VS Code
 * extension to inject its settings; the CLI passes only `startDir`.
 */
export declare function resolveGatewayConfig(overrides?: InstadocsGatewayConfig, startDir?: string): GatewayResolution;
