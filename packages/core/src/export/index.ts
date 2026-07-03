import * as fs from 'fs';
import { SddModel } from '../model/sdd';
import { AddModel } from '../model/add';
import { ProcessGraph } from '../model/ir';
import { DocType } from '../detect/docType';
import { fillSddDocx } from './sddTemplate';
import { fillAddDocx } from './addTemplate';
import { fillTestCasesXlsx } from './testcasesTemplate';

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
export async function exportDeliverables(
  model: SddModel | AddModel,
  graph: ProcessGraph,
  generatedOn: string,
  outDir: string,
  docType: DocType = 'sdd',
  templates: TemplateOverrides = {}
): Promise<ExportPaths> {
  fs.mkdirSync(outDir, { recursive: true });
  const safe = model.projectName.replace(/[^a-z0-9._-]+/gi, '_');

  const isAgentic = docType === 'add';
  const docx = `${outDir}/${safe}-${isAgentic ? 'ADD' : 'SDD'}.docx`;
  const testCasesXlsx = `${outDir}/${safe}-TestCases.xlsx`;

  // Write both independently so a lock on one file (e.g. open in Word) never
  // prevents the other from being produced.
  const errors: string[] = [];
  await writeSafe(
    docx,
    () => (isAgentic ? fillAddDocx(model as AddModel, graph, generatedOn) : fillSddDocx(model as SddModel, graph, generatedOn)),
    errors
  );
  await writeSafe(
    testCasesXlsx,
    () => fillTestCasesXlsx({ projectName: model.projectName, testScenarios: model.testScenarios }, templates.testCasesTemplatePath),
    errors
  );

  if (errors.length) {
    throw new Error(
      `InstaDocs could not write ${errors.length} file(s):\n${errors.join('\n')}\n` +
        'If a file is open (e.g. in Word/Excel), close it and try again.'
    );
  }
  return { docx, testCasesXlsx, docType };
}

async function writeSafe(
  filePath: string,
  produce: () => Buffer | Promise<Buffer>,
  errors: string[]
): Promise<void> {
  try {
    fs.writeFileSync(filePath, await produce());
  } catch (err) {
    const reason = (err as NodeJS.ErrnoException).code === 'EBUSY' ? 'file is open/locked' : (err as Error).message;
    errors.push(`  - ${filePath}: ${reason}`);
  }
}
