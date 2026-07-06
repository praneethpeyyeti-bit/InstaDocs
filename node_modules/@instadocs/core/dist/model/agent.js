"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.emptyAgentSpec = emptyAgentSpec;
function emptyAgentSpec(name, source, kind = 'unknown') {
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
//# sourceMappingURL=agent.js.map