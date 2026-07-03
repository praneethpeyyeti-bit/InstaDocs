import { SddModel } from '../model/sdd';
/** Render an SddModel to a compact Markdown preview for the VS Code webview. */
export declare function sddToMarkdown(m: SddModel): string;
/** Render the test scenarios to a Markdown table for the preview. */
export declare function testCasesToMarkdown(m: SddModel): string;
