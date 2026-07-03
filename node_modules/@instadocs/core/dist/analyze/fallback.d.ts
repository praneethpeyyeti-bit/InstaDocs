import { ProcessGraph } from '../model/ir';
import { EnrichedModel } from '../model/enriched';
/**
 * Deterministic enrichment — no LLM.
 *
 * Produces a structurally-complete (if robotic) EnrichedModel straight from the
 * ProcessGraph. Used when no Gateway is configured or when the LLM output fails
 * validation, guaranteeing the pipeline always yields a document.
 */
export declare function deterministicEnrich(graph: ProcessGraph): EnrichedModel;
