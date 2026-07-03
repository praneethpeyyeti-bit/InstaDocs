import { ProcessGraph } from '../model/ir';
/**
 * Compact a ProcessGraph into a compact, token-efficient text outline for the
 * LLM. Large graphs are truncated so we stay within context limits; the counts
 * of what was dropped are stated so nothing is silently hidden.
 */
export declare function compactGraph(graph: ProcessGraph, maxNodes?: number): string;
