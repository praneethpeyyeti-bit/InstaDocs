import { DocDocument } from '../model/doc';
/**
 * Render a DocDocument to a PDF buffer by way of Markdown -> HTML -> PDF.
 *
 * `md-to-pdf` is loaded lazily (it pulls in a headless browser) so importing
 * the core library stays cheap for consumers that only need Markdown/Word.
 */
export declare function toPdf(doc: DocDocument): Promise<Buffer>;
