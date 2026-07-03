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
exports.defaultTestCasesTemplatePath = exports.fillTestCasesXlsx = exports.defaultSddTemplatePath = exports.fillSddDocx = void 0;
exports.exportDeliverables = exportDeliverables;
const fs = __importStar(require("fs"));
const sddTemplate_1 = require("./sddTemplate");
const testcasesTemplate_1 = require("./testcasesTemplate");
/**
 * Fixed output contract:
 *   - SDD        -> Word (.docx)  filled from the branded Solution Design template
 *   - Test Cases -> Excel (.xlsx) filled from the UAT Test Case template
 * No other formats are produced.
 */
var sddTemplate_2 = require("./sddTemplate");
Object.defineProperty(exports, "fillSddDocx", { enumerable: true, get: function () { return sddTemplate_2.fillSddDocx; } });
Object.defineProperty(exports, "defaultSddTemplatePath", { enumerable: true, get: function () { return sddTemplate_2.defaultSddTemplatePath; } });
var testcasesTemplate_2 = require("./testcasesTemplate");
Object.defineProperty(exports, "fillTestCasesXlsx", { enumerable: true, get: function () { return testcasesTemplate_2.fillTestCasesXlsx; } });
Object.defineProperty(exports, "defaultTestCasesTemplatePath", { enumerable: true, get: function () { return testcasesTemplate_2.defaultTestCasesTemplatePath; } });
/** Write both deliverables to disk and return the paths written. */
async function exportDeliverables(model, graph, generatedOn, outDir, templates = {}) {
    fs.mkdirSync(outDir, { recursive: true });
    const safe = model.projectName.replace(/[^a-z0-9._-]+/gi, '_');
    const sddDocx = `${outDir}/${safe}-SDD.docx`;
    const testCasesXlsx = `${outDir}/${safe}-TestCases.xlsx`;
    // Write both independently so a lock on one file (e.g. open in Word) never
    // prevents the other from being produced.
    const errors = [];
    await writeSafe(sddDocx, () => (0, sddTemplate_1.fillSddDocx)(model, graph, generatedOn), errors);
    await writeSafe(testCasesXlsx, () => (0, testcasesTemplate_1.fillTestCasesXlsx)({ projectName: model.projectName, testScenarios: model.testScenarios }, templates.testCasesTemplatePath), errors);
    if (errors.length) {
        throw new Error(`InstaDocs could not write ${errors.length} file(s):\n${errors.join('\n')}\n` +
            'If a file is open (e.g. in Word/Excel), close it and try again.');
    }
    return { sddDocx, testCasesXlsx };
}
async function writeSafe(filePath, produce, errors) {
    try {
        fs.writeFileSync(filePath, await produce());
    }
    catch (err) {
        const reason = err.code === 'EBUSY' ? 'file is open/locked' : err.message;
        errors.push(`  - ${filePath}: ${reason}`);
    }
}
//# sourceMappingURL=index.js.map