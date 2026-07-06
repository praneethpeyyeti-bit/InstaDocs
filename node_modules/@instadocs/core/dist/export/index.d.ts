import { SddModel } from '../model/sdd';
import { AddModel } from '../model/add';
import { ProcessGraph } from '../model/ir';
import { DocType } from '../detect/docType';
/**
 * Fixed output contract:
 *   - RPA projects     -> Solution Design Document  (SDD, .docx) + Test Cases (.xlsx)
 *   - Agentic projects -> Agentic Design Document   (ADD, .docx) + Test Cases (.xlsx)
 * The Word deliverable is filled from the matching branded template; the Excel
 * test-case doc is shared. No other formats are produced.
 */
export { fillSddDocx, defaultSddTemplatePath } from './sddTemplate';
export { fillAddDocx, defaultAddTemplatePath } from './addTemplate';
export { fillTestCasesXlsx, defaultTestCasesTemplatePath } from './testcasesTemplate';
export type { TestCaseSource } from './testcasesTemplate';
export interface ExportPaths {
    /** The Word deliverable (SDD or ADD, depending on doc type). */
    docx: string;
    testCasesXlsx: string;
    docType: DocType;
}
/** Optional override for the bundled xlsx template asset. */
export interface TemplateOverrides {
    testCasesTemplatePath?: string;
}
/** Write both deliverables to disk and return the paths written. */
export declare function exportDeliverables(model: SddModel | AddModel, graph: ProcessGraph, generatedOn: string, outDir: string, docType?: DocType, templates?: TemplateOverrides): Promise<ExportPaths>;
