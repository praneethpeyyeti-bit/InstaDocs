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

export class GatewayError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'GatewayError';
  }
}

/** Call the Gateway and return the assistant message content (expected JSON). */
export async function chat(
  config: GatewayConfig,
  messages: ChatMessage[]
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 240_000);
  try {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
        // UiPath LLM Gateway normalized API: identify the model and disable
        // streaming (matches the official uipath-langchain SDK request).
        'X-UiPath-LlmGateway-NormalizedApi-ModelName': config.model,
        'X-UiPath-Streaming-Enabled': 'false',
        ...(config.headers ?? {}),
      },
      body: JSON.stringify({
        model: config.model,
        // temperature intentionally omitted — newer models (e.g. Opus 4.8)
        // reject it as deprecated, and it is not needed for this task.
        max_tokens: 16000,
        // response_format is OpenAI-only; Anthropic/Claude via the normalized
        // API rejects it, so rely on the prompt + JSON extraction there.
        ...(/anthropic|claude|gemini/i.test(config.model) ? {} : { response_format: { type: 'json_object' } }),
        messages,
      }),
    });
    if (!res.ok) {
      const body = await safeText(res);
      const diag = ['www-authenticate', 'x-uipath-errorcode', 'x-uipath-internal-error', 'apim-request-id', 'content-length']
        .map((h) => (res.headers.get(h) ? `${h}=${res.headers.get(h)}` : ''))
        .filter(Boolean)
        .join(' ');
      throw new GatewayError(
        `LLM Gateway ${res.status}: ${body.slice(0, 500) || '<empty body>'}${diag ? ` [${diag}]` : ''}`,
        res.status
      );
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new GatewayError('LLM Gateway returned no message content.');
    }
    return content;
  } finally {
    clearTimeout(timeout);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '<no body>';
  }
}
