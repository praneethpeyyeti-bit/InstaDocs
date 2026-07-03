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
exports.loadProjectContext = loadProjectContext;
exports.parseProjectContext = parseProjectContext;
exports.packageToApp = packageToApp;
exports.dependenciesToApplications = dependenciesToApplications;
const path = __importStar(require("path"));
const files_1 = require("../util/files");
/**
 * Locate and parse a UiPath "Project Context" document produced by the
 * `uipath-project-discovery-agent`.
 *
 * Locations, in priority order:
 *   1. AGENTS.md — the block between <!-- PROJECT-CONTEXT:START --> and
 *      <!-- PROJECT-CONTEXT:END --> (the cross-agent convention).
 *   2. .claude/rules/project-context.md — the full file.
 *
 * Returns undefined when no discovery document is present, so the pipeline
 * cleanly falls back to InstaDocs' own project.json parse.
 */
function loadProjectContext(workingDir) {
    const found = locate(workingDir);
    if (!found)
        return undefined;
    return parseProjectContext(found.raw, found.source);
}
const START = '<!-- PROJECT-CONTEXT:START -->';
const END = '<!-- PROJECT-CONTEXT:END -->';
function locate(workingDir) {
    const agents = path.join(workingDir, 'AGENTS.md');
    if ((0, files_1.exists)(agents)) {
        const text = (0, files_1.readText)(agents);
        const s = text.indexOf(START);
        const e = text.indexOf(END);
        if (s >= 0 && e > s) {
            return { raw: text.slice(s + START.length, e).trim(), source: 'AGENTS.md' };
        }
        if (isContextDoc(text))
            return { raw: text, source: 'AGENTS.md' };
    }
    const rules = path.join(workingDir, '.claude', 'rules', 'project-context.md');
    if ((0, files_1.exists)(rules)) {
        const text = (0, files_1.readText)(rules);
        if (isContextDoc(text))
            return { raw: text, source: '.claude/rules/project-context.md' };
    }
    return undefined;
}
/** A discovery doc is identified by its metadata comment or the title suffix. */
function isContextDoc(text) {
    return /<!--\s*discovery-metadata:/.test(text) || /—\s*Project Context/.test(text);
}
function parseProjectContext(raw, source) {
    const sections = splitSections(raw);
    return {
        raw,
        source,
        overview: parseOverview(sections['Overview']),
        dependencies: parseDependencies(sections['Dependencies']),
        entryPoints: parseEntryPoints(sections['Entry Points']),
        keyWorkflows: parseKeyWorkflows(sections['Key Workflows']),
        conventions: parseBullets(sections['Conventions']),
        architecture: sections['Architecture']?.trim() || undefined,
    };
}
/** Split markdown into a map of `## Heading` -> body text. */
function splitSections(md) {
    const out = {};
    const re = /^##\s+(.+?)\s*$/gm;
    const matches = [...md.matchAll(re)];
    for (let i = 0; i < matches.length; i++) {
        const title = matches[i][1].trim();
        const start = matches[i].index + matches[i][0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
        out[title] = md.slice(start, end).trim();
    }
    return out;
}
/** Parse a GitHub-flavored markdown table into rows of trimmed cells. */
function parseTable(body) {
    if (!body)
        return [];
    const lines = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('|'));
    const rows = [];
    for (const line of lines) {
        if (/^\|[\s:|-]+\|?$/.test(line))
            continue; // separator row
        const cells = line.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        rows.push(cells);
    }
    // Drop the header row if present.
    if (rows.length && /package|file|workflow|name|item/i.test(rows[0].join(' ')))
        rows.shift();
    return rows;
}
function parseOverview(body) {
    const rows = parseTable(body);
    if (!rows.length)
        return undefined;
    const ov = {};
    // Overview is often a 2-col key/value table, or a single wide row.
    for (const r of rows) {
        if (r.length >= 2)
            assignOverview(ov, r[0], r[1]);
    }
    return Object.keys(ov).length ? ov : undefined;
}
function assignOverview(ov, key, value) {
    const k = key.toLowerCase();
    if (/name/.test(k))
        ov.name = value;
    else if (/type/.test(k))
        ov.type = value;
    else if (/description/.test(k))
        ov.description = value;
    else if (/framework/.test(k))
        ov.targetFramework = value;
    else if (/expression|language/.test(k))
        ov.expressionLanguage = value;
}
function parseDependencies(body) {
    return parseTable(body).map((r) => ({
        package: r[0] ?? '',
        version: r[1],
        category: r[2],
        description: r[3],
    })).filter((d) => d.package);
}
function parseEntryPoints(body) {
    return parseTable(body).map((r) => ({
        file: r[0] ?? '',
        inputs: r[1],
        outputs: r[2],
        purpose: r[3],
    })).filter((e) => e.file);
}
function parseKeyWorkflows(body) {
    return parseTable(body).map((r) => ({
        workflow: r[0] ?? '',
        purpose: r[1],
        uses: r[2],
    })).filter((w) => w.workflow);
}
/**
 * Map UiPath dependency packages to the business applications/systems they
 * imply, for the PDD "Applications Used" section. Shared by the deterministic
 * fallback and the template fill.
 */
/** Map a single dependency package to the application/system it implies. */
function packageToApp(pkg) {
    const p = pkg.toLowerCase();
    if (/\.excel\./.test(p))
        return 'MS Excel';
    if (/\.mail\.|\.outlook/.test(p))
        return 'Email (Outlook/SMTP)';
    if (/\.word\./.test(p))
        return 'MS Word';
    if (/\.database\.|\.sql/.test(p))
        return 'Database';
    if (/\.web(api)?\.|\.http/.test(p))
        return 'HTTP/REST API';
    if (/\.ui\.?automation|\.uiautomation/.test(p))
        return 'Desktop/Web UI';
    if (/\.pdf\./.test(p))
        return 'PDF documents';
    if (/\.ftp/.test(p))
        return 'FTP';
    if (/\.salesforce/.test(p))
        return 'Salesforce';
    if (/\.sap/.test(p))
        return 'SAP';
    return undefined;
}
function dependenciesToApplications(deps) {
    const apps = new Set();
    for (const d of deps) {
        const app = packageToApp(d.package);
        if (app)
            apps.add(app);
    }
    return [...apps];
}
function parseBullets(body) {
    if (!body)
        return [];
    return body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^[-*]\s+/.test(l))
        .map((l) => l.replace(/^[-*]\s+/, '').trim())
        .filter(Boolean);
}
//# sourceMappingURL=projectContext.js.map