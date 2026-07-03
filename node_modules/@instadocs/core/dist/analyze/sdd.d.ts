import { ProcessGraph } from '../model/ir';
import { SddModel } from '../model/sdd';
import { GatewayConfig } from './gateway';
export interface SddEnrichOptions {
    gateway?: GatewayConfig;
    maxRetries?: number;
    onProgress?: (message: string) => void;
}
/**
 * Enrich a ProcessGraph into an SddModel via the LLM Gateway. LLM-only — there
 * is no deterministic fallback: if the Gateway is unavailable or every attempt
 * fails, this throws so the caller surfaces the error rather than emitting a
 * mechanical document.
 */
export declare function enrichSdd(graph: ProcessGraph, options?: SddEnrichOptions): Promise<{
    model: SddModel;
    usedLlm: boolean;
}>;
/**
 * Deterministic SDD — no LLM. Produces a structurally-complete (if terse) model
 * straight from the ProcessGraph + discovery context so the pipeline never fails.
 */
export declare function deterministicSdd(graph: ProcessGraph): SddModel;
