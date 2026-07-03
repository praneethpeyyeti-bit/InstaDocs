/**
 * UiPath LLM Gateway client.
 *
 * Thin wrapper over the Gateway's OpenAI-compatible chat/completions endpoint.
 * Auth is a bearer token (UiPath PAT / OAuth access token) supplied by the
 * caller — the VS Code shell reads it from SecretStorage; the CLI from env.
 *
 * Endpoint + model are configurable because Gateway routes differ per tenant.
 * Resolve the exact base URL / model IDs with the `uipath-platform` skill.
 */
export interface GatewayConfig {
    /** e.g. https://cloud.uipath.com/<org>/<tenant>/llmgateway_/... */
    baseUrl: string;
    token: string;
    model: string;
    /** Optional extra headers (e.g. X-UiPath-* routing headers). */
    headers?: Record<string, string>;
    timeoutMs?: number;
}
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export declare class GatewayError extends Error {
    readonly status?: number | undefined;
    constructor(message: string, status?: number | undefined);
}
/** Call the Gateway and return the assistant message content (expected JSON). */
export declare function chat(config: GatewayConfig, messages: ChatMessage[]): Promise<string>;
