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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultSddTemplatePath = defaultSddTemplatePath;
exports.fillSddDocx = fillSddDocx;
const fs = __importStar(require("fs"));
const pizzip_1 = __importDefault(require("pizzip"));
const docxtemplater_1 = __importDefault(require("docxtemplater"));
const flowchart_1 = require("./flowchart");
const assets_1 = require("./assets");
const FLOWCHART_MARKER = 'INSTADOCS_FLOWCHART_MAIN';
const PROJECTS_MARKER = 'INSTADOCS_FLOWCHART_PROJECTS';
const ARCH_MARKER = 'INSTADOCS_ARCH';
const EMU_PER_PX = 9525;
const MAX_IMG_WIDTH_PX = 600;
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
function defaultSddTemplatePath() {
    return (0, assets_1.resolveAsset)('sdd-template.docx');
}
function fillSddDocx(model, graph, generatedOn, templatePath = defaultSddTemplatePath()) {
    const zip = new pizzip_1.default(fs.readFileSync(templatePath));
    const doc = new docxtemplater_1.default(zip, {
        delimiters: { start: '[[', end: ']]' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => '',
    });
    doc.render(buildData(model, generatedOn));
    const outZip = doc.getZip();
    ensurePngContentType(outZip);
    // Architecture diagram — robot + the systems it integrates with.
    embedImage(outZip, ARCH_MARKER, 'instadocs-arch.png', (0, flowchart_1.renderArchitecture)(model.projectName, archSystems(model)), 9301);
    // High-level process flow diagram(s):
    //  - Multi-project solution (e.g. Dispatcher + Performer): one REFramework-
    //    PARTITIONED flow PER project (Init / Get Transaction / Process / End) —
    //    two separate diagrams, stacked. No separate per-process section.
    //  - Single project: exactly ONE diagram matching its layout.
    const solutionFlows = model.projectFlows.filter((f) => (0, flowchart_1.hasHighLevelSteps)(f.steps));
    if (solutionFlows.length > 1) {
        embedImage(outZip, FLOWCHART_MARKER, 'instadocs-flow.png', (0, flowchart_1.renderPartitionedFlows)(solutionFlows), 9001);
    }
    else {
        const steps = (0, flowchart_1.hasHighLevelSteps)(model.highLevelSteps)
            ? model.highLevelSteps
            : solutionFlows[0]?.steps ?? [];
        // Per-state business sub-steps: prefer the analyzer's LLM stateFlows; when
        // absent, stateMachineBlock falls back to the parser's own curated per-state
        // steps (graph.stateMachine.states[].steps from expandStateMachineSteps).
        const stateSteps = (0, flowchart_1.stateStepsFromFlows)(model.stateFlows);
        // One centralized decision (renderEntryDiagram): state machine -> code-derived
        // state chart; REFramework -> state swimlane; Flowchart/Sequence -> high-level
        // technical flow. No per-project tuning.
        const single = (0, flowchart_1.renderEntryDiagram)(model.projectName, graph, steps, stateSteps);
        embedImage(outZip, FLOWCHART_MARKER, 'instadocs-flow.png', single, 9001);
    }
    // The per-process high-level flow section is not required (single or multi).
    removeMarkerBlock(outZip, PROJECTS_MARKER, 'Per-process high-level flows:');
    return outZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}
/**
 * Derive architecture-diagram systems from the model. Uses `accessSettings`
 * (authoritative — it carries the access method); `systemsPrereq` is only a
 * fallback when access settings are absent (the two often reword the same
 * systems, which would otherwise duplicate boxes).
 */
function archSystems(model) {
    const source = model.accessSettings.length
        ? model.accessSettings.map((a) => ({ name: a.system, method: a.method }))
        : model.systemsPrereq.map((s) => ({ name: s.system }));
    // Fuzzy key: drop parentheticals / "UiPath" / punctuation / trailing version
    // tokens so "UiPath Test Manager API v2" and "Test Manager (REST API)" merge.
    const key = (name) => name
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/\buipath\b|\bapi\b|\brest\b|\bv?\d+(\.\d+)?\b/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .join(' ');
    const seen = new Set();
    const out = [];
    const add = (s) => {
        const k = key(s.name);
        if (!k || seen.has(k))
            return;
        seen.add(k);
        out.push(s);
    };
    for (const s of source)
        add(s);
    if (model.queues.length && !out.some((s) => /orchestrator/i.test(s.name)))
        add({ name: 'UiPath Orchestrator', method: 'Queues/Assets' });
    return out.slice(0, 6);
}
/**
 * Split a narrative string into clean bullet points: on line breaks / bullet
 * markers first, and — for a long single paragraph — on sentence boundaries, so
 * dense sections render as a scannable list instead of a wall of text.
 */
/** First sentence of a string (for the cover description). */
function firstSentence(text) {
    if (!text)
        return '';
    const m = text.match(/^.*?[.!?](\s|$)/);
    return (m ? m[0] : text).trim();
}
function bullets(text) {
    if (!text || !text.trim())
        return [];
    let parts = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 1) {
        if (/\s[•▪]\s/.test(parts[0]))
            parts = parts[0].split(/\s*[•▪]\s*/);
        else if (parts[0].length > 160)
            parts = parts[0].split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
    }
    return parts
        .map((s) => s.replace(/^[-*•▪]\s+/, '').replace(/^\d+[.)]\s+/, '').trim())
        .filter(Boolean);
}
function buildData(model, generatedOn) {
    const orDash = (arr, make) => (arr.length ? arr : [make()]);
    return {
        projectName: model.projectName,
        platformLabel: model.platformLabel,
        generatedOn,
        coverDescription: firstSentence(model.purpose) || model.summary || model.projectName,
        queueItemJson: model.queueItemJson,
        hasQueueItem: !!model.queueItemJson && model.queueItemJson.trim().length > 0,
        // Narrative kept as short paragraphs.
        purpose: model.purpose,
        summary: model.summary,
        architecture: model.architecture,
        architecturePoints: model.architecturePoints,
        // Structural text kept verbatim (trees/paths) with line breaks preserved.
        orchestratorFolders: model.orchestratorFolders,
        folderStructure: model.folderStructure,
        // Multi-point sections rendered as bullet lists for readability.
        designSpecifications: bullets(model.designSpecifications),
        designConsiderations: bullets(model.designConsiderations),
        reporting: bullets(model.reporting),
        processRuns: bullets(model.processRuns),
        debuggingTips: bullets(model.debuggingTips),
        optimizations: bullets(model.optimizations),
        codeReview: bullets(model.codeReview),
        dataSecurity: bullets(model.dataSecurity),
        revisions: orDash(model.revisions.length
            ? model.revisions
            : [{ rev: '1.0', date: generatedOn, role: 'InstaDocs', summary: 'Initial draft auto-generated from source code', author: 'InstaDocs' }], () => ({ rev: '', date: '', role: '', summary: '', author: '' })),
        contacts: orDash(model.contacts, () => ({ role: 'To be provided by SME', name: '', email: '', org: '' })),
        sourceDocs: orDash(model.sourceDocuments, () => ({ title: 'AGENTS.md (project discovery context)', author: 'UiPath Project Discovery', version: '', date: generatedOn })),
        systemsPrereq: orDash(model.systemsPrereq, () => ({ system: '', requisite: '' })),
        accessSettings: orDash(model.accessSettings, () => ({ system: '', detail: '', level: '', method: '' })),
        robotInfo: orDash(model.robotInfo, () => ({ item: '', desc: '' })),
        processes: orDash(model.processes, () => ({ name: '', folderPath: '', description: '' })),
        triggers: orDash(model.triggers, () => ({ process: '', type: '', recurrence: '', folderPath: '', notes: '' })),
        queues: orDash(model.queues, () => ({ name: '', folderPath: '', details: '' })),
        orchestratorAssets: orDash(model.orchestratorAssets, () => ({ item: '', desc: '' })),
        namingConventions: model.namingConventions,
        modules: orDash(model.modules, () => ({ name: '', parent: '', arguments: '', reusable: '', folderPath: '', description: '' })),
        exceptions: orDash(model.exceptions, () => ({ code: '', detail: '', type: '', botAction: '', notification: '' })),
        // Dependency / library tables: version in its own column (raw, no parens).
        dependencies: orDash(model.dependencies.map(libRow), () => ({ name: '', version: '', purpose: '' })),
        externalLibraries: orDash(model.externalLibraries.map(libRow), () => ({ name: 'None', version: '', purpose: 'No third-party libraries used.' })),
        futureImprovements: model.futureImprovements,
        complianceItems: orDash(model.complianceItems, () => ({ item: '', desc: '' })),
        glossary: orDash(model.glossary, () => ({ term: '', definition: '' })),
    };
    function libRow(l) {
        return { name: l.name, version: l.version || '', purpose: l.purpose || '' };
    }
}
/**
 * Remove an unused image marker and its italic caption paragraph, so a leftover
 * "INSTADOCS_*" token never shows up in the document.
 */
function removeMarkerBlock(zip, marker, caption) {
    let docXml = zip.file('word/document.xml').asText();
    if (!docXml.includes(marker))
        return;
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    docXml = docXml.replace(new RegExp(`<w:p\\b[^>]*>(?:(?!</w:p>)[\\s\\S])*?${esc(caption)}[\\s\\S]*?</w:p>`), '');
    docXml = docXml.replace(new RegExp(`<w:p\\b[^>]*>(?:(?!</w:p>)[\\s\\S])*?${esc(marker)}[\\s\\S]*?</w:p>`), '');
    zip.file('word/document.xml', docXml);
}
function ensurePngContentType(zip) {
    const ctPath = '[Content_Types].xml';
    let ct = zip.file(ctPath).asText();
    if (!/Extension="png"/i.test(ct)) {
        ct = ct.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
        zip.file(ctPath, ct);
    }
}
function embedImage(zip, marker, mediaName, image, idBase, maxWidthPx = MAX_IMG_WIDTH_PX) {
    let docXml = zip.file('word/document.xml').asText();
    if (!docXml.includes(marker))
        return;
    const [wPx, hPx] = fitToPage(image.width, image.height, maxWidthPx);
    const cx = Math.round(wPx * EMU_PER_PX);
    const cy = Math.round(hPx * EMU_PER_PX);
    zip.file(`word/media/${mediaName}`, image.png);
    const relsPath = 'word/_rels/document.xml.rels';
    const rId = `rIdInsta_${mediaName.replace(/[^a-z0-9]/gi, '')}`;
    let rels = zip.file(relsPath).asText();
    if (!rels.includes(rId)) {
        rels = rels.replace('</Relationships>', `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${mediaName}"/></Relationships>`);
        zip.file(relsPath, rels);
    }
    let n = 0;
    docXml = docXml.replace(new RegExp(`<w:t[^>]*>${marker}</w:t>`, 'g'), () => drawingXml(rId, cx, cy, idBase + n++));
    zip.file('word/document.xml', docXml);
}
function drawingXml(rId, cx, cy, id) {
    return (`<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" ` +
        `xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
        `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
        `<wp:docPr id="${id}" name="ProcessFlowchart${id}"/>` +
        `<wp:cNvGraphicFramePr><a:graphicFrameLocks ` +
        `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
        `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
        `<pic:nvPicPr><pic:cNvPr id="${id}" name="ProcessFlowchart${id}"/><pic:cNvPicPr/></pic:nvPicPr>` +
        `<pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
        `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
        `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>`);
}
function fitToPage(width, height, maxW = MAX_IMG_WIDTH_PX) {
    if (width <= maxW)
        return [width, height];
    const scale = maxW / width;
    return [Math.round(width * scale), Math.round(height * scale)];
}
//# sourceMappingURL=sddTemplate.js.map