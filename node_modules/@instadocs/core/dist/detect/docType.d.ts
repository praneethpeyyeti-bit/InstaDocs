/**
 * Which deliverable a project maps to:
 *   - 'sdd' → RPA  → Solution Design Document (the classic activity-based path)
 *   - 'add' → Agentic → Agentic Design Document (AI Agent path)
 */
export type DocType = 'sdd' | 'add';
export interface DocTypeResult {
    docType: DocType;
    /** Human-readable reasons for the classification. */
    evidence: string[];
}
/**
 * Decide whether a project is agentic (AI Agent) or RPA. Signature-based and
 * tolerant — any strong agentic marker wins; otherwise it is treated as RPA.
 *
 * Strong agentic signals (in priority order):
 *   1. an `agent.json` (Agent Builder / Studio Web low-code agent),
 *   2. a `project.json` whose type/output declares an agent,
 *   3. a coded agent: `pyproject.toml` / `uipath.json` referencing an agent
 *      framework (LangGraph, LlamaIndex, OpenAI Agents, uipath-langchain).
 */
export declare function detectDocType(workingDir: string): DocTypeResult;
/** Find an `agent.json` at the root or anywhere shallow in the tree. */
export declare function findAgentJson(workingDir: string): string | undefined;
