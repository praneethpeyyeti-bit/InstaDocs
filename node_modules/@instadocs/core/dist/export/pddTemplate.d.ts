import { EnrichedModel } from '../model/enriched';
import { ProcessGraph } from '../model/ir';
/**
 * Fill the branded PDD Word template with code-derived data and return a .docx
 * buffer.
 *
 * `assets/pdd-template.docx` is a tagged + scrubbed copy of the corporate
 * `Templates/PDD.docx` (see `scripts/tag-pdd-template.js`): the code-derivable
 * tables carry `[[ ]]` loops, every other section's sample data is cleared, and
 * template guidance/emails are removed — so the output keeps the original
 * structure and styling while containing only source-derived content.
 */
export declare function defaultPddTemplatePath(): string;
export declare function fillPddDocx(model: EnrichedModel, graph: ProcessGraph, generatedOn: string, templatePath?: string): Buffer;
