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
exports.walkFiles = walkFiles;
exports.readText = readText;
exports.exists = exists;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const IGNORED_DIRS = new Set([
    'node_modules',
    '.git',
    '.vs',
    'dist',
    'out',
    '.local',
    '.settings',
    '.objects',
]);
/** Recursively list files under `root`, skipping noise directories. */
function walkFiles(root, options = {}) {
    const { extensions, maxFiles = 20000 } = options;
    const results = [];
    const stack = [root];
    while (stack.length && results.length < maxFiles) {
        const dir = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (!IGNORED_DIRS.has(entry.name))
                    stack.push(full);
            }
            else if (entry.isFile()) {
                if (!extensions || extensions.includes(path.extname(entry.name).toLowerCase())) {
                    results.push(full);
                }
            }
        }
    }
    return results;
}
function readText(file) {
    return fs.readFileSync(file, 'utf8');
}
function exists(file) {
    return fs.existsSync(file);
}
//# sourceMappingURL=files.js.map