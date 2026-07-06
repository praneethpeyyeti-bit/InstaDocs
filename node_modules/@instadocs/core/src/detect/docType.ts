import * as path from 'path';
import { exists, readText, walkFiles } from '../util/files';

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

/** Python agent frameworks that mark a coded agentic project. */
const AGENT_PY_MARKERS =
  /uipath-langchain|uipath_langchain|langgraph|llama-?index|llama_index|openai-agents|openai_agents|crewai|autogen|\buipath\.agent\b/i;

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
export function detectDocType(workingDir: string): DocTypeResult {
  const evidence: string[] = [];

  // 1) Low-code agent definition.
  const agentJson = findAgentJson(workingDir);
  if (agentJson) {
    evidence.push(`agent.json found (${path.relative(workingDir, agentJson)}) — low-code agent`);
    return { docType: 'add', evidence };
  }

  // 2) project.json declaring an agent.
  const pj = path.join(workingDir, 'project.json');
  if (exists(pj)) {
    try {
      const obj = JSON.parse(readText(pj));
      const declared = [
        obj.projectType,
        obj.type,
        obj?.designOptions?.outputType,
        obj?.designOptions?.projectType,
      ]
        .filter(Boolean)
        .map((v: unknown) => String(v).toLowerCase());
      if (declared.some((v) => v.includes('agent'))) {
        evidence.push(`project.json declares an agent project (${declared.join(', ')})`);
        return { docType: 'add', evidence };
      }
    } catch {
      /* ignore malformed project.json */
    }
  }

  // 3) Coded agent: python + an agent framework.
  const pyproject = path.join(workingDir, 'pyproject.toml');
  if (exists(pyproject) && AGENT_PY_MARKERS.test(readSafe(pyproject))) {
    evidence.push('pyproject.toml references an agent framework — coded agent');
    return { docType: 'add', evidence };
  }
  const uipathJson = path.join(workingDir, 'uipath.json');
  if (exists(uipathJson) && AGENT_PY_MARKERS.test(readSafe(uipathJson))) {
    evidence.push('uipath.json references an agent framework — coded agent');
    return { docType: 'add', evidence };
  }
  // Any Python source referencing an agent framework (shallow scan).
  const py = walkFiles(workingDir, { extensions: ['.py'], maxFiles: 200 });
  const agentPy = py.find((f) => AGENT_PY_MARKERS.test(readSafe(f)));
  if (agentPy) {
    evidence.push(`${path.relative(workingDir, agentPy)} imports an agent framework — coded agent`);
    return { docType: 'add', evidence };
  }

  evidence.push('No agentic markers found — treated as an RPA project (SDD).');
  return { docType: 'sdd', evidence };
}

/** Find an `agent.json` at the root or anywhere shallow in the tree. */
export function findAgentJson(workingDir: string): string | undefined {
  const root = path.join(workingDir, 'agent.json');
  if (exists(root)) return root;
  const found = walkFiles(workingDir, { extensions: ['.json'], maxFiles: 2000 }).find(
    (f) => path.basename(f).toLowerCase() === 'agent.json'
  );
  return found;
}

function readSafe(file: string): string {
  try {
    return readText(file);
  } catch {
    return '';
  }
}
