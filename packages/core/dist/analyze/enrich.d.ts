import { ProcessGraph } from '../model/ir';
import { EnrichedModel } from '../model/enriched';
import { GatewayConfig } from './gateway';
export interface EnrichOptions {
    /** When omitted, enrichment uses the deterministic fallback (offline mode). */
    gateway?: GatewayConfig;
    /** Retries for schema-valid JSON from the LLM. */
    maxRetries?: number;
    /**
     * Require the LLM Gateway: never silently fall back to deterministic analysis.
     * If the gateway is missing or every attempt fails, `enrich` throws instead.
     */
    strict?: boolean;
    /** Called with a human-readable status while enriching. */
    onProgress?: (message: string) => void;
}
/**
 * Enrich a ProcessGraph into an EnrichedModel.
 *
 * Hybrid strategy: the deterministic parser already gave us structure; here the
 * LLM Gateway writes the narrative and infers rules/exceptions. If no gateway
 * is configured, or every attempt fails schema validation, we fall back to a
 * deterministic model so the pipeline NEVER hard-fails during a demo.
 */
export declare function enrich(graph: ProcessGraph, options?: EnrichOptions): Promise<{
    model: EnrichedModel;
    usedLlm: boolean;
}>;
