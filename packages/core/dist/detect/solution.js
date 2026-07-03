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
exports.stripRole = stripRole;
exports.discoverProjects = discoverProjects;
exports.isSolution = isSolution;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const files_1 = require("../util/files");
const ROLE_RE = /(Dispatcher|Performer|Reporter|Process)$/i;
/** Strip a trailing role from "<ProcessName>_Dispatcher" → "<ProcessName>". */
function stripRole(name) {
    return name.replace(/[_\-\s]?(Dispatcher|Performer|Reporter|Process)$/i, '').trim();
}
/**
 * Discover the UiPath projects in a folder.
 *
 *  - If the folder itself is a project (has project.json), it is a single
 *    project → returns `[thatProject]`.
 *  - Otherwise it is treated as a SOLUTION folder: every immediate subfolder
 *    that contains a project.json is returned (e.g. Dispatcher / Performer /
 *    Reporter). Ordered Dispatcher → Performer → Reporter → rest for readability.
 *
 * Returns `[]` when nothing project-like is found.
 */
function discoverProjects(workingDir) {
    const rootPj = path.join(workingDir, 'project.json');
    if ((0, files_1.exists)(rootPj)) {
        const full = readProjectName(workingDir);
        return [{ name: displayName(workingDir), fullName: full, dir: workingDir }];
    }
    let entries;
    try {
        entries = fs.readdirSync(workingDir, { withFileTypes: true });
    }
    catch {
        return [];
    }
    const subs = [];
    for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith('.'))
            continue;
        const dir = path.join(workingDir, e.name);
        if ((0, files_1.exists)(path.join(dir, 'project.json')))
            subs.push({ name: displayName(dir), fullName: readProjectName(dir), dir });
    }
    return subs.sort(byRole);
}
/** True when the folder holds more than one project (a solution). */
function isSolution(workingDir) {
    return discoverProjects(workingDir).length > 1;
}
const ROLE_ORDER = ['dispatch', 'performer', 'perform', 'process', 'report'];
function byRole(a, b) {
    const rank = (r) => {
        const hay = `${r.name} ${path.basename(r.dir)}`.toLowerCase();
        const i = ROLE_ORDER.findIndex((k) => hay.includes(k));
        return i < 0 ? ROLE_ORDER.length : i;
    };
    const d = rank(a) - rank(b);
    return d !== 0 ? d : a.name.localeCompare(b.name);
}
/**
 * A project's display name (role) inside a solution. Prefers a clear REFramework
 * role from the folder name (e.g. "Performer") or from a "<ProcessName>_Performer"
 * project.json name; otherwise falls back to the project.json name.
 */
function displayName(dir) {
    const folder = path.basename(dir);
    if (/^(dispatcher|performer|reporter|process)$/i.test(folder))
        return cap(folder);
    const pj = readProjectName(dir);
    const m = ROLE_RE.exec(pj);
    if (m)
        return cap(m[1]);
    return pj;
}
function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
function readProjectName(dir) {
    const pj = path.join(dir, 'project.json');
    if ((0, files_1.exists)(pj)) {
        try {
            const obj = JSON.parse((0, files_1.readText)(pj));
            if (obj.name)
                return String(obj.name);
        }
        catch {
            /* ignore */
        }
    }
    return path.basename(dir);
}
//# sourceMappingURL=solution.js.map