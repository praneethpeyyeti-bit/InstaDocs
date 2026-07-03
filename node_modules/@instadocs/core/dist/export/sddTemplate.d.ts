import { SddModel } from '../model/sdd';
import { ProcessGraph } from '../model/ir';
/**
 * Fill the branded SDD Word template with code/LLM-derived data and return a
 * .docx buffer.
 *
 * `assets/sdd-template.docx` is a tagged + scrubbed copy of the corporate
 * `Templates/SDD.docx` (see `scripts/tag-sdd-template.js`): technical tables
 * carry `[[ ]]` loops, prose sections are replaced with `[[ ]]` fields, and
 * sample data/guidance is removed — so the output keeps the original structure
 * and styling while containing only source-derived content.
 */
export declare function defaultSddTemplatePath(): string;
export declare function fillSddDocx(model: SddModel, graph: ProcessGraph, generatedOn: string, templatePath?: string): Buffer;
