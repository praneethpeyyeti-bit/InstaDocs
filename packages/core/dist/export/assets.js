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
exports.resolveAsset = resolveAsset;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Resolve a bundled template asset (pdd-template.docx / testcases-template.xlsx)
 * across the ways InstaDocs runs:
 *   - core built normally:  <core>/dist/export -> ../../assets
 *   - bundled into the VS Code extension:  <ext>/dist/assets (next to the bundle)
 *   - explicit override:  INSTADOCS_ASSETS_DIR
 * Returns the first candidate that exists (falls back to the last one).
 */
function resolveAsset(name) {
    const candidates = [
        process.env.INSTADOCS_ASSETS_DIR && path.join(process.env.INSTADOCS_ASSETS_DIR, name),
        path.join(__dirname, '..', '..', 'assets', name), // core dev layout
        path.join(__dirname, 'assets', name), // bundled next to the extension
        path.join(__dirname, '..', 'assets', name),
    ].filter((p) => Boolean(p));
    for (const c of candidates) {
        try {
            if (fs.existsSync(c))
                return c;
        }
        catch {
            /* ignore */
        }
    }
    return candidates[candidates.length - 1];
}
//# sourceMappingURL=assets.js.map