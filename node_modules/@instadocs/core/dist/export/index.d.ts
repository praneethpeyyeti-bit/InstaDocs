import { SddModel } from '../model/sdd';
import { ProcessGraph } from '../model/ir';
/**
 * Fixed output contract:
 *   - SDD        -> Word (.docx)  filled from the branded Solution Design template
 *   - Test Cases -> Excel (.xlsx) filled from the UAT Test Case template
 * No other formats are produced.
 */
export { fillSddDocx, defaultSddTemplatePath } from './sddTemplate';
export { fillTestCasesXlsx, defaultTestCasesTemplatePath } from './testcasesTemplate';
export type { TestCaseSource } from './testcasesTemplate';
export interface ExportPaths {
    sddDocx: string;
    testCasesXlsx: string;
}
/** Optional override for the bundled xlsx template asset. */
export interface TemplateOverrides {
    testCasesTemplatePath?: string;
}
/** Write both deliverables to disk and return the paths written. */
export declare function exportDeliverables(model: SddModel, graph: ProcessGraph, generatedOn: string, outDir: string, templates?: TemplateOverrides): Promise<ExportPaths>;
