"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultTestCasesTemplatePath = defaultTestCasesTemplatePath;
exports.fillTestCasesXlsx = fillTestCasesXlsx;
const exceljs_1 = __importDefault(require("exceljs"));
const assets_1 = require("./assets");
/**
 * Fill the UAT Test Case xlsx template (exceljs) from the SDD model.testScenarios and
 * return an .xlsx buffer.
 *
 * Template layout (sheet "UAT Test Cases"):
 *   B1 = Process Name (header block)
 *   Row 7 = column headers
 *   Rows 8..9 = grey example rows  → replaced with real test cases
 *
 * Columns: A #/Case No · B Requirement · C Additional Testing Details ·
 * D Case ID · E Type · F Status · G Fail Severity · H Expected Result ·
 * I Actual · J Defect · K Fail Reason · L Screenshots · M..R sign-off.
 */
const HEADER_ROW = 7;
const FIRST_DATA_ROW = 8;
const TEMPLATE_EXAMPLE_ROWS = [8, 9];
function defaultTestCasesTemplatePath() {
    return (0, assets_1.resolveAsset)('testcases-template.xlsx');
}
async function fillTestCasesXlsx(model, templatePath = defaultTestCasesTemplatePath()) {
    const wb = new exceljs_1.default.Workbook();
    await wb.xlsx.readFile(templatePath);
    const tpl = wb.getWorksheet('UAT Test Cases') ?? wb.worksheets[0];
    // Group by project so a multi-project solution gets one sheet per process.
    const projects = [...new Set(model.testScenarios.map((t) => t.project).filter(Boolean))];
    if (projects.length < 2) {
        // Single process → one sheet (keep the template sheet name).
        fillSheet(tpl, model.projectName, model.testScenarios);
    }
    else {
        // Multi-project → one sheet per project (clone the template sheet), in the
        // order the projects first appear in the scenario list.
        const used = new Set();
        projects.forEach((proj, i) => {
            const scenarios = model.testScenarios.filter((t) => t.project === proj);
            const sheetName = uniqueSheetName(proj, used);
            const ws = i === 0 ? tpl : cloneSheet(wb, tpl, sheetName);
            if (i === 0)
                ws.name = sheetName;
            fillSheet(ws, proj, scenarios);
        });
    }
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
}
/** Fill a single worksheet's header block + test-case rows. */
function fillSheet(ws, processName, scenarios) {
    ws.getCell('B1').value = processName; // Process Name
    ws.getCell('B2').value = null; // Process Owner
    ws.getCell('B3').value = null; // Robot Name
    ws.getCell('B4').value = null; // Machine Name
    const total = scenarios.length;
    setIfPresent(ws, 'F1', 0); // Pass
    setIfPresent(ws, 'F2', 0); // Fail (Low)
    setIfPresent(ws, 'F3', 0); // Fail (Med/High)
    setIfPresent(ws, 'F4', total); // Not Run
    setIfPresent(ws, 'F5', total); // Total
    const templateStyles = captureRowStyles(ws, FIRST_DATA_ROW);
    for (const r of TEMPLATE_EXAMPLE_ROWS)
        clearRow(ws, r);
    scenarios.forEach((tc, idx) => writeTestCase(ws, FIRST_DATA_ROW + idx, idx + 1, tc, templateStyles));
}
/** Clone a worksheet (rows, styles, merges, columns) under a new name. */
function cloneSheet(wb, source, name) {
    const target = wb.addWorksheet(name);
    const id = target.id;
    // Copy the full worksheet model, then restore this sheet's own identity.
    target.model = { ...source.model, name, id };
    target.name = name;
    return target;
}
/** Excel sheet names: ≤31 chars, no []:*?/\, unique within the workbook. */
function uniqueSheetName(raw, used) {
    let base = (raw || 'Process').replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Process';
    let name = base;
    let n = 2;
    while (used.has(name.toLowerCase())) {
        const suffix = ` (${n++})`;
        name = base.slice(0, 31 - suffix.length) + suffix;
    }
    used.add(name.toLowerCase());
    return name;
}
function captureRowStyles(ws, rowNum) {
    const row = ws.getRow(rowNum);
    const styles = [];
    for (let c = 1; c <= 18; c++) {
        const cell = row.getCell(c);
        styles.push({ col: c, style: { ...cell.style } });
    }
    return styles;
}
function clearRow(ws, rowNum) {
    const row = ws.getRow(rowNum);
    for (let c = 1; c <= 18; c++)
        row.getCell(c).value = null;
}
function writeTestCase(ws, rowNum, seq, tc, templateStyles) {
    const row = ws.getRow(rowNum);
    // Re-apply the template row styling.
    for (const { col, style } of templateStyles) {
        row.getCell(col).style = { ...style };
    }
    const additional = [
        tc.preconditions ? `Preconditions: ${tc.preconditions}` : '',
        tc.steps.length ? `Steps:\n${tc.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '',
        tc.testData ? `Test data: ${tc.testData}` : '',
        tc.tracesTo ? `Traces to: ${tc.tracesTo}` : '',
    ]
        .filter(Boolean)
        .join('\n');
    set(row, 1, seq); // A  #
    set(row, 2, tc.title); // B  Requirement
    set(row, 3, additional); // C  Additional Testing Details
    set(row, 4, tc.id); // D  Case ID
    set(row, 5, mapType(tc.type)); // E  Type
    set(row, 6, 'Not Run'); // F  Status
    set(row, 7, 'N/A'); // G  Fail Severity
    set(row, 8, tc.expectedResult); // H  Expected Result
    // Wrap long text cells.
    for (const col of [2, 3, 8]) {
        row.getCell(col).alignment = { ...row.getCell(col).alignment, wrapText: true, vertical: 'top' };
    }
    row.commit();
}
function set(row, col, value) {
    row.getCell(col).value = value;
}
/** Set a cell value defensively (merged/rich cells tolerated). */
function setIfPresent(ws, addr, value) {
    try {
        ws.getCell(addr).value = value;
    }
    catch {
        /* merged secondary cell — ignore */
    }
}
function mapType(type) {
    return type === 'positive' ? 'Positive' : 'Negative';
}
//# sourceMappingURL=testcasesTemplate.js.map