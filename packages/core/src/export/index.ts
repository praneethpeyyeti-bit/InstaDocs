import * as fs from 'fs';
import { SddModel } from '../model/sdd';
import { ProcessGraph } from '../model/ir';
import { fillSddDocx } from './sddTemplate';
import { fillTestCasesXlsx } from './testcasesTemplate';

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
export async function exportDeliverables(
  model: SddModel,
  graph: ProcessGraph,
  generatedOn: string,
  outDir: string,
  templates: TemplateOverrides = {}
): Promise<ExportPaths> {
  fs.mkdirSync(outDir, { recursive: true });
  const safe = model.projectName.replace(/[^a-z0-9._-]+/gi, '_');

  const sddDocx = `${outDir}/${safe}-SDD.docx`;
  const testCasesXlsx = `${outDir}/${safe}-TestCases.xlsx`;

  // Write both independently so a lock on one file (e.g. open in Word) never
  // prevents the other from being produced.
  const errors: string[] = [];
  await writeSafe(sddDocx, () => fillSddDocx(model, graph, generatedOn), errors);
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
  return { sddDocx, testCasesXlsx };
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
