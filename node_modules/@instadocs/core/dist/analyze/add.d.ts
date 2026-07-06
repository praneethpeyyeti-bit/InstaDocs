import { ProcessGraph } from '../model/ir';
import { AddModel } from '../model/add';
import { GatewayConfig } from './gateway';
export interface AddEnrichOptions {
    gateway?: GatewayConfig;
    maxRetries?: number;
    onProgress?: (message: string) => void;
}
/**
 * Enrich a ProcessGraph (carrying an AgentSpec) into an AddModel via the LLM
 * Gateway. LLM-only — no deterministic fallback: if the Gateway is unavailable
 * or every attempt fails, this throws so the caller surfaces the error.
 */
export declare function enrichAdd(graph: ProcessGraph, options?: AddEnrichOptions): Promise<{
    model: AddModel;
    usedLlm: boolean;
}>;
