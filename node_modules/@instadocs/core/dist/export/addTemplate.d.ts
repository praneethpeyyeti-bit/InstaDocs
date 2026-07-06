import { AddModel } from '../model/add';
import { ProcessGraph } from '../model/ir';
/**
 * Fill the branded Agentic Design Document (ADD) Word template with LLM/source-
 * derived data and return a .docx buffer.
 *
 * `assets/add-template.docx` is a tagged + scrubbed copy of the corporate
 * `Templates/ADD.docx` (see `scripts/tag-add-template.js`): control tables carry
 * `[[ ]]` loops, prose sections are `[[ ]]` fields, and two diagram markers
 * (agentic ecosystem + agent lifecycle) are embedded from the parsed AgentSpec.
 */
export declare function defaultAddTemplatePath(): string;
export declare function fillAddDocx(model: AddModel, graph: ProcessGraph, generatedOn: string, templatePath?: string): Buffer;
