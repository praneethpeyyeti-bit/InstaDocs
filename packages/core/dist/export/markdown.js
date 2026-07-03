"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toMarkdown = toMarkdown;
/** Serialize a DocDocument to GitHub-flavored Markdown. */
function toMarkdown(doc) {
    const out = [];
    out.push(`# ${doc.title}`);
    if (doc.subtitle)
        out.push(`_${doc.subtitle}_`);
    if (doc.meta && Object.keys(doc.meta).length) {
        out.push('');
        for (const [k, v] of Object.entries(doc.meta))
            out.push(`**${k}:** ${v}  `);
    }
    out.push('');
    for (const block of doc.blocks)
        out.push(renderBlock(block), '');
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
function renderBlock(block) {
    switch (block.type) {
        case 'heading':
            return `${'#'.repeat(block.level + 1)} ${block.text}`;
        case 'paragraph':
            return block.text;
        case 'list':
            return block.items
                .map((it, i) => (block.ordered ? `${i + 1}. ${it}` : `- ${it}`))
                .join('\n');
        case 'table':
            return renderTable(block.headers, block.rows);
    }
}
function renderTable(headers, rows) {
    const esc = (s) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
    const head = `| ${headers.map(esc).join(' | ')} |`;
    const sep = `| ${headers.map(() => '---').join(' | ')} |`;
    const body = rows.map((r) => `| ${r.map(esc).join(' | ')} |`).join('\n');
    return [head, sep, body].join('\n');
}
//# sourceMappingURL=markdown.js.map