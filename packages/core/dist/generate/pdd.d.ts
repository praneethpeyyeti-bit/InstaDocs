import { EnrichedModel } from '../model/enriched';
import { ProcessGraph } from '../model/ir';
import { DocDocument } from '../model/doc';
/**
 * Build a complete Process Design Document (doc AST) from the analysis.
 *
 * Every section is populated *only* from the parsed source code / enrichment —
 * no template sample data is carried over. Sections of a classic PDD that
 * require human/business input (sign-off, contacts, ROI, SLAs, reporting, risk)
 * cannot be derived from code, so instead of fabricating values we list them
 * explicitly under "Sections requiring business input".
 */
export declare function generatePdd(model: EnrichedModel, graph: ProcessGraph, generatedOn: string): DocDocument;
