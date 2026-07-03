import { DocDocument } from '../model/doc';
/** Render a DocDocument to a .docx buffer (clean, self-contained document). */
export declare function toDocx(doc: DocDocument): Promise<Buffer>;
