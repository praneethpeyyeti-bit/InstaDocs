/**
 * AgentSpec — the parsed shape of a UiPath AI Agent (agentic automation).
 *
 * Where the RPA path revolves around a `ProcessGraph` of activities, the agentic
 * path revolves around this spec: the agent's prompt, model, tools, I/O, context
 * sources and escalation paths. It is extracted (best-effort, tolerant) from a
 * low-code `agent.json` (Agent Builder / Studio Web) or a coded agent
 * (Python + `pyproject.toml` / `uipath.json`, e.g. LangGraph / LlamaIndex).
 *
 * Every field is optional-by-nature: parsers fill what the source reveals and
 * leave the rest for the analyze stage to mark "To be provided by SME".
 */

/** How the agent is authored. */
export type AgentKind = 'lowCode' | 'coded' | 'unknown';

export interface AgentModel {
  /** Model id, e.g. "gpt-4o-2024-08-06" or "anthropic.claude-opus-4-8". */
  name?: string;
  /** Provider, when derivable (OpenAI, Azure OpenAI, Anthropic, UiPath Gateway). */
  provider?: string;
  temperature?: string;
  maxTokens?: string;
  /** Any other model settings verbatim, for the analyzer. */
  settings?: Record<string, string>;
}

export interface AgentTool {
  name: string;
  /** integration | activity | rpaWorkflow | apiWorkflow | agent | escalation | tool. */
  type?: string;
  description?: string;
}

export interface AgentArgument {
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
}

export interface AgentEscalation {
  name: string;
  description?: string;
  /** Action Center app / target the escalation routes to, if known. */
  target?: string;
}

export interface AgentKnowledge {
  name: string;
  /** contextGrounding | index | file | url | memory. */
  type?: string;
  description?: string;
}

export interface AgentSpec {
  kind: AgentKind;
  name: string;
  description?: string;
  /** File the spec was parsed from (relative), for diagnostics. */
  source: string;
  /** Runtime/framework: agentBuilder | langgraph | llamaindex | openai-agents. */
  runtime?: string;
  systemPrompt?: string;
  userPrompt?: string;
  model?: AgentModel;
  tools: AgentTool[];
  inputs: AgentArgument[];
  outputs: AgentArgument[];
  escalations: AgentEscalation[];
  knowledge: AgentKnowledge[];
  /** Guardrail / trust-layer settings observed (free-form strings). */
  guardrails: string[];
  /** Original object(s) for the analyzer to consult if needed. */
  raw?: Record<string, unknown>;
}

export function emptyAgentSpec(name: string, source: string, kind: AgentKind = 'unknown'): AgentSpec {
  return {
    kind,
    name,
    source,
    tools: [],
    inputs: [],
    outputs: [],
    escalations: [],
    knowledge: [],
    guardrails: [],
  };
}
