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
exports.parseAutomationAnywhere = parseAutomationAnywhere;
const path = __importStar(require("path"));
const ir_1 = require("../model/ir");
const files_1 = require("../util/files");
/**
 * Automation Anywhere parser (initial depth).
 *
 * A11 bots (.json in A360) contain a `nodes`/`commands` list where each command
 * has a `commandName`/`packagePkg`. We map commands -> nodes sequentially.
 * Legacy .atmx (XML) is detected but not yet parsed in depth.
 */
async function parseAutomationAnywhere(workingDir) {
    const files = (0, files_1.walkFiles)(workingDir, { extensions: ['.json', '.atmx'] });
    const graph = (0, ir_1.emptyGraph)('automationAnywhere', path.basename(workingDir));
    for (const file of files) {
        if (file.toLowerCase().endsWith('.atmx')) {
            graph.warnings.push(`Legacy .atmx not yet parsed in depth: ${path.relative(workingDir, file)}`);
            continue;
        }
        let bot;
        try {
            bot = JSON.parse((0, files_1.readText)(file));
        }
        catch {
            continue;
        }
        const commands = bot.nodes ?? bot.commands ?? [];
        if (!Array.isArray(commands) || !commands.length)
            continue;
        graph.entryPoints.push(path.relative(workingDir, file));
        let prev;
        for (const cmd of commands) {
            const name = cmd.commandName || cmd.name || cmd.packagePkg || 'command';
            const n = node(name, classify(name));
            graph.nodes.push(n);
            if (prev)
                graph.edges.push({ from: prev, to: n.id, kind: 'seq' });
            prev = n.id;
        }
        for (const v of bot.botVariables ?? bot.variables ?? []) {
            if (v?.name)
                graph.variables.push({ name: v.name, type: v.type });
        }
    }
    if (!graph.nodes.length)
        graph.warnings.push('No Automation Anywhere commands found.');
    return graph;
}
let counter = 0;
function node(name, kind) {
    return { id: `aa_${++counter}`, kind, displayName: name, raw: {} };
}
function classify(name) {
    if (/if|decision|else/i.test(name))
        return 'if';
    if (/loop|each|while/i.test(name))
        return 'loop';
    if (/excel|database|csv|file|email|api|rest/i.test(name))
        return 'io';
    if (/click|type|window|recorder|object/i.test(name))
        return 'ui';
    if (/variable|assign|number|string/i.test(name))
        return 'assign';
    if (/runTask|runBot/i.test(name))
        return 'invoke';
    return 'other';
}
//# sourceMappingURL=automationAnywhere.js.map