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
    const ws = wb.getWorksheet('UAT Test Cases') ?? wb.worksheets[0];
    // Header block: fill what the code knows, clear template sample values
    // (Process Owner / Robot / Machine are environment details, not in source).
    ws.getCell('B1').value = model.projectName; // Process Name
    ws.getCell('B2').value = null; // Process Owner
    ws.getCell('B3').value = null; // Robot Name
    ws.getCell('B4').value = null; // Machine Name
    // Status summary counts (all start Not Run since nothing has executed yet).
    const total = model.testScenarios.length;
    setIfPresent(ws, 'F1', 0); // Pass
    setIfPresent(ws, 'F2', 0); // Fail (Low)
    setIfPresent(ws, 'F3', 0); // Fail (Med/High)
    setIfPresent(ws, 'F4', total); // Not Run
    setIfPresent(ws, 'F5', total); // Total
    // Capture the styling of the first example row so new rows look native.
    const templateStyles = captureRowStyles(ws, FIRST_DATA_ROW);
    // Clear the grey example rows.
    for (const r of TEMPLATE_EXAMPLE_ROWS)
        clearRow(ws, r);
    // Write real test cases from FIRST_DATA_ROW downward.
    model.testScenarios.forEach((tc, idx) => {
        const rowNum = FIRST_DATA_ROW + idx;
        writeTestCase(ws, rowNum, idx + 1, tc, templateStyles);
    });
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out);
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