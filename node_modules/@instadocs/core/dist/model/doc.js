"use strict";
/**
 * Doc AST — a small, exporter-neutral document model.
 *
 * Generators (PDD, test cases) build a `DocDocument`; exporters (markdown,
 * docx, pdf) walk it. This keeps document structure in ONE place so all three
 * output formats stay consistent.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.table = exports.ol = exports.ul = exports.p = exports.h3 = exports.h2 = exports.h1 = void 0;
// ---- tiny builder helpers so generators read cleanly ----
const h1 = (text) => ({ type: 'heading', level: 1, text });
exports.h1 = h1;
const h2 = (text) => ({ type: 'heading', level: 2, text });
exports.h2 = h2;
const h3 = (text) => ({ type: 'heading', level: 3, text });
exports.h3 = h3;
const p = (text) => ({ type: 'paragraph', text });
exports.p = p;
const ul = (items) => ({ type: 'list', items });
exports.ul = ul;
const ol = (items) => ({ type: 'list', ordered: true, items });
exports.ol = ol;
const table = (headers, rows) => ({
    type: 'table',
    headers,
    rows,
});
exports.table = table;
//# sourceMappingURL=doc.js.map