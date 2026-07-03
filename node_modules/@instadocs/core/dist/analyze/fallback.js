"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deterministicEnrich = deterministicEnrich;
const ir_1 = require("../model/ir");
const projectContext_1 = require("../context/projectContext");
/**
 * Deterministic enrichment — no LLM.
 *
 * Produces a structurally-complete (if robotic) EnrichedModel straight from the
 * ProcessGraph. Used when no Gateway is configured or when the LLM output fails
 * validation, guaranteeing the pipeline always yields a document.
 */
function deterministicEnrich(graph) {
    const applications = deriveApplications(graph);
    const steps = deriveSteps(graph);
    const businessRules = deriveRules(graph);
    const exceptions = deriveExceptions(graph);
    return {
        projectName: graph.projectName,
        platformLabel: ir_1.PLATFORM_LABELS[graph.platform],
        summary: `Automated process "${graph.projectName}" built on ${ir_1.PLATFORM_LABELS[graph.platform]}, ` +
            `comprising ${graph.nodes.length} workflow activities across ${graph.entryPoints.length || 1} entry point(s).`,
        businessObjective: 'Objective inferred from workflow structure. Configure the UiPath LLM Gateway for a business-level narrative.',
        applications,
        steps,
        businessRules,
        inputs: graph.arguments
            .filter((a) => a.direction !== 'out')
            .map((a) => ({ name: a.name, description: `Input argument (${a.type ?? 'unknown type'})`, type: a.type })),
        outputs: graph.arguments
            .filter((a) => a.direction !== 'in')
            .map((a) => ({ name: a.name, description: `Output argument (${a.type ?? 'unknown type'})`, type: a.type })),
        exceptions,
        assumptions: ['Generated from source without an LLM pass; review for business accuracy.'],
        inScope: graph.entryPoints.map((e) => `Workflow: ${e}`),
        outOfScope: [],
        testScenarios: deriveTests(graph, businessRules.length, exceptions.length),
    };
}
function deriveApplications(graph) {
    const apps = new Set();
    // Authoritative: applications implied by project dependencies (if discovered).
    if (graph.projectContext) {
        for (const a of (0, projectContext_1.dependenciesToApplications)(graph.projectContext.dependencies))
            apps.add(a);
    }
    // Inferred: applications hinted by activity names.
    for (const n of graph.nodes) {
        if (n.kind === 'io' || n.kind === 'ui') {
            const app = /Excel|Outlook|Mail|Browser|SAP|Database|Http|Api|Queue|File|CSV/i.exec(n.displayName);
            if (app)
                apps.add(normalizeApp(app[0]));
        }
    }
    return [...apps];
}
function normalizeApp(token) {
    const map = {
        mail: 'Email',
        http: 'HTTP/REST API',
        api: 'HTTP/REST API',
        csv: 'CSV files',
        file: 'File system',
    };
    return map[token.toLowerCase()] ?? token;
}
function deriveSteps(graph) {
    const meaningful = graph.nodes.filter((n) => ['assign', 'if', 'switch', 'loop', 'invoke', 'io', 'ui', 'throw'].includes(n.kind));
    const source = (meaningful.length ? meaningful : graph.nodes)
        // A business PDD describes the business process, not the automation framework:
        // drop REFramework scaffolding and generic, unnamed technical activities.
        .filter((n) => !isFrameworkNoise(n));
    return source.slice(0, 40).map((n, i) => ({
        order: i + 1,
        title: n.displayName,
        description: describe(n),
        systems: [],
    }));
}
/**
 * True for activities that are automation plumbing rather than business steps —
 * REFramework state-machine scaffolding, technical housekeeping, and generic
 * un-named activities that carry no business meaning. Keeps the keystroke
 * section readable for business reviewers.
 */
function isFrameworkNoise(n) {
    const name = (n.displayName || '').trim();
    const lower = name.toLowerCase();
    // REFramework / technical scaffolding by name.
    const NOISE = [
        /init.*all.*(setting|application)/i, // Init/InitiAllApplications, InitAllSettings
        /close\s*all\s*applications/i,
        /kill\s*all\s*process/i,
        /get\s*transaction\s*(data|item)/i,
        /set\s*transaction\s*status/i,
        /out_transaction/i,
        /transaction\s*(number|id|field)/i,
        /increment\s*transaction/i,
        /retry\s*current\s*transaction/i,
        /should\s*stop/i,
        /take\s*screenshot/i,
        /consecutive\s*(system\s*)?exception/i,
        /\b(system|business)\s*exception\b/i, // Assign SystemException / BusinessException plumbing
        /orchestrator\s*queue/i,
        /queue\s*(name|folder)/i,
        /out_config|read\s*config|config.*initializ/i,
        /first\s*run/i,
        /backward\s*compat/i,
        /\brethrow\b/i,
    ];
    if (NOISE.some((re) => re.test(name)))
        return true;
    // Generic, un-named technical activities (no business label added by the dev):
    // a bare "Assign", "If", "HTTP Request", "For each currentX", the "Main" wrapper.
    const GENERIC = new Set([
        'assign', 'http request', 'httprequest', 'rethrow', 'sequence',
        'if', 'switch', 'flow decision', 'flowchart', 'main',
    ]);
    if (GENERIC.has(lower))
        return true;
    if (/^(for each|check whether)\s+current[a-z]*$/i.test(lower))
        return true;
    if (/^(for each|check whether)$/i.test(lower))
        return true;
    return false;
}
function describe(n) {
    const name = n.displayName || '';
    const note = n.annotations ? ` Note: ${cleanNote(n.annotations)}` : '';
    switch (n.kind) {
        case 'if':
        case 'switch': {
            const plain = plainCondition(n.raw?.condition);
            return (plain ? `Decision: ${plain}` : 'Decision point — the process follows the appropriate path.') + note;
        }
        case 'loop':
            return 'Repeats the following actions for each item in turn.' + note;
        case 'invoke':
            return `Runs the "${businessName(name)}" step.` + note;
        case 'io':
            return `${apiPurpose(name)}.` + note;
        case 'ui':
            return 'Performs the action in the application screen.' + note;
        case 'throw':
            return 'Flags an exception so the item is handled as an error.' + note;
        case 'assign':
            return 'Prepares information used by the following steps.' + note;
        default:
            return 'Business activity.' + note;
    }
}
/** Strip technical wrappers from an activity name to a business-readable phrase. */
function businessName(name) {
    return name
        .replace(/^invoke\s+/i, '')
        .replace(/\s+workflow$/i, '')
        .replace(/\.xaml$/i, '')
        .replace(/\s*\([^)]*\)\s*$/i, '')
        .trim() || 'sub-process';
}
/** Business purpose for an IO/HTTP step, using any label after "--" or "-". */
function apiPurpose(name) {
    const m = /(?:--|-)\s*(.+)$/.exec(name);
    const detail = m?.[1]?.trim();
    if (detail)
        return `Exchanges data with the connected system to ${detail.toLowerCase()}`;
    return 'Exchanges data with the connected system';
}
/** Tidy a developer annotation for a business reader (single line, trimmed). */
function cleanNote(text) {
    return text.replace(/\s+/g, ' ').replace(/&#xA;|&#10;/g, ' ').trim().slice(0, 240);
}
/**
 * Translate a raw workflow condition into plain English, or return undefined
 * when it is too technical to be worth showing (raw VB.NET is never shown).
 */
function plainCondition(raw) {
    if (!raw)
        return undefined;
    let s = String(raw).trim().replace(/^\[|\]$/g, '').trim();
    if (!s)
        return undefined;
    // Exact, well-known REFramework check → plain English (whole condition only,
    // so it never misfires on a larger expression that merely contains it).
    if (/^config\s+is\s+nothing$/i.test(s))
        return 'if this is the first run of the process';
    // Reject expressions dominated by code (function calls, casts, dictionaries).
    if (/Cint|Convert\.|Config\(|\.ToString|\.Contains|IsNot Nothing|OrElse|\bCbool\b/i.test(s)) {
        return undefined;
    }
    s = s
        .replace(/String\.IsNullOrWhiteSpace\(([^)]+)\)/gi, '$1 is blank')
        .replace(/\bIs Nothing\b/gi, 'is empty')
        .replace(/\bIsNot Nothing\b/gi, 'is available')
        .replace(/\bAndAlso\b|\bAnd\b/gi, 'and')
        .replace(/\bOrElse\b|\bOr\b/gi, 'or')
        .replace(/\bNot\b/gi, 'not')
        .replace(/>=/g, 'is at least')
        .replace(/<=/g, 'is at most')
        .replace(/=/g, 'equals')
        .replace(/\s+/g, ' ')
        .trim();
    // If it still looks like code, skip it rather than confuse the reader.
    if (/[{}\\;]|\.[A-Za-z]+\(/.test(s) || s.length > 120)
        return undefined;
    return `if ${s}`;
}
function deriveRules(graph) {
    const rules = [];
    let i = 1;
    for (const n of graph.nodes) {
        if ((n.kind === 'if' || n.kind === 'switch') && n.raw?.condition) {
            rules.push({
                id: `BR-${String(i++).padStart(2, '0')}`,
                description: `When "${String(n.raw.condition)}", the process branches at "${n.displayName}".`,
                appliesTo: n.displayName,
            });
        }
    }
    return rules;
}
function deriveExceptions(graph) {
    const exceptions = [];
    for (const t of graph.tryCatches) {
        exceptions.push({
            name: t.exceptionType ?? 'Handled exception',
            category: 'system',
            trigger: t.handlerSummary ?? 'A step inside a try/catch failed.',
            handling: 'Caught and handled by the workflow.',
        });
    }
    for (const n of graph.nodes.filter((x) => x.kind === 'throw')) {
        exceptions.push({
            name: n.displayName,
            category: 'business',
            trigger: 'Business-rule violation raised explicitly by the workflow.',
            handling: 'Process throws to signal the violation.',
        });
    }
    return exceptions;
}
function deriveTests(graph, ruleCount, exceptionCount) {
    const tests = [
        {
            id: 'TC-01',
            title: 'Happy path — process completes successfully',
            type: 'positive',
            preconditions: 'Valid inputs supplied; all systems available.',
            steps: ['Provide valid inputs', 'Run the process end to end'],
            testData: 'Representative valid input set',
            expectedResult: 'Process completes and produces expected outputs.',
            tracesTo: graph.entryPoints[0] ?? 'Main',
        },
    ];
    let n = 2;
    const branches = graph.nodes.filter((x) => x.kind === 'if' || x.kind === 'switch');
    for (const b of branches.slice(0, 8)) {
        tests.push({
            id: `TC-${String(n++).padStart(2, '0')}`,
            title: `Branch coverage — ${b.displayName}`,
            type: 'negative',
            preconditions: 'Inputs that exercise the alternate branch.',
            steps: [`Drive the condition at "${b.displayName}" to its non-default outcome`],
            testData: b.raw?.condition ? `Condition: ${String(b.raw.condition)}` : 'Alternate-branch data',
            expectedResult: 'Alternate branch executes as designed.',
            tracesTo: b.displayName,
        });
    }
    if (exceptionCount) {
        tests.push({
            id: `TC-${String(n++).padStart(2, '0')}`,
            title: 'Exception handling — failure is caught',
            type: 'exception',
            preconditions: 'Force a failure inside a handled step.',
            steps: ['Trigger a system/business error within a try/catch scope'],
            testData: 'Invalid input or unavailable system',
            expectedResult: 'Exception is caught and handled per design; no unhandled crash.',
            tracesTo: 'Exception handlers',
        });
    }
    void ruleCount;
    return tests;
}
//# sourceMappingURL=fallback.js.map