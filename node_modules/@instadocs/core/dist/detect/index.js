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
exports.detectPlatform = detectPlatform;
const path = __importStar(require("path"));
const files_1 = require("../util/files");
/**
 * Signature-based platform detection. Fast and deterministic: score each
 * platform by the presence of characteristic files/markers, pick the winner.
 */
function detectPlatform(workingDir) {
    const files = (0, files_1.walkFiles)(workingDir, { maxFiles: 5000 });
    const byExt = (ext) => files.filter((f) => f.toLowerCase().endsWith(ext));
    const evidence = [];
    const scores = {
        uipath: 0,
        powerAutomate: 0,
        blueprism: 0,
        automationAnywhere: 0,
        unknown: 0,
    };
    // ---- UiPath ----
    const projectJson = path.join(workingDir, 'project.json');
    if ((0, files_1.exists)(projectJson) && safeIncludes(projectJson, '"main"')) {
        scores.uipath += 5;
        evidence.push('project.json with "main" entry (UiPath)');
    }
    const xaml = byExt('.xaml');
    if (xaml.length) {
        scores.uipath += 3 + Math.min(xaml.length, 5);
        evidence.push(`${xaml.length} .xaml workflow file(s) (UiPath)`);
    }
    // ---- Power Automate ----
    const paFlows = files.filter((f) => /definition\.json$/i.test(f) &&
        safeIncludes(f, '"actions"') &&
        (safeIncludes(f, '"$connections"') || safeIncludes(f, '"triggers"')));
    if (paFlows.length) {
        scores.powerAutomate += 6;
        evidence.push(`${paFlows.length} Power Automate flow definition(s)`);
    }
    // ---- Blue Prism ----
    const bp = byExt('.bprelease');
    if (bp.length) {
        scores.blueprism += 6;
        evidence.push(`${bp.length} .bprelease file(s) (Blue Prism)`);
    }
    const bpXml = byExt('.xml').filter((f) => safeIncludes(f, '<process ') || safeIncludes(f, '<object '));
    if (bpXml.length) {
        scores.blueprism += 3;
        evidence.push(`${bpXml.length} Blue Prism process/object XML file(s)`);
    }
    // ---- Automation Anywhere ----
    const atmx = byExt('.atmx');
    if (atmx.length) {
        scores.automationAnywhere += 6;
        evidence.push(`${atmx.length} .atmx file(s) (Automation Anywhere)`);
    }
    const aaBots = byExt('.json').filter((f) => safeIncludes(f, '"commandType"') || safeIncludes(f, '"botVariables"'));
    if (aaBots.length) {
        scores.automationAnywhere += 4;
        evidence.push(`${aaBots.length} Automation Anywhere bot JSON file(s)`);
    }
    const ranked = Object.entries(scores)
        .filter(([p]) => p !== 'unknown')
        .sort((a, b) => b[1] - a[1]);
    const [topPlatform, topScore] = ranked[0];
    const total = ranked.reduce((s, [, v]) => s + v, 0);
    if (topScore === 0) {
        return { platform: 'unknown', confidence: 0, scores, evidence };
    }
    return {
        platform: topPlatform,
        confidence: total ? topScore / total : 0,
        scores,
        evidence,
    };
}
/** Read a file and test for a substring, tolerating read errors. */
function safeIncludes(file, needle) {
    try {
        return (0, files_1.readText)(file).includes(needle);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=index.js.map