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
exports.openRepo = openRepo;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const simple_git_1 = require("simple-git");
function looksLikeGitUrl(loc) {
    return (/^https?:\/\//i.test(loc) ||
        /^git@/i.test(loc) ||
        /^ssh:\/\//i.test(loc) ||
        loc.endsWith('.git'));
}
/**
 * Resolve a RepoSource to a local working directory. Clones git URLs into a
 * temp dir; opens local folders in place.
 */
async function openRepo(source) {
    const { location, branch, subPath } = source;
    if (looksLikeGitUrl(location)) {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'instadocs-'));
        const git = (0, simple_git_1.simpleGit)();
        const opts = ['--depth', '1'];
        if (branch)
            opts.push('--branch', branch);
        await git.clone(location, tmp, opts);
        const workingDir = subPath ? path.join(tmp, subPath) : tmp;
        return {
            workingDir,
            cloned: true,
            cleanup: () => rmrf(tmp),
        };
    }
    // Local folder.
    const abs = path.resolve(location);
    if (!fs.existsSync(abs)) {
        throw new Error(`Path does not exist: ${abs}`);
    }
    const workingDir = subPath ? path.join(abs, subPath) : abs;
    return { workingDir, cloned: false, cleanup: () => { } };
}
function rmrf(target) {
    try {
        fs.rmSync(target, { recursive: true, force: true });
    }
    catch {
        /* best-effort cleanup */
    }
}
//# sourceMappingURL=index.js.map