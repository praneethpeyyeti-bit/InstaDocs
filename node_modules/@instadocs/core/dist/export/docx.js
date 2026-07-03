"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toDocx = toDocx;
const docx_1 = require("docx");
/** Render a DocDocument to a .docx buffer (clean, self-contained document). */
async function toDocx(doc) {
    const children = [];
    children.push(new docx_1.Paragraph({
        heading: docx_1.HeadingLevel.TITLE,
        alignment: docx_1.AlignmentType.CENTER,
        children: [new docx_1.TextRun({ text: doc.title, bold: true })],
    }));
    if (doc.subtitle) {
        children.push(new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            children: [new docx_1.TextRun({ text: doc.subtitle, italics: true })],
        }));
    }
    if (doc.meta) {
        for (const [k, v] of Object.entries(doc.meta)) {
            children.push(new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: `${k}: `, bold: true }), new docx_1.TextRun(v)] }));
        }
    }
    children.push(new docx_1.Paragraph(''));
    for (const block of doc.blocks)
        children.push(...renderBlock(block));
    const document = new docx_1.Document({ sections: [{ children }] });
    return docx_1.Packer.toBuffer(document);
}
function renderBlock(block) {
    switch (block.type) {
        case 'heading':
            return [
                new docx_1.Paragraph({
                    heading: block.level === 1
                        ? docx_1.HeadingLevel.HEADING_1
                        : block.level === 2
                            ? docx_1.HeadingLevel.HEADING_2
                            : docx_1.HeadingLevel.HEADING_3,
                    children: [new docx_1.TextRun({ text: block.text, bold: true })],
                }),
            ];
        case 'paragraph':
            return [new docx_1.Paragraph({ children: inlineRuns(block.text) })];
        case 'list':
            return block.items.map((it, i) => new docx_1.Paragraph({
                bullet: block.ordered ? undefined : { level: 0 },
                numbering: undefined,
                children: inlineRuns(block.ordered ? `${i + 1}. ${it}` : it),
            }));
        case 'table':
            return [renderTable(block.headers, block.rows)];
    }
}
function renderTable(headers, rows) {
    const headerRow = new docx_1.TableRow({
        tableHeader: true,
        children: headers.map((h) => new docx_1.TableCell({
            children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: h, bold: true })] })],
        })),
    });
    const bodyRows = rows.map((r) => new docx_1.TableRow({
        children: r.map((cell) => new docx_1.TableCell({
            children: (cell ?? '')
                .split('\n')
                .map((line) => new docx_1.Paragraph({ children: inlineRuns(line) })),
        })),
    }));
    return new docx_1.Table({
        width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
        rows: [headerRow, ...bodyRows],
    });
}
/** Minimal **bold** handling so markdown emphasis survives to Word. */
function inlineRuns(text) {
    const parts = (text ?? '').split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    if (!parts.length)
        return [new docx_1.TextRun('')];
    return parts.map((part) => {
        const bold = /^\*\*[^*]+\*\*$/.test(part);
        return new docx_1.TextRun({ text: bold ? part.slice(2, -2) : part, bold });
    });
}
//# sourceMappingURL=docx.js.map