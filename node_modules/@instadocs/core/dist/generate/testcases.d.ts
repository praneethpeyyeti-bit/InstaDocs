import { EnrichedModel } from '../model/enriched';
import { DocDocument } from '../model/doc';
/** Build a Test Case Document (doc AST) from an EnrichedModel. */
export declare function generateTestCases(model: EnrichedModel, generatedOn: string): DocDocument;
