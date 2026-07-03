"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDocType = detectDocType;
exports.findAgentJson = findAgentJson;
const path = __importStar(require("path"));
const files_1 = require("../util/files");
/** Python agent frameworks that mark a coded agentic project. */
const AGENT_PY_MARKERS = /uipath-langchain|uipath_langchain|langgraph|llama-?index|llama_index|openai-agents|openai_agents|crewai|autogen|\buipath\.agent\b/i;
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
function detectDocType(workingDir) {
    const evidence = [];
    // 1) Low-code agent definition.
    const agentJson = findAgentJson(workingDir);
    if (agentJson) {
        evidence.push(`agent.json found (${path.relative(workingDir, agentJson)}) — low-code agent`);
        return { docType: 'add', evidence };
    }
    // 2) project.json declaring an agent.
    const pj = path.join(workingDir, 'project.json');
    if ((0, files_1.exists)(pj)) {
        try {
            const obj = JSON.parse((0, files_1.readText)(pj));
            const declared = [
                obj.projectType,
                obj.type,
                obj?.designOptions?.outputType,
                obj?.designOptions?.projectType,
            ]
                .filter(Boolean)
                .map((v) => String(v).toLowerCase());
            if (declared.some((v) => v.includes('agent'))) {
                evidence.push(`project.json declares an agent project (${declared.join(', ')})`);
                return { docType: 'add', evidence };
            }
        }
        catch {
            /* ignore malformed project.json */
        }
    }
    // 3) Coded agent: python + an agent framework.
    const pyproject = path.join(workingDir, 'pyproject.toml');
    if ((0, files_1.exists)(pyproject) && AGENT_PY_MARKERS.test(readSafe(pyproject))) {
        evidence.push('pyproject.toml references an agent framework — coded agent');
        return { docType: 'add', evidence };
    }
    const uipathJson = path.join(workingDir, 'uipath.json');
    if ((0, files_1.exists)(uipathJson) && AGENT_PY_MARKERS.test(readSafe(uipathJson))) {
        evidence.push('uipath.json references an agent framework — coded agent');
        return { docType: 'add', evidence };
    }
    // Any Python source referencing an agent framework (shallow scan).
    const py = (0, files_1.walkFiles)(workingDir, { extensions: ['.py'], maxFiles: 200 });
    const agentPy = py.find((f) => AGENT_PY_MARKERS.test(readSafe(f)));
    if (agentPy) {
        evidence.push(`${path.relative(workingDir, agentPy)} imports an agent framework — coded agent`);
        return { docType: 'add', evidence };
    }
    evidence.push('No agentic markers found — treated as an RPA project (SDD).');
    return { docType: 'sdd', evidence };
}
/** Find an `agent.json` at the root or anywhere shallow in the tree. */
function findAgentJson(workingDir) {
    const root = path.join(workingDir, 'agent.json');
    if ((0, files_1.exists)(root))
        return root;
    const found = (0, files_1.walkFiles)(workingDir, { extensions: ['.json'], maxFiles: 2000 }).find((f) => path.basename(f).toLowerCase() === 'agent.json');
    return found;
}
function readSafe(file) {
    try {
        return (0, files_1.readText)(file);
    }
    catch {
        return '';
    }
}
//# sourceMappingURL=docType.js.map