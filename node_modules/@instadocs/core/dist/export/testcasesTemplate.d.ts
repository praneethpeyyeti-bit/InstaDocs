import { TestScenario } from '../model/sdd';
/** Minimal shape the test-case sheet needs — supplied by the SDD model. */
export interface TestCaseSource {
    projectName: string;
    testScenarios: TestScenario[];
}
export declare function defaultTestCasesTemplatePath(): string;
export declare function fillTestCasesXlsx(model: TestCaseSource, templatePath?: string): Promise<Buffer>;
