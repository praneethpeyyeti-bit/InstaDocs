"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPdf = toPdf;
const markdown_1 = require("./markdown");
/**
 * Render a DocDocument to a PDF buffer by way of Markdown -> HTML -> PDF.
 *
 * `md-to-pdf` is loaded lazily (it pulls in a headless browser) so importing
 * the core library stays cheap for consumers that only need Markdown/Word.
 */
async function toPdf(doc) {
    const markdown = (0, markdown_1.toMarkdown)(doc);
    const { mdToPdf } = await Promise.resolve().then(() => __importStar(require('md-to-pdf')));
    const result = await mdToPdf({ content: markdown }, {
        css: PDF_CSS,
        pdf_options: {
            format: 'A4',
            margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
            printBackground: true,
        },
    });
    if (!result || !result.content) {
        throw new Error('PDF generation returned no content.');
    }
    return result.content;
}
const PDF_CSS = `
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  h1 { font-size: 22pt; border-bottom: 2px solid #fa4616; padding-bottom: 6px; }
  h2 { font-size: 15pt; margin-top: 22px; color: #182a4e; }
  h3 { font-size: 12pt; color: #182a4e; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; margin: 10px 0; }
  th, td { border: 1px solid #cfd6e4; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #182a4e; color: #fff; }
  tr:nth-child(even) td { background: #f5f7fb; }
`;
//# sourceMappingURL=pdf.js.map