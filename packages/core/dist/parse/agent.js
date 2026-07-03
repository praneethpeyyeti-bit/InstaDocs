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
exports.parseAgent = parseAgent;
const path = __importStar(require("path"));
const agent_1 = require("../model/agent");
const files_1 = require("../util/files");
const docType_1 = require("../detect/docType");
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
function parseAgent(workingDir) {
    const agentJson = (0, docType_1.findAgentJson)(workingDir);
    if (agentJson) {
        try {
            return parseAgentJson(agentJson, workingDir);
        }
        catch {
            /* fall through to coded detection */
        }
    }
    return parseCodedAgent(workingDir);
}
// ---------------------------------------------------------------------------
// Low-code agent.json
// ---------------------------------------------------------------------------
function parseAgentJson(file, workingDir) {
    const obj = JSON.parse((0, files_1.readText)(file));
    const rel = path.relative(workingDir, file);
    const name = str(pick(obj, 'name', 'displayName', 'agentName', 'id')) || path.basename(path.dirname(file));
    const spec = (0, agent_1.emptyAgentSpec)(name, rel, 'lowCode');
    spec.runtime = 'agentBuilder';
    spec.description = str(pick(obj, 'description', 'summary', 'purpose'));
    // Prompts: systemPrompt / prompt.system / messages[role=system], etc.
    const { system, user } = extractPrompts(obj);
    spec.systemPrompt = system;
    spec.userPrompt = user;
    spec.model = extractModel(obj);
    spec.tools = extractTools(obj);
    spec.inputs = extractArgs(obj, 'in');
    spec.outputs = extractArgs(obj, 'out');
    spec.escalations = extractEscalations(obj);
    spec.knowledge = extractKnowledge(obj);
    spec.guardrails = extractGuardrails(obj);
    spec.raw = obj;
    return spec;
}
function extractPrompts(obj) {
    let system = str(pick(obj, 'systemPrompt', 'system_prompt', 'instructions'));
    let user = str(pick(obj, 'userPrompt', 'user_prompt'));
    const promptObj = pick(obj, 'prompt', 'prompts');
    if (promptObj && typeof promptObj === 'object') {
        system ||= str(pick(promptObj, 'system', 'systemPrompt'));
        user ||= str(pick(promptObj, 'user', 'userPrompt', 'template', 'text'));
    }
    else if (typeof promptObj === 'string') {
        user ||= promptObj;
    }
    const messages = arr(pick(obj, 'messages'));
    for (const m of messages) {
        const role = str(pick(m, 'role'));
        const content = str(pick(m, 'content', 'text'));
        if (!content)
            continue;
        if (/system/i.test(role))
            system ||= content;
        else if (/user|human/i.test(role))
            user ||= content;
    }
    return { system: system || undefined, user: user || undefined };
}
function extractModel(obj) {
    const s = pick(obj, 'settings', 'modelSettings', 'llmSettings', 'model', 'llm') ?? obj;
    const name = str(pick(s, 'model', 'modelName', 'name', 'deployment', 'deploymentName')) || str(pick(obj, 'model', 'modelName'));
    const provider = str(pick(s, 'provider', 'modelProvider', 'vendor'));
    const temperature = numStr(pick(s, 'temperature'));
    const maxTokens = numStr(pick(s, 'maxTokens', 'max_tokens', 'maxOutputTokens'));
    if (!name && !provider && !temperature && !maxTokens)
        return undefined;
    const settings = {};
    for (const k of ['topP', 'top_p', 'frequencyPenalty', 'presencePenalty', 'seed']) {
        const v = pick(s, k);
        if (v !== undefined)
            settings[k] = numStr(v) || str(v);
    }
    return {
        name: name || undefined,
        provider: provider || inferProvider(name),
        temperature,
        maxTokens,
        settings: Object.keys(settings).length ? settings : undefined,
    };
}
function inferProvider(model) {
    if (!model)
        return undefined;
    const m = model.toLowerCase();
    if (/gpt|o1|o3|davinci|text-embedding/.test(m))
        return /azure/.test(m) ? 'Azure OpenAI' : 'OpenAI';
    if (/claude|anthropic/.test(m))
        return 'Anthropic';
    if (/gemini|palm/.test(m))
        return 'Google';
    if (/llama|mistral|mixtral/.test(m))
        return 'Open source';
    return undefined;
}
function extractTools(obj) {
    const raw = [...arr(pick(obj, 'tools')), ...arr(pick(obj, 'resources')), ...arr(pick(obj, 'actions')), ...arr(pick(obj, 'toolset'))];
    const out = [];
    for (const t of raw) {
        if (typeof t === 'string') {
            out.push({ name: t });
            continue;
        }
        const name = str(pick(t, 'name', 'displayName', 'toolName', 'id'));
        if (!name)
            continue;
        out.push({
            name,
            type: str(pick(t, 'type', 'toolType', 'kind', 'category')) || undefined,
            description: str(pick(t, 'description', 'summary')) || undefined,
        });
    }
    return dedupeByName(out);
}
function extractArgs(obj, dir) {
    const listKeys = dir === 'in'
        ? ['inputArguments', 'inputs', 'input', 'arguments']
        : ['outputArguments', 'outputs', 'output'];
    const schemaKeys = dir === 'in' ? ['inputSchema', 'input_schema'] : ['outputSchema', 'output_schema'];
    const list = listKeys.map((k) => pick(obj, k)).find((v) => v !== undefined);
    const args = [];
    for (const a of arr(list)) {
        if (typeof a === 'string') {
            args.push({ name: a });
            continue;
        }
        const name = str(pick(a, 'name', 'key', 'field'));
        if (!name)
            continue;
        args.push({
            name,
            type: str(pick(a, 'type', 'dataType')) || undefined,
            description: str(pick(a, 'description', 'summary')) || undefined,
            required: bool(pick(a, 'required', 'isRequired')),
        });
    }
    // JSON-schema form: { properties: { field: { type, description } }, required: [] }
    if (!args.length) {
        const schema = schemaKeys.map((k) => pick(obj, k)).find((v) => v !== undefined);
        const props = pick(schema, 'properties');
        const required = new Set(arr(pick(schema, 'required')).map((x) => str(x)));
        if (props && typeof props === 'object') {
            for (const [name, def] of Object.entries(props)) {
                args.push({
                    name,
                    type: str(pick(def, 'type')) || undefined,
                    description: str(pick(def, 'description')) || undefined,
                    required: required.has(name) || undefined,
                });
            }
        }
    }
    return args;
}
function extractEscalations(obj) {
    const raw = [...arr(pick(obj, 'escalations', 'escalation')), ...arr(pick(pick(obj, 'features', 'humanInTheLoop', 'hitl'), 'escalations'))];
    const out = [];
    for (const e of raw) {
        if (typeof e === 'string') {
            out.push({ name: e });
            continue;
        }
        const name = str(pick(e, 'name', 'displayName', 'type', 'id'));
        if (!name)
            continue;
        out.push({
            name,
            description: str(pick(e, 'description', 'summary')) || undefined,
            target: str(pick(e, 'target', 'app', 'appName', 'actionApp')) || undefined,
        });
    }
    // Tools of type "escalation" also count.
    for (const t of extractTools(obj)) {
        if (/escalat|human|approval/i.test(`${t.type} ${t.name}`)) {
            out.push({ name: t.name, description: t.description });
        }
    }
    return dedupeByName(out);
}
function extractKnowledge(obj) {
    const raw = [
        ...arr(pick(obj, 'knowledge', 'knowledgeSources', 'contextGrounding', 'context', 'indexes', 'memory')),
        ...arr(pick(pick(obj, 'context'), 'sources')),
    ];
    const out = [];
    for (const k of raw) {
        if (typeof k === 'string') {
            out.push({ name: k });
            continue;
        }
        const name = str(pick(k, 'name', 'displayName', 'index', 'indexName', 'id'));
        if (!name)
            continue;
        out.push({
            name,
            type: str(pick(k, 'type', 'kind')) || undefined,
            description: str(pick(k, 'description', 'summary')) || undefined,
        });
    }
    return dedupeByName(out);
}
function extractGuardrails(obj) {
    const g = pick(obj, 'guardrails', 'trustLayer', 'trust', 'safety', 'policies');
    const out = [];
    for (const item of arr(g)) {
        if (typeof item === 'string')
            out.push(item);
        else {
            const name = str(pick(item, 'name', 'type', 'policy'));
            const desc = str(pick(item, 'description', 'value'));
            if (name || desc)
                out.push([name, desc].filter(Boolean).join(': '));
        }
    }
    if (g && !Array.isArray(g) && typeof g === 'object') {
        for (const [k, v] of Object.entries(g)) {
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')
                out.push(`${k}: ${v}`);
        }
    }
    return [...new Set(out)];
}
// ---------------------------------------------------------------------------
// Coded agent (Python)
// ---------------------------------------------------------------------------
/** Frameworks that mark a coded agentic project (kept in sync with detectDocType). */
const AGENT_PY_MARKERS = /uipath-langchain|uipath_langchain|langgraph|llama-?index|llama_index|openai-agents|openai_agents|crewai|autogen|\buipath\.agent\b/i;
function parseCodedAgent(workingDir) {
    const py = (0, files_1.walkFiles)(workingDir, { extensions: ['.py'], maxFiles: 400 });
    if (!py.length)
        return undefined;
    const blob = py.map((f) => safe(f)).join('\n');
    const config = [path.join(workingDir, 'pyproject.toml'), path.join(workingDir, 'uipath.json')]
        .filter(files_1.exists)
        .map(safe)
        .join('\n');
    // Only treat this as an agent when an agent framework is actually referenced,
    // so a stray .py in an RPA repo does not get mistaken for an agent.
    if (!AGENT_PY_MARKERS.test(blob) && !AGENT_PY_MARKERS.test(config))
        return undefined;
    const name = readCodedName(workingDir);
    const spec = (0, agent_1.emptyAgentSpec)(name, path.relative(workingDir, py[0]) || 'agent', 'coded');
    spec.runtime = detectRuntime(blob + '\n' + config);
    // System prompt: common assignment patterns.
    spec.systemPrompt =
        matchOne(blob, /system_prompt\s*=\s*(?:f?["']{3}([\s\S]*?)["']{3}|f?["']([^"']{20,})["'])/i) ||
            matchOne(blob, /SystemMessage\(\s*(?:content\s*=\s*)?f?["']([\s\S]*?)["']\)/i) ||
            matchOne(blob, /(?:instructions|prompt)\s*=\s*f?["']{3}([\s\S]*?)["']{3}/i) || undefined;
    // Model references.
    const model = matchOne(blob, /(?:model|model_name|deployment_name)\s*=\s*["']([\w.\-:/]+)["']/i);
    if (model)
        spec.model = { name: model, provider: inferProvider(model) };
    // Tools: @tool decorators + tool names in a tools=[...] list.
    const tools = new Set();
    for (const m of blob.matchAll(/@tool[^\n]*\n\s*def\s+(\w+)/g))
        tools.add(m[1]);
    for (const m of blob.matchAll(/def\s+(\w+)\s*\([^)]*\)\s*->/g))
        if (/tool|action/i.test(m[1]))
            tools.add(m[1]);
    spec.tools = [...tools].map((t) => ({ name: t, type: 'tool' }));
    // Escalations: interrupt() / create_action / hitl markers.
    if (/\binterrupt\s*\(|create_action|escalat|human_in_the_loop|HumanApproval/i.test(blob)) {
        spec.escalations = [{ name: 'Human-in-the-loop interrupt', description: 'Coded escalation (interrupt / Action Center) detected in source.' }];
    }
    // Knowledge / retrieval.
    if (/context_grounding|retriever|VectorStore|embedding|rag\b/i.test(blob)) {
        spec.knowledge = [{ name: 'Context grounding / retrieval', type: 'contextGrounding' }];
    }
    spec.raw = { entryPoints: readCodedEntryPoints(workingDir), files: py.map((f) => path.relative(workingDir, f)).slice(0, 40) };
    return spec;
}
function detectRuntime(blob) {
    if (/langgraph/i.test(blob))
        return 'langgraph';
    if (/llama[_-]?index/i.test(blob))
        return 'llamaindex';
    if (/openai[_-]?agents/i.test(blob))
        return 'openai-agents';
    if (/uipath[_-]?langchain|from uipath/i.test(blob))
        return 'uipath';
    return undefined;
}
function readCodedName(workingDir) {
    const pyproject = path.join(workingDir, 'pyproject.toml');
    if ((0, files_1.exists)(pyproject)) {
        const n = matchOne(safe(pyproject), /name\s*=\s*["']([^"']+)["']/);
        if (n)
            return n;
    }
    return path.basename(workingDir);
}
function readCodedEntryPoints(workingDir) {
    const uipathJson = path.join(workingDir, 'uipath.json');
    if (!(0, files_1.exists)(uipathJson))
        return [];
    try {
        const obj = JSON.parse((0, files_1.readText)(uipathJson));
        return arr(pick(obj, 'entryPoints')).map((e) => str(pick(e, 'filePath', 'path', 'name'))).filter(Boolean);
    }
    catch {
        return [];
    }
}
// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function pick(obj, ...keys) {
    if (!obj || typeof obj !== 'object')
        return undefined;
    for (const k of keys)
        if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '')
            return obj[k];
    return undefined;
}
function arr(v) {
    if (v === undefined || v === null)
        return [];
    return Array.isArray(v) ? v : [v];
}
function str(v) {
    if (v === undefined || v === null)
        return '';
    return typeof v === 'string' ? v.trim() : typeof v === 'object' ? '' : String(v);
}
function numStr(v) {
    if (v === undefined || v === null || v === '')
        return undefined;
    return typeof v === 'number' ? String(v) : /^-?\d+(\.\d+)?$/.test(String(v)) ? String(v) : undefined;
}
function bool(v) {
    if (v === undefined || v === null)
        return undefined;
    return Boolean(v);
}
function dedupeByName(items) {
    const seen = new Set();
    return items.filter((i) => {
        const k = i.name.toLowerCase();
        if (seen.has(k))
            return false;
        seen.add(k);
        return true;
    });
}
function matchOne(s, re) {
    const m = re.exec(s);
    if (!m)
        return undefined;
    return (m[1] ?? m[2] ?? '').trim() || undefined;
}
function safe(file) {
    try {
        return (0, files_1.readText)(file);
    }
    catch {
        return '';
    }
}
//# sourceMappingURL=agent.js.map