import { AgentSpec } from '../model/agent';
/**
 * Parse an agentic UiPath project into an AgentSpec. Tries a low-code
 * `agent.json` first (Agent Builder / Studio Web), then falls back to a coded
 * agent (Python + pyproject/uipath.json). Returns undefined if neither is found.
 *
 * The extraction is deliberately tolerant: agent.json has varied across product
 * versions (systemPrompt vs messages[] vs prompt.system; inputArguments vs
 * inputSchema; tools vs resources), so every field is probed across aliases and
 * anything unrecognised is preserved under `raw` for the analyzer.
 */
export declare function parseAgent(workingDir: string): AgentSpec | undefined;
