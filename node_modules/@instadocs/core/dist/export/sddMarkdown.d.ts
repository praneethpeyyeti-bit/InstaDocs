import { SddModel, TestScenario } from '../model/sdd';
import { AddModel } from '../model/add';
/** Render an SddModel to a compact Markdown preview for the VS Code webview. */
export declare function sddToMarkdown(m: SddModel): string;
/** Render an AddModel to a compact Markdown preview for the VS Code webview. */
export declare function addToMarkdown(m: AddModel): string;
/** Render the test scenarios to a Markdown table for the preview. */
export declare function testCasesToMarkdown(m: {
    projectName: string;
    testScenarios: TestScenario[];
}): string;
