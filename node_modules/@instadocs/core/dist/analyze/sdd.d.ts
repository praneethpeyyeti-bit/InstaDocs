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
 * Enrich a MULTI-PROJECT solution (e.g. Dispatcher / Performer / Reporter) into
 * a single combined SddModel. Each project's compacted evidence is included and
 * the LLM is asked for solution-level content plus one `projectFlows` entry per
 * project (each drives its own high-level flow diagram). LLM-only.
 */
export declare function enrichSddSolution(solutionName: string, projects: {
    name: string;
    graph: ProcessGraph;
}[], merged: ProcessGraph, options?: SddEnrichOptions): Promise<{
    model: SddModel;
    usedLlm: boolean;
}>;
/** Merge several project graphs into one graph for solution-level fields. */
export declare function mergeGraphs(name: string, graphs: ProcessGraph[]): ProcessGraph;
/**
 * Build a representative Orchestrator queue-item JSON from the Add/Bulk Add
 * Queue Item activities found in the code (the fields actually uploaded), so the
 * SDD shows the real queue-item shape rather than a guess.
 */
export declare function buildQueueItemJson(graph: ProcessGraph): string;
/**
 * Deterministic SDD — no LLM. TEST/OFFLINE SCAFFOLD ONLY: it is not wired into
 * the pipeline (which is LLM-only) and is not part of the public API. Tests use
 * it as a deterministic model source to exercise template filling without a
 * live LLM Gateway. Produces a structurally-complete (if terse) model straight
 * from the ProcessGraph + discovery context.
 */
export declare function deterministicSdd(graph: ProcessGraph): SddModel;
